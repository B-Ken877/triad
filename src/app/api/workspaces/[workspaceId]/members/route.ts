import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError, readJsonObject } from "@/lib/http";
import { getWorkspaceRole } from "@/lib/workspace/access";
type Context = { params: Promise<{ workspaceId: string }> };
export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { workspaceId } = await context.params;
  if (!await getWorkspaceRole(workspaceId, user.id)) return apiError("Workspace not found or access denied.", 404);
  try {
    const members = await db.workspaceMember.findMany({
      where: { workspaceId }, orderBy: { createdAt: "asc" },
      select: { role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ members }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Workspace members lookup failed:", error);
    return apiError("Unable to load workspace members.", 500);
  }
}
export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { workspaceId } = await context.params;
  const actorRole = await getWorkspaceRole(workspaceId, user.id);
  if (!actorRole || !["OWNER", "ADMIN"].includes(actorRole)) return apiError("You cannot manage workspace members.", 403);
  const input = await readJsonObject(request);
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  const role = input?.role === "ADMIN" ? "ADMIN" : input?.role === "MEMBER" || input?.role === undefined ? "MEMBER" : null;
  if (!email || email.length > 320 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !role) return apiError("Provide a valid email and a MEMBER or ADMIN role.", 400);
  if (role === "ADMIN" && actorRole !== "OWNER") return apiError("Only the workspace owner can appoint an admin.", 403);
  try {
    const target = await db.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
    if (!target) return apiError("That user must create a TRIAD account before being added.", 404);
    const member = await db.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId: target.id } },
      create: { workspaceId, userId: target.id, role },
      update: { role },
      select: { role: true, user: { select: { id: true, email: true, name: true } } },
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error("Workspace member update failed:", error);
    return apiError("Unable to add this workspace member.", 500);
  }
}
