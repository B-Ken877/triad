import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError, isPrismaUniqueError, readJsonObject } from "@/lib/http";
import { getChannelAccess } from "@/lib/workspace/access";
type Context = { params: Promise<{ channelId: string }> };
export async function PATCH(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { channelId } = await context.params;
  const access = await getChannelAccess(channelId, user.id);
  if (!access) return apiError("Channel not found or access denied.", 404);
  const role = access.members[0]?.role;
  if (!role || !["OWNER", "MODERATOR"].includes(role)) return apiError("You cannot edit this channel.", 403);
  const input = await readJsonObject(request);
  if (!input) return apiError("A valid JSON object is required.", 400);
  const data: { name?: string; description?: string | null; instructions?: string | null; pinnedContext?: string | null; archivedAt?: Date } = {};
  if (input.name !== undefined) {
    if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 80) return apiError("Channel name must be between 2 and 80 characters.", 400);
    data.name = input.name.trim();
  }
  for (const field of ["description", "instructions", "pinnedContext"] as const) {
    if (input[field] !== undefined) {
      if (input[field] !== null && typeof input[field] !== "string") return apiError(field + " must be text or null.", 400);
      const value = input[field] as string | null;
      const max = field === "description" ? 500 : 12000;
      if (value && value.length > max) return apiError(field + " is too long.", 400);
      data[field] = value?.trim() || null;
    }
  }
  if (input.archive === true) {
    if (role !== "OWNER") return apiError("Only a channel owner can archive this channel.", 403);
    data.archivedAt = new Date();
  }
  if (Object.keys(data).length === 0) return apiError("No valid channel changes were provided.", 400);
  try {
    const channel = await db.channel.update({
      where: { id: channelId }, data,
      select: { id: true, name: true, description: true, instructions: true, pinnedContext: true, archivedAt: true, updatedAt: true },
    });
    return NextResponse.json({ channel });
  } catch (error) {
    if (isPrismaUniqueError(error)) return apiError("A channel with that name already exists.", 409);
    console.error("Channel update failed:", error);
    return apiError("Unable to update this channel.", 500);
  }
}
