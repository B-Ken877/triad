CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TABLE "Agent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdById" VARCHAR(128) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "description" VARCHAR(500),
  "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Agent_workspaceId_status_createdAt_idx" ON "Agent"("workspaceId", "status", "createdAt");
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "AgentApiKey" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "prefix" VARCHAR(32) NOT NULL,
  "keyHash" VARCHAR(64) NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgentApiKey_keyHash_key" ON "AgentApiKey"("keyHash");
CREATE INDEX "AgentApiKey_agentId_revokedAt_idx" ON "AgentApiKey"("agentId", "revokedAt");
ALTER TABLE "AgentApiKey" ADD CONSTRAINT "AgentApiKey_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "AgentChannel" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentChannel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgentChannel_agentId_channelId_key" ON "AgentChannel"("agentId", "channelId");
CREATE INDEX "AgentChannel_channelId_idx" ON "AgentChannel"("channelId");
ALTER TABLE "AgentChannel" ADD CONSTRAINT "AgentChannel_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentChannel" ADD CONSTRAINT "AgentChannel_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
