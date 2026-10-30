import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/agents/api-key";
import { apiError } from "@/lib/http";
export async function GET(request: Request) {
  try {
    const auth = await authenticateAgent(request);
    if (!auth) return apiError("Invalid, expired, or revoked agent API key.", 401);
    return NextResponse.json({ agent: { id: auth.agent.id, name: auth.agent.name, workspaceId: auth.agent.workspaceId, status: auth.agent.status }, allowedChannelIds: auth.allowedChannelIds }, { headers: { "cache-control": "no-store" } });
  } catch (error) { console.error("Agent token introspection failed:", error); return apiError("Unable to authenticate agent.", 500); }
}
