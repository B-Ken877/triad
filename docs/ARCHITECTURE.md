# TRIAD architecture

Status: living document, updated as phases land. Requirements live in [Issue #1](https://github.com/B-Ken877/triad/issues/1).

## 1. System overview

TRIAD is a multi-project AI collaboration workspace. One central Next.js application serves:

- the web client (human participants),
- provider-backed model integrations invoked server-side,
- independently running external agents that authenticate against the same central API.

Each project (workspace "channel") is an isolated conversation with its own participants, access
policy, durable project record, task/decision history and activity feed. Project knowledge belongs
to TRIAD, not to any individual agent: agents are replaceable and onboard from the current record
plus authorized history.

## 2. Repository layout (Phase 1)

```
src/app/            Next.js App Router (UI + route handlers in later phases)
src/lib/            Domain-neutral libraries, framework-free where possible
  lib/chat/           Messaging reliability primitives (pending state machine, reconciliation)
prisma/             Schema + migrations (models arrive with the Workspace MVP phase)
docs/               Architecture and migration documentation
reference/          Read-only Medika chat audit snapshots — NEVER imported by app code
```

Rules:

- `reference/**` is excluded from lint/format and must never be imported by `src/`. It preserves
  the audited Medika logic so adaptation stays traceable.
- Application code depends on explicit TRIAD domain types, not on Medika types.

## 3. Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript strict | One deployable on Vercel |
| Database | PostgreSQL (Neon) via Prisma | Server-side access only |
| Tests | Vitest | Pure reliability logic is framework-free and unit-tested |
| Gates | ESLint, `tsc --noEmit`, Vitest, `next build` | Enforced locally and in CI |
| Attachments | Private object storage behind an adapter | Never stored in Postgres; signed short-lived URLs |
| Realtime | Optional WebSocket/SSE enhancement | REST/polling remains the reliable fallback and source of truth |

## 4. Reliability model (from the Medika audit)

The audited Medika chat proves a specific delivery trust model, which TRIAD adopts as its
messaging contract:

1. **Optimistic sends stay visibly pending until persistence is confirmed.** A transport write
   succeeding (WS frame buffered) is NOT proof of persistence.
2. **Two acceptable persistence signals:** a persisted echo carrying the sender's `clientMsgId`
   (emitted only after the server-side insert), or the REST response carrying the persisted row.
3. **Idempotent retries:** a logical send keeps one `clientMsgId` for its whole life. The server
   enforces `(senderId, clientMsgId)` uniqueness, so a retry after a lost-but-persisted frame
   returns the original row instead of creating a duplicate.
4. **Client reconciliation is pure and testable:** the pending state machine
   (`src/lib/chat/pending.ts`) and merge helpers (`src/lib/chat/reconcile.ts`) are framework-free
   functions with focused unit tests — ported from `reference/medika-chat/` with consultation,
   calling and medical concepts removed.

Later phases extend this contract server-side: cursor pagination with stable ordering, inbox
claim/lease/ack semantics for concurrent agent workers (a cursor never advances before work is
durably accepted), and retry/backoff with dead-letter visibility.

## 5. Security posture (non-negotiable)

- TRIAD has its own database, auth, secrets, storage namespace and deployment config. No Medika
  production data, credentials, database URLs, auth/session secrets or environment values are ever
  copied.
- All authorization happens server-side per channel/message/task/record/attachment. Client-supplied
  permissions are never trusted (IDOR defense).
- Provider API keys and agent credentials are stored server-side, never returned after creation,
  revocable, rotatable and audited.
- No calling/video infrastructure (ZEGO/LiveKit), no prescription or medical workflow.
- Production-changing or destructive actions require explicit founder approval.

## 6. Phase map

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Repository foundation: scaffold, gates, env example, architecture docs | Done (this document, scaffold, CI) |
| 2 | Medika chat extraction: domain-neutral UI + reliability utilities with tests | Started (`src/lib/chat/`), continues next |
| 3 | Workspace MVP: auth, founder workspace, channel CRUD, membership, channel chat | Pending |
| 4 | Reliable messaging: durable persistence, idempotency, pagination, receipts, presence | Pending |
| 5 | Project records: append-only events, canonical Markdown, versioning, onboarding | Pending |
| 6 | Agent API: registry, scoped credentials, inbox leases, heartbeat, revocation | Pending |
| 7 | Integrations: provider adapters, external-agent onboarding | Pending |
| 8 | Hardening and deployment: security/concurrency tests, observability, Vercel + Neon | Pending |

## 7. Known limitations (Phase 1)

- No application features yet: home page is a static status page.
- Prisma schema has no models by design; the data model lands with the Workspace MVP phase.
- No auth, no realtime transport, no storage adapter yet.
- CI runs lint/typecheck/tests/build; integration tests against a real Postgres arrive with the
  data model (Phase 3).
