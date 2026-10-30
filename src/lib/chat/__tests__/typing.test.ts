import { describe, expect, it, vi } from "vitest";
import {
  shouldSendStoppedSignal,
  shouldSendTypingSignal,
  TypingTracker,
} from "@/lib/chat/typing";

describe("outbound throttling", () => {
  it("sends immediately when no signal was sent before", () => {
    expect(shouldSendTypingSignal(null, 1000, 3000)).toBe(true);
  });

  it("throttles within the window and releases after it", () => {
    expect(shouldSendTypingSignal(1000, 3999, 3000)).toBe(false);
    expect(shouldSendTypingSignal(1000, 4000, 3000)).toBe(true);
  });

  it("stop signal fires exactly once after typing signals", () => {
    expect(shouldSendStoppedSignal(null, 0, 3000)).toBe(false);
    expect(shouldSendStoppedSignal(1000, 5000, 3000)).toBe(true);
  });
});

describe("TypingTracker", () => {
  it("reports new and advancing activity while rejecting duplicate and stale events", () => {
    const t = new TypingTracker({ now: () => 0 });

    expect(t.onActivity({ participantId: "a", at: 100 })).toBe(true);
    expect(t.onActivity({ participantId: "a", at: 200 })).toBe(true);
    expect(t.active()).toEqual([{ participantId: "a", since: 200 }]);

    // Equal timestamps are duplicate events and must not report a state change.
    expect(t.onActivity({ participantId: "a", at: 200 })).toBe(false);
    // Older timestamps must not regress the accepted state.
    expect(t.onActivity({ participantId: "a", at: 150 })).toBe(false);
    expect(t.active()).toEqual([{ participantId: "a", since: 200 }]);
  });

  it("rejects empty participant identifiers", () => {
    const t = new TypingTracker({ now: () => 0 });
    expect(t.onActivity({ participantId: "  ", at: 100 })).toBe(false);
    expect(t.active()).toEqual([]);
  });

  it("ignores stale events that would regress a participant state", () => {
    const t = new TypingTracker({ now: () => 0 });
    t.onActivity({ participantId: "a", at: 500 });
    expect(t.onActivity({ participantId: "a", at: 100 })).toBe(false);
    expect(t.active()[0]?.since).toBe(500);
  });

  it("ignores non-finite timestamps", () => {
    const t = new TypingTracker({ now: () => 0 });
    expect(t.onActivity({ participantId: "a", at: Number.NaN })).toBe(false);
    expect(t.active()).toEqual([]);
  });

  it("expires states after the TTL via the injected clock", () => {
    let now = 10_000;
    const t = new TypingTracker({ now: () => now, ttlMs: 6_000 });
    t.onActivity({ participantId: "a", at: 10_000 });
    now = 15_999;
    expect(t.active().map((s) => s.participantId)).toEqual(["a"]);
    now = 16_000;
    expect(t.active()).toEqual([]);
  });

  it("sweep returns survivors in deterministic (since, id) order", () => {
    const t = new TypingTracker({ now: () => 1_000, ttlMs: 10_000 });
    t.onActivity({ participantId: "b", at: 100 });
    t.onActivity({ participantId: "a", at: 100 });
    t.onActivity({ participantId: "c", at: 50 });
    expect(t.sweep().map((s) => s.participantId)).toEqual(["c", "a", "b"]);
  });

  it("clear() on disconnect drops state and pins a floor against stale events", () => {
    let now = 1_000;
    const t = new TypingTracker({ now: () => now, ttlMs: 60_000 });
    t.onActivity({ participantId: "a", at: 900 });
    t.clear(); // disconnect at 1000
    expect(t.active()).toEqual([]);
    // A delayed duplicate of the pre-disconnect event must not resurrect.
    expect(t.onActivity({ participantId: "a", at: 900 })).toBe(false);
    expect(t.active()).toEqual([]);
    // Fresh post-disconnect activity works.
    now = 2_000;
    expect(t.onActivity({ participantId: "a", at: 2_000 })).toBe(true);
    expect(t.active().map((s) => s.participantId)).toEqual(["a"]);
  });

  it("works with the real clock without flaking (boundary is wide)", () => {
    vi.useRealTimers();
    const t = new TypingTracker({ ttlMs: 60_000 });
    t.onActivity({ participantId: "a", at: Date.now() });
    expect(t.active().map((s) => s.participantId)).toEqual(["a"]);
  });
});
