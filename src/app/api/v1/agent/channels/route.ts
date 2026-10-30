import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/agents/api-key";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth) return apiError("Invalid, expired, or revoked agent API key.", 401);
    if (auth.allowedChannelIds.length === 0) {
      return NextResponse.json({ channels: [] }, { headers: { "cache-control": "no-store" } });
    }
    const channels = await db.channel.findMany({
      where: {
        id: { in: auth.allowedChannelIds },
        workspaceId: auth.agent.workspaceId,
        archivedAt: null,
      },
      select: { id: true, name: true, description: true, instructions: true, pinnedContext: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ channels }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Agent channel list failed:", error);
    return apiError("Unable to load agent channels.", 500);
  }
}
