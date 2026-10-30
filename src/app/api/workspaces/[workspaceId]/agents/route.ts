import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError, readJsonObject } from "@/lib/http";
import { createAgentApiKey } from "@/lib/agents/api-key";
type Context = { params: Promise<{ workspaceId: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { workspaceId } = await context.params;
  const membership = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } }, select: { role: true } });
  if (!membership) return apiError("Workspace not found or access denied.", 404);
  try {
    const agents = await db.agent.findMany({
      where: { workspaceId }, orderBy: { createdAt: "desc" },
      include: { channels: { include: { channel: { select: { id: true, name: true } } } },
        keys: { where: { revokedAt: null }, select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, expiresAt: true } } },
    });
    return NextResponse.json({ agents }, { headers: { "cache-control": "no-store" } });
  } catch (error) { console.error("Agent list failed:", error); return apiError("Unable to load agents.", 500); }
}

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { workspaceId } = await context.params;
  const membership = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } }, select: { role: true } });
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) return apiError("Only workspace owners and admins can register agents.", 403);
  const input = await readJsonObject(request);
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const channelIds = Array.isArray(input?.channelIds) ? [...new Set(input.channelIds.filter((id): id is string => typeof id === "string"))] : [];
  if (name.length < 2 || name.length > 80) return apiError("Agent name must be between 2 and 80 characters.", 400);
  if (description.length > 500 || channelIds.length === 0 || channelIds.length > 50) return apiError("Choose between 1 and 50 project channels. Description must be 500 characters or fewer.", 400);
  try {
    const validChannels = await db.channel.findMany({ where: { id: { in: channelIds }, workspaceId, archivedAt: null }, select: { id: true } });
    if (validChannels.length !== channelIds.length) return apiError("One or more selected channels are invalid.", 400);
    const credentials = createAgentApiKey();
    const agent = await db.agent.create({ data: {
      workspaceId, createdById: user.id, name, description: description || null,
      channels: { create: channelIds.map(channelId => ({ channelId })) },
      keys: { create: { name: "Initial API key", prefix: credentials.prefix, keyHash: credentials.hash } },
    }, select: { id: true, name: true, description: true, status: true, createdAt: true } });
    return NextResponse.json({ agent, apiKey: credentials.token, warning: "Copy this key now. It will not be shown again." }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) { console.error("Agent creation failed:", error); return apiError("Unable to register this agent.", 500); }
}
