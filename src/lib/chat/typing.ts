/**
 * Typing-indicator utilities (TRIAD domain-neutral port).
 *
 * Two concerns, both framework-free and transport-agnostic:
 *
 * 1. OUTBOUND throttling — while the local user is typing, emit at most one
 *    "typing" signal per throttle window instead of one per keystroke.
 * 2. INBOUND tracking — remote participants' typing activities expire after
 *    a TTL, stale/out-of-order events never regress state, and a transport
 *    disconnect clears everything so indicators never stick.
 */

/** Outbound: whether a new typing signal should be sent now. */
export function shouldSendTypingSignal(
  lastSentAt: number | null,
  now: number,
  throttleMs: number,
): boolean {
  if (lastSentAt === null) return true;
  return now - lastSentAt >= throttleMs;
}

/** Outbound: after the user stops typing, emit a final "stopped" signal
 *  exactly once — only when at least one typing signal went out before. */
export function shouldSendStoppedSignal(
  lastSentAt: number | null,
  _now: number,
  _throttleMs: number,
): boolean {
  return lastSentAt !== null;
}

export interface TypingEvent {
  participantId: string;
  /** Event timestamp as reported by the sender; used for staleness checks. */
  at: number;
}

export interface TypingTrackerOptions {
  /** Milliseconds an untouched typing state stays active. */
  ttlMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export interface TypingState {
  participantId: string;
  /** Timestamp of the most recent accepted activity. */
  since: number;
}

/**
 * Tracks remote participants currently typing.
 *
 * Determinism guarantees:
 * - an event older than the participant's current `since` is ignored;
 * - an event for an unknown participant starts a fresh state;
 * - `sweep()` (or `active()`) drops states older than the TTL;
 * - `clear()` drops everything (transport disconnect) — subsequent events
 *   with old timestamps cannot resurrect pre-disconnect state because the
 *   tracker records the disconnect time as a floor.
 */
export class TypingTracker {
  private readonly ttlMs: number;
  private readonly clock: () => number;
  private readonly states = new Map<string, number>();
  private disconnectFloor = Number.NEGATIVE_INFINITY;

  constructor(options: TypingTrackerOptions = {}) {
    this.ttlMs = options.ttlMs ?? 6_000;
    this.clock = options.now ?? (() => Date.now());
  }

  /** Record an inbound typing activity. Returns true when state changed. */
  onActivity(event: TypingEvent): boolean {
    if (!Number.isFinite(event.at)) return false;
    if (event.at < Math.max(this.disconnectFloor, this.states.get(event.participantId) ?? -Infinity))
      return false;
    const previous = this.states.get(event.participantId);
    this.states.set(event.participantId, event.at);
    return previous === undefined;
  }

  /** Drop expired states; returns surviving participants in insertion order. */
  sweep(): TypingState[] {
    const now = this.clock();
    for (const [participantId, since] of this.states) {
      if (now - since >= this.ttlMs) this.states.delete(participantId);
    }
    return this.snapshot();
  }

  /** Currently-typing participants, sweeping expired state first. */
  active(): TypingState[] {
    return this.sweep();
  }

  /** Transport disconnect: drop all state and pin the staleness floor. */
  clear(): void {
    this.disconnectFloor = Math.max(this.disconnectFloor, this.clock());
    this.states.clear();
  }

  private snapshot(): TypingState[] {
    return [...this.states.entries()]
      .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
      .map(([participantId, since]) => ({ participantId, since }));
  }
}
