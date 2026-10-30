import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { getOrCreateWorkspace } from "@/lib/workspace/access";
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  try {
    const workspace = await getOrCreateWorkspace(user);
    const channels = await db.channel.findMany({
      where: { workspaceId: workspace.id, archivedAt: null, members: { some: { userId: user.id } } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, description: true, updatedAt: true },
    });
    return NextResponse.json({ workspace: { id: workspace.id, name: workspace.name, role: "OWNER" }, channels }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Workspace load failed:", error);
    return apiError("Unable to load the workspace. Please retry.", 500);
  }
}
