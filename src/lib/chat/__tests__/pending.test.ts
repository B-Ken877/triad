import { describe, expect, it } from "vitest";
import {
  isReconcilablePending,
  markPendingFailed,
  markPendingRetrying,
  removePending,
  type PendingMessage,
} from "@/lib/chat/pending";

function entry(overrides: Partial<PendingMessage> = {}): PendingMessage {
  return {
    clientMsgId: "cmid-1",
    createdAt: Date.now(),
    kind: "text",
    text: "hello",
    ...overrides,
  };
}

describe("pending state machine", () => {
  it("markPendingFailed flags only the matching id and keeps others untouched", () => {
    const a = entry({ clientMsgId: "a" });
    const b = entry({ clientMsgId: "b" });
    const result = markPendingFailed([a, b], "a");
    expect(result[0]?.failed).toBe(true);
    expect(result[1]?.failed).toBeUndefined();
    // Purity: original entries are not mutated.
    expect(a.failed).toBeUndefined();
  });

  it("markPendingFailed returns the same reference when nothing changed", () => {
    const list = [entry({ failed: true })];
    expect(markPendingFailed(list, "cmid-1")).toBe(list);
    expect(markPendingFailed([], "missing")).toStrictEqual([]);
  });

  it("markPendingRetrying clears the failed flag only for the matching id", () => {
    const a = entry({ clientMsgId: "a", failed: true });
    const b = entry({ clientMsgId: "b", failed: true });
    const result = markPendingRetrying([a, b], "b");
    expect(result[0]?.failed).toBe(true);
    expect(result[1]?.failed).toBe(false);
  });

  it("removePending drops only the matching id and preserves order", () => {
    const list = [entry({ clientMsgId: "a" }), entry({ clientMsgId: "b" }), entry({ clientMsgId: "c" })];
    const result = removePending(list, "b");
    expect(result.map((p) => p.clientMsgId)).toEqual(["a", "c"]);
  });

  it("removePending returns the same reference when the id is absent", () => {
    const list = [entry()];
    expect(removePending(list, "missing")).toBe(list);
  });

  describe("isReconcilablePending", () => {
    it("text entries are reconcilable when they have text", () => {
      expect(isReconcilablePending(entry({ kind: "text", text: "hi" }))).toBe(true);
      expect(isReconcilablePending(entry({ kind: "text", text: "" }))).toBe(false);
    });

    it("attachment entries need the in-memory file ref for the retry path", () => {
      const file = new File(["x"], "x.txt");
      expect(
        isReconcilablePending(entry({ kind: "attachment", text: "", fileRef: file })),
      ).toBe(true);
      expect(isReconcilablePending(entry({ kind: "attachment", text: "", fileRef: null }))).toBe(
        false,
      );
    });
  });

  it("a full failure-retry-resolve cycle keeps one entry per clientMsgId", () => {
    let list: PendingMessage[] = [entry()];
    list = markPendingFailed(list, "cmid-1");
    expect(list).toHaveLength(1);
    expect(list[0]?.failed).toBe(true);
    list = markPendingRetrying(list, "cmid-1");
    expect(list).toHaveLength(1);
    expect(list[0]?.failed).toBe(false);
    list = removePending(list, "cmid-1");
    expect(list).toHaveLength(0);
  });
});
