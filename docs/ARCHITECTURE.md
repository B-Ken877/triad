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

## 2. Repository layout (Phase 2)

```
src/app/            Next.js App Router (UI + route handlers in later phases)
src/lib/            Domain-neutral libraries, framework-free where possible
  lib/chat/           Messaging reliability primitives
                      pending.ts        optimistic pending state machine
                      reconcile.ts      persisted-echo wait + duplicate-free merge
                      client-msg-id.ts  one id per logical send
                      receipts.ts       read-receipt derivation from persisted markers
                      typing.ts         typing throttle/expiry/disconnect tracking
                      presence.ts       heartbeat presence/last-seen derivation
                      scroll.ts         pure scroll math (stick/prepend-anchor/resize)
                      timeline.ts       deterministic ordering + day grouping
src/components/chat/  Reusable chat UI foundations (bubble, list, composer,
                      status surfaces, typing indicator, scroll hook)
prisma/             Schema + migrations (models arrive with the Workspace MVP phase)
docs/               Architecture and migration documentation
reference/          Read-only Medika chat audit snapshots — NEVER imported by app code
tests/              Vitest setup (jest-dom matchers)
```

Rules:

- `reference/**` is excluded from lint/format/typecheck and must never be imported by `src/`. It
  preserves the audited Medika logic so adaptation stays traceable.
- Application code depends on explicit TRIAD domain types, not on Medika types.
- Reliability utilities are pure or dependency-injected (clock, subscribe fn, formatters) so they
  are testable without a browser and transport-agnostic.

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

   **Attachment retry contract (issue #3):** an attachment entry is retryable when the send frame
   can be reconstructed without re-asking the user — i.e. the in-memory `fileRef` exists OR the
   completed upload is referenced by `attachmentRef` (retry re-sends against the existing
   attachment, never a second upload). With neither reference the payload is gone; the UI surfaces
   the entry as failed for manual re-attach.

5. **Receipts, typing and presence derive from persisted/heartbeat state with expiry:**
   - Receipts (`receipts.ts`): participants carry monotonic `lastDeliveredSeq`/`lastReadSeq`
     markers; a sent message is `read` when every other participant read past it, `delivered`
     when all durably received it, else `sent`. Markers never regress (stale/duplicate events are
     ignored; read implies delivered).
   - Typing (`typing.ts`): outbound signals are throttled to one per window; inbound states expire
     by TTL, stale events never regress state, and a transport disconnect clears everything and
     pins a staleness floor so pre-disconnect duplicates cannot resurrect indicators.
   - Presence (`presence.ts`): `online` requires a heartbeat inside the online window (recent
     authenticated activity, not mere registration); `lastSeen` never regresses; disconnect
     derives offline immediately without fabricating timestamps.
   - Scroll math (`scroll.ts`): bottom-stickiness, prepend anchoring for history pagination and
     late-content-resize compensation are pure functions; `useChatScroll` only binds them to DOM
     refs.

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
| 1 | Repository foundation: scaffold, gates, env example, architecture docs | Done (merged via PR #2) |
| 2 | Medika chat extraction: domain-neutral UI + reliability utilities with tests | Delivered via the Phase 2 PR (receipts/typing/presence/scroll/timeline utilities, attachment-retry contract fix, chat UI foundations with component tests) |
| 3 | Workspace MVP: auth, founder workspace, channel CRUD, membership, channel chat | Pending |
| 4 | Reliable messaging: durable persistence, idempotency, pagination, receipts, presence | Pending — server-side persistence and pagination; the client-side contracts above are ready to bind to it |
| 5 | Project records: append-only events, canonical Markdown, versioning, onboarding | Pending |
| 6 | Agent API: registry, scoped credentials, inbox leases, heartbeat, revocation | Pending |
| 7 | Integrations: provider adapters, external-agent onboarding | Pending |
| 8 | Hardening and deployment: security/concurrency tests, observability, Vercel + Neon | Pending |

## 7. Known limitations (Phase 2)

- The chat UI foundations are not yet composed into a live channel page: no persistence, auth,
  routes or realtime transport — intentionally deferred to phases 3–4.
- Component tests run under jsdom, which implements no layout engine: scroll geometry behaviors
  are covered as pure functions in `lib/chat/scroll.ts` tests; `useChatScroll` DOM binding is
  exercised only to the extent jsdom allows (scrollIntoView guarded).
- No database schema yet; `prisma/schema.prisma` is a toolchain placeholder until the Workspace
  MVP designs the data model with migrations.
- Presence/typing TTLs and thresholds are constants at the call site; tuning and server-side
  enforcement arrive with the messaging phases.
