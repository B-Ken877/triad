import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const KEY_PREFIX = "trd_live_";
export function createAgentApiKey() {
  const secret = randomBytes(32).toString("base64url");
  const token = KEY_PREFIX + secret;
  return { token, prefix: token.slice(0, 18), hash: createHash("sha256").update(token).digest("hex") };
}
export function hashAgentApiKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function authenticateAgent(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer (trd_live_[A-Za-z0-9_-]{32,})$/.exec(authorization);
  if (!match) return null;
  const token = match[1];
  if (!token) return null;
  const keyHash = hashAgentApiKey(token);
  const key = await db.agentApiKey.findUnique({
    where: { keyHash },
    include: { agent: { include: { channels: { select: { channelId: true } } } } },
  });
  if (!key || key.revokedAt || (key.expiresAt && key.expiresAt <= new Date()) || key.agent.status !== "ACTIVE") return null;
  await db.agentApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(error => {
    console.error("Agent API key last-used update failed:", error);
  });
  return { agent: key.agent, keyId: key.id, allowedChannelIds: key.agent.channels.map(item => item.channelId) };
}
