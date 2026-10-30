import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/agents/api-key";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

type Context = { params: Promise<{ channelId: string }> };
type MessageCursor = { createdAt: string; id: string };

function decodeCursor(value: string | null): MessageCursor | null | false {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return false;
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.id !== "string" || candidate.id.length < 1 || candidate.id.length > 128) return false;
    if (typeof candidate.createdAt !== "string" || !Number.isFinite(Date.parse(candidate.createdAt))) return false;
    return { id: candidate.id, createdAt: candidate.createdAt };
  } catch {
    return false;
  }
}

function encodeCursor(cursor: MessageCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export async function GET(request: Request, context: Context) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth) return apiError("Invalid, expired, or revoked agent API key.", 401);

    const { channelId } = await context.params;
    if (!auth.allowedChannelIds.includes(channelId)) {
      return apiError("Channel not found or access denied.", 404);
    }

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

    const messages = await db.message.findMany({
      where: {
        channelId,
        ...(cursor ? {
          OR: [
            { createdAt: { gt: new Date(cursor.createdAt) } },
            { createdAt: new Date(cursor.createdAt), id: { gt: cursor.id } },
          ],
        } : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      select: {
        id: true,
        body: true,
        createdAt: true,
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;
    const last = page.at(-1);
    return NextResponse.json({
      messages: page,
      pagination: {
        limit,
        hasMore,
        nextCursor: hasMore && last ? encodeCursor({ id: last.id, createdAt: last.createdAt.toISOString() }) : null,
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Agent message history failed:", error);
    return apiError("Unable to load agent messages.", 500);
  }
}
