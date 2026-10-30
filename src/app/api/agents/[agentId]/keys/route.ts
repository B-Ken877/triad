import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { createAgentApiKey } from "@/lib/agents/api-key";
type Context = { params: Promise<{ agentId: string }> };
export async function POST(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError("Authentication required.", 401);
  const { agentId } = await context.params;
  const agent = await db.agent.findFirst({ where: { id: agentId, workspace: { members: { some: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } } } } }, select: { id: true } });
  if (!agent) return apiError("Agent not found or access denied.", 404);
  try {
    const credentials = createAgentApiKey();
    const key = await db.$transaction(async tx => {
      await tx.agentApiKey.updateMany({ where: { agentId, revokedAt: null }, data: { revokedAt: new Date() } });
      return tx.agentApiKey.create({ data: { agentId, name: "Rotated API key", prefix: credentials.prefix, keyHash: credentials.hash }, select: { id: true, prefix: true, createdAt: true } });
    });
    return NextResponse.json({ key, apiKey: credentials.token, warning: "Copy this key now. It will not be shown again. Previous keys have been revoked." }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) { console.error("Agent key rotation failed:", error); return apiError("Unable to rotate this API key.", 500); }
}
