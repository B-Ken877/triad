import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { authenticateAgent } from "@/lib/agents/api-key";
import { db } from "@/lib/db";
import { apiError, isPrismaUniqueError, readJsonObject } from "@/lib/http";

type Context = { params: Promise<{ channelId: string }> };
type Cursor = { createdAt: string; kind: "human" | "agent"; id: string };

function decodeCursor(value: string | null): Cursor | null | false {
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

function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function compareMessages(
  a: { id: string; createdAt: Date; kind: "human" | "agent" },
  b: { id: string; createdAt: Date; kind: "human" | "agent" },
) {
  const time = a.createdAt.getTime() - b.createdAt.getTime();
  if (time !== 0) return time;
  if (a.kind !== b.kind) return a.kind === "human" ? -1 : 1;
  return a.id.localeCompare(b.id);
}

export async function GET(request: Request, context: Context) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth) return apiError("Invalid, expired, or revoked agent API key.", 401);

    const { channelId } = await context.params;
    if (!auth.allowedChannelIds.includes(channelId)) return apiError("Channel not found or access denied.", 404);

    const url = new URL(request.url);
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit === null ? 50 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return apiError("The limit must be an integer between 1 and 100.", 400);
    }
    const cursor = decodeCursor(url.searchParams.get("cursor"));
    if (cursor === false) return apiError("Invalid message cursor.", 400);

    const channel = await db.channel.findFirst({
      where: { id: channelId, workspaceId: auth.agent.workspaceId, archivedAt: null },
      select: { id: true },
    });
    if (!channel) return apiError("Channel not found or access denied.", 404);

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
    const page = combined.slice(0, limit);
    const last = page.at(-1);
    return NextResponse.json({
      messages: page,
      pagination: {
        limit,
        hasMore,
        nextCursor: hasMore && last
          ? encodeCursor({ id: last.id, kind: last.kind, createdAt: last.createdAt.toISOString() })
          : null,
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Agent message history failed:", error);
    return apiError("Unable to load agent messages.", 500);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth) return apiError("Invalid, expired, or revoked agent API key.", 401);

    const { channelId } = await context.params;
    if (!auth.allowedChannelIds.includes(channelId)) return apiError("Channel not found or access denied.", 404);

    const channel = await db.channel.findFirst({
      where: { id: channelId, workspaceId: auth.agent.workspaceId, archivedAt: null },
      select: { id: true },
    });
    if (!channel) return apiError("Channel not found or access denied.", 404);

    const input = await readJsonObject(request);
    const body = typeof input?.body === "string" ? input.body.trim() : "";
    const clientMsgId = typeof input?.clientMsgId === "string" ? input.clientMsgId.trim() : "";
    if (!body || body.length > 10000) return apiError("Message must contain between 1 and 10,000 characters.", 400);
    if (clientMsgId.length < 1 || clientMsgId.length > 128) {
      return apiError("A clientMsgId between 1 and 128 characters is required for safe retries.", 400);
    }

    try {
      const message = await db.agentMessage.create({
        data: { channelId, agentId: auth.agent.id, body, clientMsgId },
        select: { id: true, channelId: true, body: true, createdAt: true, agent: { select: { id: true, name: true } } },
      });
      return NextResponse.json({ message: { ...message, kind: "agent" } }, { status: 201, headers: { "cache-control": "no-store" } });
    } catch (error) {
      if (!isPrismaUniqueError(error)) throw error;
      const existing = await db.agentMessage.findUnique({
        where: { agentId_clientMsgId: { agentId: auth.agent.id, clientMsgId } },
        select: { id: true, channelId: true, body: true, createdAt: true, agent: { select: { id: true, name: true } } },
      });
      if (!existing || existing.channelId !== channelId || existing.body !== body) {
        return apiError("This clientMsgId was already used for a different message.", 409);
      }
      return NextResponse.json({ message: { ...existing, kind: "agent" }, replayed: true }, { status: 200, headers: { "cache-control": "no-store" } });
    }
  } catch (error) {
    console.error("Agent message send failed:", error);
    return apiError("Unable to send agent message.", 500);
  }
}
