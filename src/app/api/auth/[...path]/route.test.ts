import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getNeonAuthBaseUrl: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getNeonAuthBaseUrl: mocks.getNeonAuthBaseUrl }));
import { POST } from "./route";
describe("Neon Auth same-origin proxy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getNeonAuthBaseUrl.mockReturnValue(new URL("https://auth.neonauth.us-east-1.aws.neon.tech/neondb/auth"));
  });
  it("rejects an unlisted auth path", async () => {
    const request = new NextRequest("https://triad.test/api/auth/other", { method: "POST", headers: { origin: "https://triad.test" }, body: "{}" });
    const response = await POST(request, { params: Promise.resolve({ path: ["other"] }) });
    expect(response.status).toBe(404);
  });
  it("rejects cross-origin POSTs before contacting Neon Auth", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const request = new NextRequest("https://triad.test/api/auth/sign-in/email", { method: "POST", headers: { origin: "https://outside.test" }, body: "{}" });
    const response = await POST(request, { params: Promise.resolve({ path: ["sign-in", "email"] }) });
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("forwards the allow-listed email sign-in route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const request = new NextRequest("https://triad.test/api/auth/sign-in/email", {
      method: "POST", headers: { origin: "https://triad.test", "content-type": "application/json" }, body: JSON.stringify({ email: "member@example.com" }),
    });
    const response = await POST(request, { params: Promise.resolve({ path: ["sign-in", "email"] }) });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://auth.neonauth.us-east-1.aws.neon.tech/neondb/auth/sign-in/email");
    vi.unstubAllGlobals();
  });
});
