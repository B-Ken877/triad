import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError, isPrismaUniqueError, readJsonObject } from "@/lib/http";
import { getChannelAccess } from "@/lib/workspace/access";
type Context = { params: Promise<{ channelId: string }> };
export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { channelId } = await context.params;
  if (!await getChannelAccess(channelId, user.id)) return apiError("Channel not found or access denied.", 404);
  try {
    const messages = await db.message.findMany({
      where: { channelId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
      include: { sender: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ messages }, { headers: { "cache-control": "no-store" } });
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
