import { db } from "@/lib/db";
import type { AuthenticatedUser } from "@/lib/auth/server";
export async function syncUser(user: AuthenticatedUser) {
  return db.user.upsert({
    where: { id: user.id },
    create: { id: user.id, email: user.email.toLowerCase(), name: user.name },
    update: { email: user.email.toLowerCase(), name: user.name },
  });
}
export async function getOrCreateWorkspace(user: AuthenticatedUser) {
  await syncUser(user);
  const existing = await db.workspace.findFirst({
    where: { members: { some: { userId: user.id } } }, include: { members: true },
  });
  if (existing) return existing;
  try {
    return await db.workspace.create({
      data: { name: "My Workspace", ownerId: user.id, members: { create: { userId: user.id, role: "OWNER" } } },
      include: { members: true },
    });
  } catch (error) {
    const raced = await db.workspace.findUnique({ where: { ownerId: user.id }, include: { members: true } });
    if (raced) return raced;
    throw error;
  }
}
export async function getWorkspaceRole(workspaceId: string, userId: string) {
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } }, select: { role: true },
  });
  return membership?.role ?? null;
}
export async function getChannelAccess(channelId: string, userId: string) {
  return db.channel.findFirst({
    where: {
      id: channelId, archivedAt: null,
      workspace: { members: { some: { userId } } },
      members: { some: { userId } },
    },
    include: { members: { where: { userId }, select: { role: true } }, workspace: { select: { id: true } } },
  });
}
