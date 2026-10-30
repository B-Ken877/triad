import { NextRequest, NextResponse } from "next/server";
import { getNeonAuthBaseUrl } from "@/lib/auth/server";
const ALLOWED_PATHS = new Set(["sign-in/email", "sign-up/email", "sign-out", "get-session"]);
async function proxyAuth(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const endpointPath = path.join("/");
  if (!ALLOWED_PATHS.has(endpointPath)) return NextResponse.json({ error: "Authentication endpoint not allowed." }, { status: 404 });
  const method = endpointPath === "get-session" ? "GET" : "POST";
  if (request.method !== method) return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
  // Prevent cross-site login CSRF; browser POST requests must originate at TRIAD.
  if (method === "POST" && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const base = getNeonAuthBaseUrl();
    const target = new URL(endpointPath, base.toString().replace(/\/$/, "") + "/");
    // Match Neon's supported proxy contract: preserve the browser origin,
    // but do not forward x-forwarded-host/proto. Those headers can override
    // Better Auth's upstream hostname resolution and trigger "Invalid hostname header".
    const headers = new Headers({
      accept: "application/json",
      origin: request.headers.get("origin") ?? request.nextUrl.origin,
      "x-neon-auth-middleware": "true",
    });
    const cookie = request.headers.get("cookie");
    const contentType = request.headers.get("content-type");
    if (cookie) headers.set("cookie", cookie);
    if (contentType) headers.set("content-type", contentType);
    const upstream = await fetch(target, {
      method: request.method, headers,
      body: request.method === "GET" ? undefined : await request.arrayBuffer(),
      cache: "no-store", redirect: "manual",
    });
    const responseHeaders = new Headers();
    const type = upstream.headers.get("content-type");
    if (type) responseHeaders.set("content-type", type);
    responseHeaders.set("cache-control", "no-store");
    for (const value of upstream.headers.getSetCookie()) {
      let cookieValue = value.replace(/;\s*Domain=[^;]*/i, "");
      cookieValue = /;\s*Path=/i.test(cookieValue)
        ? cookieValue.replace(/;\s*Path=[^;]*/i, "; Path=/")
        : cookieValue + "; Path=/";
      responseHeaders.append("set-cookie", cookieValue);
    }
    const location = upstream.headers.get("location");
    if (location) responseHeaders.set("location", location);
    return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    console.error("Neon Auth proxy failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Authentication service is temporarily unavailable." }, { status: 503 });
  }
}
export const GET = proxyAuth;
export const POST = proxyAuth;
