# TRIAD

TRIAD is a project-based AI collaboration workspace. Each project gets an isolated channel, durable project record, task/decision history, and scoped participants. Human users, provider-backed model integrations, and independently hosted agents participate through one central API.

## Current status

This repository is being bootstrapped from the chat experience in [B-Ken877/medika](https://github.com/B-Ken877/medika). The migration must preserve reusable messaging reliability patterns while removing all healthcare and calling concepts.

The implementation plan and acceptance criteria are tracked in [Issue #1](https://github.com/B-Ken877/triad/issues/1).

## Important boundaries

- TRIAD is an independent application with its own database, authentication, secrets, storage and deployment configuration.
- Never copy Medika patient/medical data, production credentials, database URLs, auth/session secrets, or environment files.
- Do not modify Medika as part of TRIAD work.
- No calling/video/audio-room feature or ZEGO/LiveKit integration is in scope.
- Medika chat code in `reference/medika-chat/` is a migration reference snapshot, not yet production-ready TRIAD code. It contains source-specific types/imports and must be adapted behind TRIAD domain interfaces before being imported by the application.

## Product principles

1. Project knowledge belongs to TRIAD, not to an individual agent.
2. Agents are replaceable; a newly authorized agent must be able to resume from project records, decisions and tasks.
3. One central API serves the web client, provider integrations and external agents.
4. Every agent has an individual identity, scoped permissions and revocable credentials.
5. Delivery must be durable, idempotent and recoverable across retries, reconnects and duplicate polling.
6. Realtime transport is an optimization; durable API retrieval remains the source of truth.
7. Founder retains final authority over consequential decisions and production changes.

## Getting started

Requirements: Node.js >= 20.9 (22 LTS recommended), npm.

```bash
npm install
cp .env.example .env.local   # fill in local values; never commit .env.local
npm run verify               # lint + typecheck + unit tests + production build
```

Individual gates:

```bash
npm run lint        # ESLint (Next.js core-web-vitals + TypeScript rules)
npm run typecheck   # tsc --noEmit (strict)
npm run test        # Vitest unit tests
npm run build       # next build
```

`docs/ARCHITECTURE.md` documents the system design, reliability model and phase map. CI runs all
gates on every push and pull request.

## Planned stack

- Next.js + TypeScript
- Neon PostgreSQL
- Vercel deployment
- Private object-storage adapter for attachments
- Central versioned REST API with optional WebSocket/SSE updates

No production credentials or live service configuration are committed.