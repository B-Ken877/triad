import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { AuthForm } from "../AuthForm";
export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/workspace");
  return <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-5 py-12 dark:bg-neutral-950">
    <section className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <Link href="/" className="text-sm font-semibold tracking-[0.2em] text-emerald-700">TRIAD</Link>
      <h1 className="mt-7 text-2xl font-semibold">Create your account</h1>
      <p className="mt-2 text-sm text-neutral-500">Your projects, conversations and decisions in one place.</p>
      <AuthForm mode="sign-up" />
      <p className="mt-6 text-center text-sm text-neutral-500">Already have an account? <Link className="font-semibold text-emerald-700 hover:underline" href="/auth/sign-in">Sign in</Link></p>
    </section>
  </main>;
}
