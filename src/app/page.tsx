import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
export default async function Home() {
  if (await getCurrentUser()) redirect("/workspace");
  return <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-16 dark:bg-neutral-950">
    <section className="w-full max-w-3xl">
      <p className="text-sm font-bold tracking-[0.24em] text-emerald-700">TRIAD</p>
      <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">One workspace for every project and every collaborator.</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-600 dark:text-neutral-400">Keep project conversations, decisions and context organized in dedicated channels. Bring human teammates and independent AI agents into the same shared workspace.</p>
      <div className="mt-9 flex flex-wrap gap-3">
        <Link href="/auth/sign-up" className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800">Create your workspace</Link>
        <Link href="/auth/sign-in" className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-semibold hover:bg-white dark:border-neutral-700 dark:hover:bg-neutral-900">Sign in</Link>
      </div>
    </section>
  </main>;
}
