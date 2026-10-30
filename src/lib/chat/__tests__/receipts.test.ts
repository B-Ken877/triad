import { describe, expect, it } from "vitest";
import { advanceMarker, deriveReceipt, type ParticipantMarkers } from "@/lib/chat/receipts";

describe("advanceMarker", () => {
  const base: ParticipantMarkers = { participantId: "p1", lastDeliveredSeq: 5, lastReadSeq: 3 };

  it("advances delivered and never regresses on stale/duplicate events", () => {
    expect(advanceMarker(base, "delivered", 7)).toEqual({
      participantId: "p1",
      lastDeliveredSeq: 7,
      lastReadSeq: 3,
    });
    expect(advanceMarker(base, "delivered", 5)).toBe(base);
    expect(advanceMarker(base, "delivered", 4)).toBe(base);
    expect(advanceMarker(base, "delivered", Number.NaN)).toBe(base);
  });

  it("advances read and implies delivered up to the read position", () => {
    const next = advanceMarker(base, "read", 6);
    expect(next).toEqual({ participantId: "p1", lastDeliveredSeq: 6, lastReadSeq: 6 });
  });

  it("delivered never overtakes an existing read position", () => {
    const p: ParticipantMarkers = { participantId: "p1", lastDeliveredSeq: 2, lastReadSeq: 9 };
    expect(advanceMarker(p, "delivered", 5)).toEqual({
      participantId: "p1",
      lastDeliveredSeq: 9,
      lastReadSeq: 9,
    });
  });

  it("read never regresses", () => {
    expect(advanceMarker(base, "read", 3)).toBe(base);
    expect(advanceMarker(base, "read", 2)).toBe(base);
  });
});

describe("deriveReceipt", () => {
  const marker = (id: string, delivered: number, read: number): ParticipantMarkers => ({
    participantId: id,
    lastDeliveredSeq: delivered,
    lastReadSeq: read,
  });

  it("returns sent for a channel with no other participants", () => {
    expect(deriveReceipt([], 10)).toBe("sent");
  });

  it("returns delivered when one other has not READ past the message", () => {
    const others = [marker("a", 20, 12), marker("b", 20, 15)];
    expect(deriveReceipt(others, 10)).toBe("read");
    // c received everything (delivered=20) but only read up to 8:
    // not ALL others read msg 10 → delivered, not read.
    expect(deriveReceipt([...others, marker("c", 20, 8)], 10)).toBe("delivered");
  });

  it("returns delivered when all received but not all read", () => {
    const others = [marker("a", 12, 12), marker("b", 12, 4)];
    expect(deriveReceipt(others, 10)).toBe("delivered");
  });

  it("returns sent when at least one other has not received it", () => {
    const others = [marker("a", 12, 12), marker("b", 9, 9)];
    expect(deriveReceipt(others, 10)).toBe("sent");
  });

  it("is monotonic under marker advancement: receipts never regress", () => {
    let others = [marker("a", 5, 5)];
    expect(deriveReceipt(others, 10)).toBe("sent");
    others = [advanceMarker(others[0]!, "read", 20)];
    expect(deriveReceipt(others, 10)).toBe("read");
  });
});
