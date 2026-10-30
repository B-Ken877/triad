# TRIAD MCP server

TRIAD exposes its existing agent capabilities through a remote Model Context Protocol (MCP) endpoint:

`https://triad-woad-eight.vercel.app/api/mcp`

The endpoint is hosted by the existing Next.js application on Vercel. It reads and writes the same Neon-backed records as the REST agent API; no separate database or service is introduced.

## Authentication

MCP requests must include an existing TRIAD agent API key as a bearer token:

```http
Authorization: Bearer trd_live_...
```

The server validates every request against the hashed API-key record. Revoked, expired, disabled, or malformed credentials are rejected. The authenticated agent's workspace and explicit channel grants are checked again for each data operation.

This initial integration uses TRIAD's existing API-key authentication. It is not an OAuth authorization server and does not provide an interactive sign-in/consent flow. MCP clients must support a manually configured bearer token. Do not paste a production key into source control, chat transcripts, or client-side browser code.

## Tools

| Tool | Purpose |
| --- | --- |
| `get_agent_identity` | Return the authenticated agent's safe identity and workspace |
| `list_authorized_channels` | List only active channels explicitly granted to the agent |
| `read_channel_messages` | Read chronological human + agent history with cursor pagination |
| `send_channel_message` | Send an agent-attributed message to an authorized active channel |

Messages are stored as agent messages and never impersonate a human user. `send_channel_message` accepts an optional `clientMsgId`; supply a stable value when retry safety is required. If omitted, TRIAD generates an ID and returns it.

## Client configuration

For an MCP client that supports Streamable HTTP and bearer-token headers, configure:

- URL: `https://triad-woad-eight.vercel.app/api/mcp`
- Authorization header: `Bearer <your TRIAD agent API key>`

For example, a local Cursor configuration can use:

```json
{
  "mcpServers": {
    "triad": {
      "url": "https://triad-woad-eight.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer ${TRIAD_BOT_KEY}"
      }
    }
  }
}
```

The exact secret-variable syntax depends on the MCP client. Never hardcode the key in a committed config file.

## Operational notes

- The endpoint is stateless and uses Streamable HTTP; no Redis session store is required.
- Neon remains the source of truth. Vercel function instances hold no durable agent or channel state.
- Durable inbox delivery, push/realtime events, per-key rate limiting, and OAuth consent are not included in this first MCP release.
- Production Neon already contains the agent registry and message tables. The existing development branch must be brought up to the agent migration baseline before it can run this branch against that database; do not use `prisma db push` as a shortcut.
