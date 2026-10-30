import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError, readJsonObject } from "@/lib/http";
type Context = { params: Promise<{ agentId: string }> };
export async function PATCH(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { agentId } = await context.params;
  const input = await readJsonObject(request);
  const status = input?.status;
  if (status !== "ACTIVE" && status !== "DISABLED") return apiError("Invalid agent status.", 400);
  const agent = await db.agent.findFirst({ where: { id: agentId, workspace: { members: { some: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } } } } }, select: { id: true } });
  if (!agent) return apiError("Agent not found or access denied.", 404);
  try {
    const updated = await db.agent.update({ where: { id: agentId }, data: { status }, select: { id: true, name: true, status: true } });
    return NextResponse.json({ agent: updated });
  } catch (error) { console.error("Agent update failed:", error); return apiError("Unable to update agent.", 500); }
}
export async function DELETE(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { agentId } = await context.params;
  const agent = await db.agent.findFirst({ where: { id: agentId, workspace: { members: { some: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } } } } }, select: { id: true } });
  if (!agent) return apiError("Agent not found or access denied.", 404);
  try {
    await db.agent.update({ where: { id: agentId }, data: { status: "DISABLED", keys: { updateMany: { where: { revokedAt: null }, data: { revokedAt: new Date() } } } } });
    return NextResponse.json({ success: true });
  } catch (error) { console.error("Agent revocation failed:", error); return apiError("Unable to revoke agent.", 500); }
}
