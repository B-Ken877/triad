# Agent registry and API keys

This feature adds workspace-scoped agent registration. Workspace owners and admins can open **AI Agents** in the workspace sidebar, register a bot, and grant access to one or more active project channels.

## Credential behavior

- TRIAD generates a random `trd_live_` bearer token using Node's cryptographic random generator.
- Only a SHA-256 hash and a short display prefix are stored in Postgres. The full token is returned once at creation or rotation and cannot be retrieved later.
- Rotating a key revokes all previous active keys for that agent.
- Disabling an agent blocks authentication. Revoking an agent disables it and revokes all of its keys.
- API keys are never returned by the agent-list endpoint.
- Keep keys in a secret manager or environment variable. Never commit them to source control or expose them in browser code.

## Current agent API

Authenticate with:

```http
Authorization: Bearer trd_live_...
```

Validate a credential and retrieve its agent identity and allowed channel IDs:

```http
GET /api/v1/agent
```

A revoked, expired, disabled, or malformed credential receives `401`. The endpoint returns only the agent identity, workspace ID, status, and explicitly granted channel IDs.

## Management endpoints

- `GET /api/workspaces/:workspaceId/agents` — list agents and safe key metadata.
- `POST /api/workspaces/:workspaceId/agents` — create an agent and issue its first key. Requires owner/admin.
- `PATCH /api/agents/:agentId` — enable or disable an agent. Requires owner/admin.
- `POST /api/agents/:agentId/keys` — rotate its key; all previous active keys are revoked. Requires owner/admin.
- `DELETE /api/agents/:agentId` — disable the agent and revoke all keys. Requires owner/admin.

The first iteration provides registration, scoped credential issuance, key lifecycle management, and bearer-token authentication/introspection. Agent channel read/write operations, durable inbox delivery, and message attribution are intentionally separate follow-up work; an agent cannot impersonate a human user through the existing chat API.

## Database

Apply the additive migration `20261030180000_agent_registry_api_keys` to the isolated TRIAD development Neon branch first. Do not use `prisma db push`. Production migration must wait for an explicit release decision and a verified migration-state check.
