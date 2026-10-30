"use client";
export interface AuthResult { ok: boolean; message?: string; }
async function authRequest(path: string, body?: Record<string, string>): Promise<AuthResult> {
  try {
    const response = await fetch("/api/auth/" + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin", cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as {
      message?: string; error?: string | { message?: string };
    };
    if (!response.ok) {
      const message = typeof payload.error === "string" ? payload.error : payload.error?.message ?? payload.message ?? "Authentication failed.";
      return { ok: false, message };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not reach the authentication service. Please try again." };
  }
}
export const signInWithEmail = (email: string, password: string) => authRequest("sign-in/email", { email, password });
export const signUpWithEmail = (name: string, email: string, password: string) => authRequest("sign-up/email", { name, email, password });
export const signOut = () => authRequest("sign-out");
