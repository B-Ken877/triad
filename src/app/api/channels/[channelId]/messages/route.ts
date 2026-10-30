import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError, isPrismaUniqueError, readJsonObject } from "@/lib/http";
import { getChannelAccess } from "@/lib/workspace/access";

type Context = { params: Promise<{ channelId: string }> };
type TimelineMessage = { id: string; createdAt: Date; kind: "human" | "agent" };

export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { channelId } = await context.params;
  if (!await getChannelAccess(channelId, user.id)) return apiError("Channel not found or access denied.", 404);
  try {
    const [humanMessages, agentMessages] = await Promise.all([
      db.message.findMany({
        where: { channelId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
        select: { id: true, body: true, createdAt: true, sender: { select: { id: true, name: true, email: true } } },
      }),
      db.agentMessage.findMany({
        where: { channelId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
        select: { id: true, body: true, createdAt: true, agent: { select: { id: true, name: true } } },
      }),
    ]);
    const messages: (TimelineMessage & Record<string, unknown>)[] = [
      ...humanMessages.map(message => ({ ...message, kind: "human" as const, sender: { ...message.sender, type: "user" as const } })),
      ...agentMessages.map(message => ({ ...message, senderId: `agent:${message.agent.id}`, kind: "agent" as const, sender: { ...message.agent, type: "agent" as const, email: null } })),
    ];
    messages.sort((a, b) => {
      const time = a.createdAt.getTime() - b.createdAt.getTime();
      if (time !== 0) return time;
      if (a.kind !== b.kind) return a.kind === "human" ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    return NextResponse.json({ messages: messages.slice(0, 100) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Message history failed:", error);
    return apiError("Unable to load messages.", 500);
  }
}

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { channelId } = await context.params;
  if (!await getChannelAccess(channelId, user.id)) return apiError("Channel not found or access denied.", 404);
  const input = await readJsonObject(request);
  const body = typeof input?.body === "string" ? input.body.trim() : "";
  const clientMsgId = typeof input?.clientMsgId === "string" ? input.clientMsgId.trim() : null;
  if (!body || body.length > 10000) return apiError("Message must contain between 1 and 10,000 characters.", 400);
  if (clientMsgId !== null && (clientMsgId.length < 1 || clientMsgId.length > 128)) return apiError("Invalid client message identifier.", 400);
  try {
    const message = await db.message.create({
      data: { channelId, senderId: user.id, body, clientMsgId },
      include: { sender: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) return apiError("This message identifier was already used. Refresh the conversation before retrying.", 409);
    console.error("Message send failed:", error);
    return apiError("Unable to send this message.", 500);
  }
}
