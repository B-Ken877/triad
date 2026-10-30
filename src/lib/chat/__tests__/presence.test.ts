import { describe, expect, it } from "vitest";
import { PresenceTracker } from "@/lib/chat/presence";

describe("PresenceTracker", () => {
  it("marks participants online inside the heartbeat window", () => {
    let now = 10_000;
    const t = new PresenceTracker({ now: () => now, onlineWindowMs: 45_000 });
    t.onHeartbeat({ participantId: "a", at: 10_000 });
    now = 54_999;
    expect(t.snapshot(["a"])[0]).toEqual({
      participantId: "a",
      status: "online",
      lastSeenAt: 10_000,
    });
  });

  it("derives offline with preserved last-seen after the window", () => {
    let now = 10_000;
    const t = new PresenceTracker({ now: () => now, onlineWindowMs: 45_000 });
    t.onHeartbeat({ participantId: "a", at: 10_000 });
    now = 55_000;
    expect(t.snapshot(["a"])[0]).toEqual({
      participantId: "a",
      status: "offline",
      lastSeenAt: 10_000,
    });
  });

  it("participants never seen are offline without a lastSeen", () => {
    const t = new PresenceTracker({ now: () => 0 });
    expect(t.snapshot(["ghost"])[0]).toEqual({ participantId: "ghost", status: "offline" });
  });

  it("ignores stale, duplicate and non-finite heartbeats", () => {
    const t = new PresenceTracker({ now: () => 0 });
    t.onHeartbeat({ participantId: "a", at: 500 });
    expect(t.onHeartbeat({ participantId: "a", at: 500 })).toBe(false);
    expect(t.onHeartbeat({ participantId: "a", at: 100 })).toBe(false);
    expect(t.onHeartbeat({ participantId: "a", at: Number.NaN })).toBe(false);
    expect(t.snapshot(["a"])[0]?.lastSeenAt).toBe(500);
  });

  it("disconnect pins a floor: pre-disconnect heartbeats cannot resurrect", () => {
    let now = 5_000;
    const t = new PresenceTracker({ now: () => now, onlineWindowMs: 45_000 });
    t.onHeartbeat({ participantId: "a", at: 4_000 });
    t.markDisconnected(); // now=5000
    now = 6_000;
    expect(t.snapshot(["a"])[0]?.status).toBe("offline");
    // Delayed duplicate of the pre-disconnect heartbeat.
    expect(t.onHeartbeat({ participantId: "a", at: 4_500 })).toBe(false);
    expect(t.snapshot(["a"])[0]?.status).toBe("offline");
    // Fresh post-disconnect heartbeat brings them online again.
    expect(t.onHeartbeat({ participantId: "a", at: 6_000 })).toBe(true);
    expect(t.snapshot(["a"])[0]?.status).toBe("online");
  });

  it("snapshot is deterministic for the same state and clock", () => {
    const t = new PresenceTracker({ now: () => 1_000, onlineWindowMs: 45_000 });
    t.onHeartbeat({ participantId: "b", at: 900 });
    t.onHeartbeat({ participantId: "a", at: 100 });
    const s1 = t.snapshot(["a", "b", "c"]);
    const s2 = t.snapshot(["a", "b", "c"]);
    expect(s1).toEqual(s2);
    expect(s1.map((p) => p.status)).toEqual(["online", "online", "offline"]);
  });
});
