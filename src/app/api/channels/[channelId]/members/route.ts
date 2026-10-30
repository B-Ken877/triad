import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError, readJsonObject } from "@/lib/http";
import { getChannelAccess } from "@/lib/workspace/access";
type Context = { params: Promise<{ channelId: string }> };
export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { channelId } = await context.params;
  if (!await getChannelAccess(channelId, user.id)) return apiError("Channel not found or access denied.", 404);
  try {
    const members = await db.channelMember.findMany({
      where: { channelId }, orderBy: { createdAt: "asc" },
      select: { role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ members }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Channel members lookup failed:", error);
    return apiError("Unable to load channel members.", 500);
  }
}
export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { channelId } = await context.params;
  const access = await getChannelAccess(channelId, user.id);
  if (!access) return apiError("Channel not found or access denied.", 404);
  const actorRole = access.members[0]?.role;
  if (actorRole !== "OWNER") return apiError("Only the channel owner can manage its membership.", 403);
  const input = await readJsonObject(request);
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  const role = input?.role === "MODERATOR" ? "MODERATOR" : input?.role === "MEMBER" || input?.role === undefined ? "MEMBER" : null;
  if (!email || email.length > 320 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !role) return apiError("Provide a valid email and a MEMBER or MODERATOR role.", 400);
  try {
    const target = await db.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
    if (!target) return apiError("That user must create a TRIAD account before being added.", 404);
    const workspaceMember = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: access.workspace.id, userId: target.id } },
      select: { id: true },
    });
    if (!workspaceMember) return apiError("Add this user to the workspace before granting channel access.", 409);
    const member = await db.channelMember.upsert({
      where: { channelId_userId: { channelId, userId: target.id } },
      create: { channelId, userId: target.id, role },
      update: { role },
      select: { role: true, user: { select: { id: true, email: true, name: true } } },
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error("Channel member update failed:", error);
    return apiError("Unable to add this channel member.", 500);
  }
}
export async function DELETE(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { channelId } = await context.params;
  const access = await getChannelAccess(channelId, user.id);
  if (!access) return apiError("Channel not found or access denied.", 404);
  if (access.members[0]?.role !== "OWNER") return apiError("Only the channel owner can remove members.", 403);
  const input = await readJsonObject(request);
  const targetId = typeof input?.userId === "string" ? input.userId : "";
  if (!targetId || targetId === user.id) return apiError("Provide another member's user ID. The owner cannot remove themselves.", 400);
  try {
    const target = await db.channelMember.findUnique({ where: { channelId_userId: { channelId, userId: targetId } } });
    if (!target) return apiError("Channel member not found.", 404);
    if (target.role === "OWNER") return apiError("The channel owner cannot be removed.", 409);
    await db.channelMember.delete({ where: { channelId_userId: { channelId, userId: targetId } } });
    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("Channel member removal failed:", error);
    return apiError("Unable to remove this channel member.", 500);
  }
}
