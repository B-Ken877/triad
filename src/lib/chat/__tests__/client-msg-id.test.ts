import { describe, expect, it } from "vitest";
import { newClientMsgId } from "@/lib/chat/client-msg-id";

describe("newClientMsgId", () => {
  it("generates unique ids across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(newClientMsgId());
    }
    expect(seen.size).toBe(1000);
  });

  it("returns non-empty string ids", () => {
    const id = newClientMsgId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("produces UUID-formatted ids when crypto.randomUUID exists", () => {
    // Node >= 19 exposes globalThis.crypto.randomUUID.
    if (typeof globalThis.crypto?.randomUUID !== "function") return;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuidRe.test(newClientMsgId())).toBe(true);
  });
});
