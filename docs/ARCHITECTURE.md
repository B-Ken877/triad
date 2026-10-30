# TRIAD architecture

Status: living document, updated as phases land. Requirements live in [Issue #1](https://github.com/B-Ken877/triad/issues/1).

## System overview
TRIAD is a multi-project collaboration workspace. The Next.js application serves human participants and later provider-backed / independently hosted agents. Each project is an isolated channel with scoped membership and conversation history.

## Stack
- Next.js 16 App Router + strict TypeScript, deployed on Vercel.
- Neon PostgreSQL via Prisma; all database access is server-side.
- Neon Managed Auth (Better Auth) is the identity provider. A same-origin server proxy exposes only email sign-in, sign-up, sign-out and session lookup; the upstream service owns password handling and session validation.
- Vitest, ESLint, TypeScript and production build gates.
- Reusable chat UI and reliability primitives in \`src/components/chat\` and \`src/lib/chat\`.

## Phase 3 domain model
- \`User\` mirrors the stable user ID, email and display name from Neon Managed Auth. Passwords and auth sessions are never stored in TRIAD tables.
- A \`Workspace\` has one owner and workspace memberships with \`OWNER\`, \`ADMIN\`, or \`MEMBER\` roles.
- A \`Channel\` is a project conversation scoped to a workspace. Channel membership is explicit and uses \`OWNER\`, \`MODERATOR\`, or \`MEMBER\`.
- \`Message\` belongs to exactly one channel and sender. Ordering is deterministic by \`(createdAt, id)\`. A nullable \`(senderId, clientMsgId)\` unique key reserves the client identity for Phase 4 idempotency.
- Archiving is a soft state: channel messages and membership remain persisted.

## Authorization invariants
1. Every workspace API checks the caller's authenticated Neon session and a matching \`WorkspaceMember\` row.
2. Channel reads and writes require both workspace membership and explicit channel membership. The server never trusts a client-supplied role.
3. Channel metadata edits require \`OWNER\` or \`MODERATOR\`; only a channel \`OWNER\` may archive.
4. Workspace channel creation requires workspace \`OWNER\` or \`ADMIN\`; creator receives channel \`OWNER\`.
5. Message queries are scoped by the authorized channel ID; changing an ID does not grant access.
6. Auth cookies are proxied to the TRIAD origin; the upstream auth service remains the authority for session validity. Auth endpoint proxy paths are allow-listed and POST requests require a same-origin Origin header.

## Data and deployment safety
- Use only the TRIAD Neon project and the isolated \`triad-phase3-dev\` branch for development migration validation.
- Do not reuse Medika data, database URLs, credentials, auth secrets or storage.
- Run migrations against a disposable development branch before any production migration.
- No agent registry, agent credentials, realtime transport, attachment storage, calling/video, or healthcare domain logic in Phase 3.

## Phase map
| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Repository foundation | Complete |
| 2 | Domain-neutral chat extraction and UI foundations | Complete |
| 3 | Authenticated workspace, project channels, memberships and persisted chat | In progress |
| 4 | Reliable messaging, idempotency, pagination, receipts and presence | Pending |
| 5 | Versioned project records and durable institutional memory | Pending |
| 6 | Agent registry, scoped credentials and durable inbox API | Pending |
| 7 | Provider and external-agent integrations | Pending |
| 8 | Security, operations, recovery and production readiness | Pending |

## Known Phase 3 limitations
- Message history is capped at the latest 100 rows; cursor pagination and robust server-side idempotent retries are Phase 4.
- Presence, typing, receipts and realtime delivery are not wired to the new database yet.
- The first workspace is provisioned automatically for a user's first authenticated visit. Workspace/channel member administration is API-only in this initial UI.
- Neon Auth email verification, trusted origins and production custom SMTP settings must be confirmed before broad beta access.
