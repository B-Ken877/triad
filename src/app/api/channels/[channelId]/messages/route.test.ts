import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getChannelAccess: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/workspace/access", () => ({ getChannelAccess: mocks.getChannelAccess }));
vi.mock("@/lib/db", () => ({
  db: { message: { findMany: mocks.findMany, create: mocks.create } },
}));

import { GET, POST } from "./route";

const context = { params: Promise.resolve({ channelId: "channel-1" }) };
const user = { id: "user-1", email: "member@example.com", name: "Member" };

describe("channel messages API authorization and persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.getChannelAccess.mockResolvedValue({ id: "channel-1" });
    mocks.findMany.mockResolvedValue([]);
  });

  it("rejects unauthenticated history requests", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);
    const response = await GET(new Request("https://triad.test/api/channels/channel-1/messages"), context);
    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("denies history when the caller is not a channel member", async () => {
    mocks.getChannelAccess.mockResolvedValueOnce(null);
    const response = await GET(new Request("https://triad.test/api/channels/private/messages"), context);
    expect(response.status).toBe(404);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("queries only the authorized channel in deterministic order", async () => {
    const response = await GET(new Request("https://triad.test/api/channels/channel-1/messages"), context);
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { channelId: "channel-1" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
    }));
  });

  it("rejects blank messages before touching the database", async () => {
    const request = new Request("https://triad.test/api/channels/channel-1/messages", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: "   " }),
    });
    const response = await POST(request, context);
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("uses the authenticated identity instead of a client-supplied sender", async () => {
    mocks.create.mockResolvedValue({
      id: "message-1", channelId: "channel-1", senderId: "user-1", clientMsgId: "client-1",
      body: "Persist this", createdAt: new Date("2026-10-30T12:00:00.000Z"),
      sender: { id: "user-1", name: "Member", email: "member@example.com" },
    });
    const request = new Request("https://triad.test/api/channels/channel-1/messages", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "Persist this", clientMsgId: "client-1", senderId: "attacker" }),
    });
    const response = await POST(request, context);
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { channelId: "channel-1", senderId: "user-1", body: "Persist this", clientMsgId: "client-1" },
    }));
  });

  it("returns a conflict for a duplicate client message identity", async () => {
    mocks.create.mockRejectedValueOnce({ code: "P2002" });
    const request = new Request("https://triad.test/api/channels/channel-1/messages", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: "Retry", clientMsgId: "same-id" }),
    });
    const response = await POST(request, context);
    expect(response.status).toBe(409);
  });
});
