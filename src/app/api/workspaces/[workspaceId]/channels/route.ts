import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError, isPrismaUniqueError, readJsonObject } from "@/lib/http";
import { syncUser, getWorkspaceRole } from "@/lib/workspace/access";
type Context = { params: Promise<{ workspaceId: string }> };
export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { workspaceId } = await context.params;
  try {
    const role = await getWorkspaceRole(workspaceId, user.id);
    if (!role) return apiError("You do not have access to this workspace.", 403);
    const channels = await db.channel.findMany({
      where: { workspaceId, archivedAt: null, members: { some: { userId: user.id } } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true, instructions: true, pinnedContext: true, updatedAt: true,
        members: { where: { userId: user.id }, select: { role: true } },
      },
    });
    return NextResponse.json({ channels: channels.map(({ members, ...channel }) => ({ ...channel, role: members[0]?.role ?? "MEMBER" })) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Channel list failed:", error);
    return apiError("Unable to load channels.", 500);
  }
}
export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { workspaceId } = await context.params;
  const input = await readJsonObject(request);
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  if (name.length < 2 || name.length > 80) return apiError("Channel name must be between 2 and 80 characters.", 400);
  if (description.length > 500) return apiError("Description must be 500 characters or fewer.", 400);
  try {
    const role = await getWorkspaceRole(workspaceId, user.id);
    if (!role || !["OWNER", "ADMIN"].includes(role)) return apiError("You cannot create channels in this workspace.", 403);
    const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } });
    if (!workspace) return apiError("Workspace not found.", 404);
    await syncUser(user);
    const ownerIds = Array.from(new Set([user.id, workspace.ownerId]));
    const channel = await db.channel.create({
      data: {
        workspaceId, name, description: description || null, createdById: user.id,
        members: { create: ownerIds.map(userId => ({ userId, role: "OWNER" as const })) },
      },
      select: { id: true, name: true, description: true, updatedAt: true },
    });
    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    if (isPrismaUniqueError(error)) return apiError("A channel with that name already exists.", 409);
    console.error("Channel creation failed:", error);
    return apiError("Unable to create the channel.", 500);
  }
}
