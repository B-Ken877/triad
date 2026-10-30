const phases = [
  {
    id: 1,
    title: "Repository foundation",
    detail:
      "Next.js + TypeScript scaffold, lint/typecheck/test/build gates, safe environment example, architecture documentation.",
    done: true,
  },
  {
    id: 2,
    title: "Medika chat extraction",
    detail:
      "Port domain-neutral UI and pure reliability utilities from the reference snapshot; remove clinical and calling concepts; add focused tests.",
    done: false,
  },
  {
    id: 3,
    title: "Workspace MVP",
    detail: "Auth, founder workspace, project/channel CRUD, membership and channel chat.",
    done: false,
  },
  {
    id: 4,
    title: "Reliable messaging",
    detail:
      "Durable persistence, idempotent sends, optimistic reconciliation, pagination, receipts, typing/presence, retry and reconnect.",
    done: false,
  },
  {
    id: 5,
    title: "Project records",
    detail:
      "Append-only progress events, canonical Markdown view/export, versioning and onboarding context.",
    done: false,
  },
  {
    id: 6,
    title: "Agent API",
    detail:
      "Registry, scoped credentials, inbox leases/cursors, message/task/record APIs, heartbeat and revocation.",
    done: false,
  },
  {
    id: 7,
    title: "Integrations",
    detail:
      "Provider/model API adapters and external-agent onboarding; end-to-end test with an external agent.",
    done: false,
  },
  {
    id: 8,
    title: "Hardening and deployment",
    detail:
      "Security/concurrency tests, observability, backup/restore, Vercel + Neon deployment, manual acceptance testing.",
    done: false,
  },
];

export default function Home() {
  return (
    <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-12 sm:py-16">
      <header className="mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">TRIAD</h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl">
          A multi-project AI collaboration workspace. Each project gets an isolated channel, a
          durable project record, task and decision history, and scoped participants — humans,
          provider-backed model integrations and independently hosted agents — through one central
          API.
        </p>
      </header>

      <section aria-labelledby="status-heading" className="mb-12">
        <h2 id="status-heading" className="text-xl font-semibold mb-4">
          Build status
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          The repository is bootstrapped from the Medika chat audit. Implementation is tracked in{" "}
          <a
            className="underline underline-offset-4 hover:text-neutral-900 dark:hover:text-neutral-200"
            href="https://github.com/B-Ken877/triad/issues/1"
          >
            Issue #1
          </a>
          . No production credentials or live service configuration are committed.
        </p>
      </section>

      <section aria-labelledby="phases-heading">
        <h2 id="phases-heading" className="text-xl font-semibold mb-4">
          Delivery phases
        </h2>
        <ol className="space-y-3">
          {phases.map((phase) => (
            <li
              key={phase.id}
              className="flex gap-4 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800"
            >
              <span
                aria-label={phase.done ? "Phase complete" : "Phase pending"}
                className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  phase.done
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                }`}
              >
                {phase.id}
              </span>
              <div>
                <p className="font-medium">{phase.title}</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {phase.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
