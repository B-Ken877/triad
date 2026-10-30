"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail, signUpWithEmail } from "@/lib/auth/client";
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(""); setBusy(true);
    const result = mode === "sign-up"
      ? await signUpWithEmail(name.trim(), email.trim(), password)
      : await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (!result.ok) { setError(result.message ?? "Authentication failed. Please try again."); return; }
    router.replace("/workspace"); router.refresh();
  }
  const inputClass = "mt-1.5 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 dark:border-neutral-700 dark:bg-neutral-950";
  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      {mode === "sign-up" && <label className="block text-sm font-medium">Name
        <input value={name} onChange={e => setName(e.target.value)} required maxLength={160} autoComplete="name" className={inputClass} />
      </label>}
      <label className="block text-sm font-medium">Email
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={320} autoComplete="email" className={inputClass} />
      </label>
      <label className="block text-sm font-medium">Password
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} className={inputClass} />
      </label>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">{busy ? "Please wait…" : mode === "sign-up" ? "Create account" : "Sign in"}</button>
    </form>
  );
}
