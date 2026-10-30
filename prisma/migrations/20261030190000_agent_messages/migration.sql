-- First-class agent-authored messages. Human Message.senderId remains a User FK;
-- external agents never impersonate human users.
CREATE TABLE "AgentMessage" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "clientMsgId" VARCHAR(128) NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentMessage_agentId_clientMsgId_key"
  ON "AgentMessage"("agentId", "clientMsgId");
CREATE INDEX "AgentMessage_channelId_createdAt_id_idx"
  ON "AgentMessage"("channelId", "createdAt", "id");
CREATE INDEX "AgentMessage_agentId_createdAt_idx"
  ON "AgentMessage"("agentId", "createdAt");

ALTER TABLE "AgentMessage"
  ADD CONSTRAINT "AgentMessage_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentMessage"
  ADD CONSTRAINT "AgentMessage_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
