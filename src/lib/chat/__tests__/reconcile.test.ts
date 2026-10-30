import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mergePersistedMessage,
  waitForPersistedEcho,
  type PersistedEchoEvent,
} from "@/lib/chat/reconcile";

describe("waitForPersistedEcho", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves true when a matching persisted echo arrives", async () => {
    let handler: ((e: PersistedEchoEvent) => void) | null = null;
    const subscribe = (h: (e: PersistedEchoEvent) => void) => {
      handler = h;
      return () => {
        handler = null;
      };
    };
    const promise = waitForPersistedEcho(subscribe, "cmid-1", 1000);
    handler!({ type: "message:new", clientMsgId: "cmid-1" });
    await expect(promise).resolves.toBe(true);
  });

  it("ignores echoes for other client message ids", async () => {
    let handler: ((e: PersistedEchoEvent) => void) | null = null;
    const subscribe = (h: (e: PersistedEchoEvent) => void) => {
      handler = h;
      return () => {
        handler = null;
      };
    };
    const promise = waitForPersistedEcho(subscribe, "cmid-1", 50);
    handler!({ type: "message:new", clientMsgId: "cmid-OTHER" });
    handler!({ type: "message:update", clientMsgId: "cmid-1" });
    await expect(promise).resolves.toBe(false);
  });

  it("resolves false on timeout and always unsubscribes", async () => {
    vi.useFakeTimers();
    const off = vi.fn();
    const subscribe = (_h: (e: PersistedEchoEvent) => void) => off;
    const promise = waitForPersistedEcho(subscribe, "cmid-1", 100);
    vi.advanceTimersByTime(150);
    await expect(promise).resolves.toBe(false);
    expect(off).toHaveBeenCalledOnce();
  });

  it("never rejects when the transport throws during subscribe", async () => {
    const subscribe = (_h: (e: PersistedEchoEvent) => void) => {
      throw new Error("socket broken");
    };
    await expect(waitForPersistedEcho(subscribe, "cmid-1", 10)).resolves.toBe(false);
  });
});

describe("mergePersistedMessage", () => {
  const base = { createdAt: 100 };

  it("appends and orders deterministically by (createdAt, id)", () => {
    const list = [
      { id: "b", createdAt: 100 },
      { id: "a", createdAt: 50 },
    ];
    const merged = mergePersistedMessage(list, { id: "c", ...base });
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("never duplicates an id already present", () => {
    const list = [{ id: "a", createdAt: 50 }];
    expect(mergePersistedMessage(list, { id: "a", createdAt: 99 })).toBe(list);
  });

  it("breaks createdAt ties by id for stable order", () => {
    const merged = mergePersistedMessage([], { id: "z", createdAt: 5 });
    const merged2 = mergePersistedMessage(merged, { id: "a", createdAt: 5 });
    expect(merged2.map((m) => m.id)).toEqual(["a", "z"]);
  });
});
