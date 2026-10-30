import { cookies } from "next/headers";
export interface AuthenticatedUser { id: string; email: string; name: string | null; }
interface AuthPayload {
  user?: { id?: unknown; email?: unknown; name?: unknown };
  data?: { user?: { id?: unknown; email?: unknown; name?: unknown } };
}
export function getNeonAuthBaseUrl(): URL {
  const configured = process.env.NEON_AUTH_BASE_URL;
  if (!configured) throw new Error("NEON_AUTH_BASE_URL is not configured.");
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !url.hostname.endsWith(".neon.tech") || !url.hostname.includes(".neonauth.")) {
    throw new Error("NEON_AUTH_BASE_URL must be a valid Neon Auth HTTPS URL.");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(({ name, value }) => name + "=" + value).join("; ");
  if (!cookieHeader) return null;
  try {
    const endpoint = new URL("get-session", getNeonAuthBaseUrl().toString().replace(/\/$/, "") + "/");
    const response = await fetch(endpoint, {
      method: "GET", headers: { cookie: cookieHeader, accept: "application/json" },
      cache: "no-store", redirect: "error",
    });
    if (!response.ok) return null;
    const payload = await response.json() as AuthPayload;
    const user = payload.user ?? payload.data?.user;
    if (typeof user?.id !== "string" || typeof user.email !== "string") return null;
    return { id: user.id, email: user.email, name: typeof user.name === "string" ? user.name : null };
  } catch (error) {
    console.error("Neon Auth session lookup failed:", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}
