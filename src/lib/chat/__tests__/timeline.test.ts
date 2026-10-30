import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  compareMessages,
  defaultDayKey,
  typingLabel,
  type TimelineMessage,
} from "@/lib/chat/timeline";

const msg = (id: string, createdAt: number, senderId = "u1", text = `m-${id}`): TimelineMessage => ({
  id,
  senderId,
  senderName: senderId.toUpperCase(),
  text,
  createdAt,
});

const fixedDayLabel = (ts: number) => `DAY:${defaultDayKey(ts)}`;

describe("compareMessages", () => {
  it("orders by createdAt then id deterministically", () => {
    const list = [msg("b", 200), msg("z", 100), msg("a", 200)];
    const sorted = [...list].sort(compareMessages);
    expect(sorted.map((m) => m.id)).toEqual(["z", "a", "b"]);
  });
});

describe("buildTimeline", () => {
  it("inserts day separators on day boundaries only", () => {
    const rows = buildTimeline(
      [msg("1", day(2, 10)), msg("2", day(1, 9)), msg("3", day(1, 22))],
      fixedDayLabel,
    );
    const separators = rows.filter((r) => r.type === "day-separator");
    expect(separators).toHaveLength(2);
    expect(separators[0]).toMatchObject({ label: `DAY:${defaultDayKey(day(1, 9))}` });
    expect(separators[1]).toMatchObject({ label: `DAY:${defaultDayKey(day(2, 10))}` });
    // Input order is defensively normalized: day 1 messages first.
    const ids = rows.filter((r) => r.type === "message").map((r) => (r as { message: TimelineMessage }).message.id);
    expect(ids).toEqual(["2", "3", "1"]);
  });

  it("flags sender-group boundaries within the same day only", () => {
    const rows = buildTimeline(
      [
        msg("1", day(1, 10), "a"),
        msg("2", day(1, 11), "a"),
        msg("3", day(1, 12), "b"),
        msg("4", day(2, 9), "a"),
      ],
      fixedDayLabel,
    );
    const flags = rows
      .filter((r): r is Extract<(typeof rows)[number], { type: "message" }> => r.type === "message")
      .map((r) => [r.message.id, r.isFirstOfSender, r.isLastOfSender]);
    expect(flags).toEqual([
      ["1", true, false], // day start; same sender follows
      ["2", false, true], // grouped after 1; sender b follows
      ["3", true, true], // new sender; day ends
      ["4", true, true], // new day; last message
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [msg("2", 200), msg("1", 100)];
    const copy = [...input];
    buildTimeline(input, fixedDayLabel);
    expect(input).toEqual(copy);
  });

  it("handles empty and single-message lists", () => {
    expect(buildTimeline([], fixedDayLabel)).toEqual([]);
    const rows = buildTimeline([msg("1", day(1, 8))], fixedDayLabel);
    expect(rows).toHaveLength(2); // separator + message
  });
});

describe("typingLabel", () => {
  it("formats zero/one/two/many participants deterministically", () => {
    expect(typingLabel([])).toBe("");
    expect(typingLabel(["Ava"])).toBe("Ava is typing");
    expect(typingLabel(["Ava", "Noel"])).toBe("Ava and Noel are typing");
    expect(typingLabel(["Ava", "Noel", "Ava", "Kim"])).toBe("3 participants are typing");
  });
});

/** 2026-06-15T{h}:00:00.000Z helper for stable day tests. */
function day(dayOfMonth: number, hour: number): number {
  return Date.UTC(2026, 5, dayOfMonth, hour, 0, 0);
}
