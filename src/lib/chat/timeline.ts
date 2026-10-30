/**
 * Message timeline presentation helpers — pure, DOM-free.
 *
 * Deterministic ordering and day grouping for the conversation list. All
 * human-readable labels are produced by an INJECTED formatter so tests and
 * server renders stay timezone-stable (no flaky timing-dependent tests).
 */

/** Canonical message shape used by timeline + UI components. */
export interface TimelineMessage {
  id: string;
  clientMsgId?: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

/** One renderable row of the conversation list. */
export type TimelineRow<T extends TimelineMessage> =
  | { type: "day-separator"; key: string; label: string }
  | { type: "message"; key: string; message: T; isFirstOfSender: boolean; isLastOfSender: boolean };

export interface DayLabelFormatter {
  /** Format a day boundary timestamp (ms epoch) into a stable label. */
  (dayStartTimestamp: number): string;
}

/** Deterministic message ordering: (createdAt, id). Ids break ties stably. */
export function compareMessages<T extends TimelineMessage>(a: T, b: T): number {
  return a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Build the ordered timeline rows: day separators between calendar days and
 * sender-grouping flags for bubble tail/spacing decisions. Pure: returns a
 * new array, never mutates the input; defensive-sorts a copy first.
 */
export function buildTimeline<T extends TimelineMessage>(
  messages: readonly T[],
  formatDayLabel: DayLabelFormatter,
  dayKey: (timestamp: number) => string = defaultDayKey,
): TimelineRow<T>[] {
  const sorted = [...messages].sort(compareMessages);
  const rows: TimelineRow<T>[] = [];
  let lastDayKey: string | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const message = sorted[i]!;
    const key = dayKey(message.createdAt);
    if (key !== lastDayKey) {
      rows.push({ type: "day-separator", key: `day:${key}`, label: formatDayLabel(message.createdAt) });
      lastDayKey = key;
    }
    const prev = i > 0 ? sorted[i - 1]! : undefined;
    const next = i + 1 < sorted.length ? sorted[i + 1]! : undefined;
    const sameDayAsPrev = prev !== undefined && dayKey(prev.createdAt) === key;
    rows.push({
      type: "message",
      key: `msg:${message.id}`,
      message,
      isFirstOfSender: !sameDayAsPrev || prev!.senderId !== message.senderId,
      isLastOfSender: next === undefined || dayKey(next.createdAt) !== key || next.senderId !== message.senderId,
    });
  }
  return rows;
}

/** UTC calendar-day key; stable across environments (tests, SSR). */
export function defaultDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Distinct display names currently typing (deduplicated, stable order). */
export function typingLabel(names: readonly string[]): string {
  const unique = [...new Set(names)];
  if (unique.length === 0) return "";
  if (unique.length === 1) return `${unique[0]} is typing`;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]} are typing`;
  return `${unique.length} participants are typing`;
}
