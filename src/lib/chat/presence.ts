/**
 * Participant presence / last-seen derivation (TRIAD domain-neutral port).
 *
 * Presence reflects recent AUTHENTICATED heartbeat activity, not merely
 * registration (issue #1): a participant is `online` only while their
 * heartbeat is inside the online window. `lastSeen` is the most recent
 * heartbeat and never regresses — stale, duplicate or out-of-order
 * heartbeat events are ignored. A transport disconnect marks participants
 * offline immediately (derived state), without fabricating timestamps.
 */

export type PresenceStatus = "online" | "offline";

export interface Heartbeat {
  participantId: string;
  /** Server-accepted heartbeat timestamp (ms epoch). */
  at: number;
}

export interface PresenceEntry {
  participantId: string;
  status: PresenceStatus;
  /** Most recent accepted heartbeat; undefined for participants never seen. */
  lastSeenAt?: number;
}

export interface PresenceTrackerOptions {
  /** Heartbeats older than this mean offline. */
  onlineWindowMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

/**
 * Maintains last-heartbeat state per participant.
 *
 * Determinism guarantees:
 * - a heartbeat older than the participant's current last-seen is ignored;
 * - a disconnect pins a floor: pre-disconnect heartbeats cannot resurrect
 *   after `markDisconnected()`;
 * - `snapshot()` derives online/offline from the injected clock, so the same
 *   state plus the same `now` always yields the same result.
 */
export class PresenceTracker {
  private readonly onlineWindowMs: number;
  private readonly clock: () => number;
  private readonly lastSeen = new Map<string, number>();
  private disconnectFloor = Number.NEGATIVE_INFINITY;

  constructor(options: PresenceTrackerOptions = {}) {
    this.onlineWindowMs = options.onlineWindowMs ?? 45_000;
    this.clock = options.now ?? (() => Date.now());
  }

  /** Record a heartbeat. Returns true when last-seen advanced. */
  onHeartbeat(heartbeat: Heartbeat): boolean {
    if (!Number.isFinite(heartbeat.at)) return false;
    if (heartbeat.at < Math.max(this.disconnectFloor, this.lastSeen.get(heartbeat.participantId) ?? -Infinity))
      return false;
    const previous = this.lastSeen.get(heartbeat.participantId);
    this.lastSeen.set(heartbeat.participantId, heartbeat.at);
    return previous !== heartbeat.at;
  }

  /** Transport disconnect: all participants go offline until fresh activity. */
  markDisconnected(): void {
    this.disconnectFloor = Math.max(this.disconnectFloor, this.clock());
  }

  /** Derive presence for the given participants (unknown → offline, never seen). */
  snapshot(participantIds: readonly string[]): PresenceEntry[] {
    const now = this.clock();
    const floor = this.disconnectFloor;
    return participantIds.map((participantId) => {
      const seen = this.lastSeen.get(participantId);
      if (seen === undefined || seen <= floor || now - seen >= this.onlineWindowMs) {
        return seen === undefined
          ? { participantId, status: "offline" as const }
          : { participantId, status: "offline" as const, lastSeenAt: seen };
      }
      return { participantId, status: "online" as const, lastSeenAt: seen };
    });
  }
}
