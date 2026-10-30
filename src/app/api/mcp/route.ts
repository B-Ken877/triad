import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { authenticateAgent } from "@/lib/agents/api-key";
import { db } from "@/lib/db";
import { isPrismaUniqueError } from "@/lib/http";

type AgentIdentity = {
  agentId: string;
  workspaceId: string;
  allowedChannelIds: string[];
};

type ToolContext = {
  http?: {
    authInfo?: {
      scopes?: string[];
      extra?: unknown;
    };
  };
};

type Cursor = { createdAt: string; kind: "human" | "agent"; id: string };

function getAgentIdentity(context: unknown): AgentIdentity | null {
  const authInfo = (context as ToolContext).http?.authInfo;
  const extra = authInfo?.extra;
  if (!extra || typeof extra !== "object") return null;

  const value = extra as Record<string, unknown>;
  if (
    typeof value.agentId !== "string" ||
    typeof value.workspaceId !== "string" ||
    !Array.isArray(value.allowedChannelIds) ||
    !value.allowedChannelIds.every((id): id is string => typeof id === "string")
  ) return null;

  return {
    agentId: value.agentId,
    workspaceId: value.workspaceId,
    allowedChannelIds: value.allowedChannelIds,
  };
}

function hasScope(context: unknown, scope: string): boolean {
  const scopes = (context as ToolContext).http?.authInfo?.scopes;
  return Array.isArray(scopes) && scopes.includes(scope);
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function decodeCursor(value?: string): Cursor | null | false {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return false;
    const item = parsed as Record<string, unknown>;
    if (typeof item.id !== "string" || item.id.length < 1 || item.id.length > 128) return false;
    if (item.kind !== "human" && item.kind !== "agent") return false;
    if (typeof item.createdAt !== "string" || !Number.isFinite(Date.parse(item.createdAt))) return false;
    return { id: item.id, kind: item.kind, createdAt: item.createdAt };
  } catch {
    return false;
  }
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function compareMessages(
  a: { id: string; createdAt: Date; kind: "human" | "agent" },
  b: { id: string; createdAt: Date; kind: "human" | "agent" },
): number {
  const time = a.createdAt.getTime() - b.createdAt.getTime();
  if (time !== 0) return time;
  if (a.kind !== b.kind) return a.kind === "human" ? -1 : 1;
  return a.id.localeCompare(b.id);
}

async function verifyAgentToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken || bearerToken.length > 256) return undefined;

  try {
    const request = new Request("https://triad.invalid/api/mcp", {
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    const auth = await authenticateAgent(request);
    if (!auth) return undefined;

    return {
      token: bearerToken,
      scopes: ["channels:read", "messages:write"],
      clientId: auth.agent.id,
      extra: {
        agentId: auth.agent.id,
        workspaceId: auth.agent.workspaceId,
        allowedChannelIds: auth.allowedChannelIds,
      },
    };
  } catch (error) {
    console.error("TRIAD MCP token verification failed:", error);
    return undefined;
  }
}

const handler = createMcpHandler((server) => {
  server.registerTool(
    "get_agent_identity",
    {
      title: "Get agent identity",
      description: "Return the authenticated TRIAD agent identity and its workspace. Never returns API keys or secrets.",
      inputSchema: z.object({}),
    },
    async (_input, context) => {
      const identity = getAgentIdentity(context);
      if (!identity) return errorResult("The authenticated agent context is unavailable.");

      const agent = await db.agent.findFirst({
        where: {
          id: identity.agentId,
          workspaceId: identity.workspaceId,
          status: "ACTIVE",
        },
        select: { id: true, name: true, description: true, status: true, workspaceId: true },
      });
      if (!agent) return errorResult("The agent is disabled or no longer available.");
      return textResult({ agent });
    },
  );

  server.registerTool(
    "list_authorized_channels",
    {
      title: "List authorized channels",
      description: "List active TRIAD channels explicitly granted to this agent. Channels outside its grants are never returned.",
      inputSchema: z.object({}),
    },
    async (_input, context) => {
      const identity = getAgentIdentity(context);
      if (!identity) return errorResult("The authenticated agent context is unavailable.");
      if (identity.allowedChannelIds.length === 0) return textResult({ channels: [] });

      const channels = await db.channel.findMany({
        where: {
          id: { in: identity.allowedChannelIds },
          workspaceId: identity.workspaceId,
          archivedAt: null,
        },
        select: { id: true, name: true, description: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      });
      return textResult({ channels });
    },
  );

  server.registerTool(
    "read_channel_messages",
    {
      title: "Read channel messages",
      description: "Read human and agent messages from a channel the authenticated agent is authorized to access. Uses chronological cursor pagination; limit must be 1–100.",
      inputSchema: z.object({
        channelId: z.string().min(1).max(128),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().max(2048).optional(),
      }),
    },
    async ({ channelId, limit = 50, cursor: rawCursor }, context) => {
      const identity = getAgentIdentity(context);
      if (!identity) return errorResult("The authenticated agent context is unavailable.");
      if (!identity.allowedChannelIds.includes(channelId)) return errorResult("Channel not found or access denied.");

      const channel = await db.channel.findFirst({
        where: { id: channelId, workspaceId: identity.workspaceId, archivedAt: null },
        select: { id: true },
      });
      if (!channel) return errorResult("Channel not found or access denied.");

      const cursor = decodeCursor(rawCursor);
      if (cursor === false) return errorResult("Invalid message cursor.");

      const cursorDate = cursor ? new Date(cursor.createdAt) : null;
      const afterHuman: Prisma.MessageWhereInput = cursor && cursorDate
        ? {
            OR: [
              { createdAt: { gt: cursorDate } },
              ...(cursor.kind === "human" ? [{ createdAt: { equals: cursorDate }, id: { gt: cursor.id } }] : []),
            ],
          }
        : {};
      const afterAgent: Prisma.AgentMessageWhereInput = cursor && cursorDate
        ? {
            OR: [
              { createdAt: { gt: cursorDate } },
              {
                createdAt: { equals: cursorDate },
                ...(cursor.kind === "human" ? {} : { id: { gt: cursor.id } }),
              },
            ],
          }
        : {};

      const [humanMessages, agentMessages] = await Promise.all([
        db.message.findMany({
          where: { channelId, ...afterHuman },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: limit + 1,
          select: { id: true, body: true, createdAt: true, sender: { select: { id: true, name: true, email: true } } },
        }),
        db.agentMessage.findMany({
          where: { channelId, ...afterAgent },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: limit + 1,
          select: { id: true, body: true, createdAt: true, agent: { select: { id: true, name: true } } },
        }),
      ]);

      const combined = [
        ...humanMessages.map(message => ({ ...message, kind: "human" as const, sender: { ...message.sender, type: "user" as const } })),
        ...agentMessages.map(message => ({ ...message, kind: "agent" as const, sender: { ...message.agent, type: "agent" as const, email: null } })),
      ].sort(compareMessages);

      const hasMore = combined.length > limit;
      const messages = combined.slice(0, limit);
      const last = messages.at(-1);
      return textResult({
        messages,
        pagination: {
          limit,
          hasMore,
          nextCursor: hasMore && last
            ? encodeCursor({ id: last.id, kind: last.kind, createdAt: last.createdAt.toISOString() })
            : null,
        },
      });
    },
  );

  server.registerTool(
    "send_channel_message",
    {
      title: "Send channel message",
      description: "Post a message as the authenticated TRIAD agent to an explicitly authorized active channel. Supply clientMsgId to make retries idempotent; if omitted, TRIAD generates one and returns it.",
      inputSchema: z.object({
        channelId: z.string().min(1).max(128),
        body: z.string().trim().min(1).max(10000),
        clientMsgId: z.string().trim().min(1).max(128).optional(),
      }),
    },
    async ({ channelId, body, clientMsgId: suppliedClientMsgId }, context) => {
      const identity = getAgentIdentity(context);
      if (!identity) return errorResult("The authenticated agent context is unavailable.");
      if (!hasScope(context, "messages:write")) return errorResult("This credential does not have message-write permission.");
      if (!identity.allowedChannelIds.includes(channelId)) return errorResult("Channel not found or access denied.");

      const channel = await db.channel.findFirst({
        where: { id: channelId, workspaceId: identity.workspaceId, archivedAt: null },
        select: { id: true },
      });
      if (!channel) return errorResult("Channel not found or access denied.");

      const clientMsgId = suppliedClientMsgId ?? randomUUID();
      try {
        const message = await db.agentMessage.create({
          data: { channelId, agentId: identity.agentId, body, clientMsgId },
          select: { id: true, channelId: true, body: true, clientMsgId: true, createdAt: true, agent: { select: { id: true, name: true } } },
        });
        return textResult({ message: { ...message, kind: "agent" }, replayed: false });
      } catch (error) {
        if (!isPrismaUniqueError(error)) {
          console.error("TRIAD MCP message send failed:", error);
          return errorResult("Unable to send the message. Please retry with the same clientMsgId.");
        }

        const existing = await db.agentMessage.findUnique({
          where: { agentId_clientMsgId: { agentId: identity.agentId, clientMsgId } },
          select: { id: true, channelId: true, body: true, clientMsgId: true, createdAt: true, agent: { select: { id: true, name: true } } },
        });
        if (!existing || existing.channelId !== channelId || existing.body !== body) {
          return errorResult("This clientMsgId was already used for a different message.");
        }
        return textResult({ message: { ...existing, kind: "agent" }, replayed: true });
      }
    },
  );
}, {
  serverInfo: {
    name: "triad",
    version: "1.0.0",
  },
});

const authHandler = withMcpAuth(handler, verifyAgentToken, {
  required: true,
  requiredScopes: ["channels:read"],
});

export const runtime = "nodejs";
export const maxDuration = 60;
export { authHandler as GET, authHandler as POST };
