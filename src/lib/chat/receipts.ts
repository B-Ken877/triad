/**
 * Read-receipt derivation from PERSISTED state (TRIAD domain-neutral port).
 *
 * Trust model (carried over from the audited Medika receipts logic): a
 * receipt is derived from persisted read/delivery markers, never from
 * optimistic client assumptions. A participant's markers are monotonic
 * sequence positions: `lastDeliveredSeq`/`lastReadSeq` mean "this participant
 * has durably received/read every message up to and including this sequence
 * position". Markers only ever advance; a stale or duplicate marker event
 * must not regress stored state.
 *
 * Multi-participant semantics (channels may hold several agents and humans):
 * - `read`      — every OTHER participant has read past the message.
 * - `delivered` — every OTHER participant has at least received it, but not
 *                 all have read it.
 * - `sent`      — persisted, but at least one other participant has not
 *                 durably received it yet.
 */

import type { DeliveryStatus } from "./types";

export interface ParticipantMarkers {
  participantId: string;
  /** Highest durably-received sequence position (monotonic). */
  lastDeliveredSeq: number;
  /** Highest durably-read sequence position (monotonic). */
  lastReadSeq: number;
}

/** Advance a participant's marker to a new position, never regressing.
 *  Returns the same object when the event is stale/duplicate. */
export function advanceMarker(
  current: ParticipantMarkers,
  kind: "delivered" | "read",
  seq: number,
): ParticipantMarkers {
  if (!Number.isFinite(seq)) return current;
  if (kind === "delivered") {
    if (seq <= current.lastDeliveredSeq) return current;
    // Read implies delivered: never let a delivery marker overtake read.
    const nextDelivered = Math.max(seq, current.lastReadSeq);
    return { ...current, lastDeliveredSeq: nextDelivered };
  }
  if (seq <= current.lastReadSeq) return current;
  // Reading up to `seq` also means everything up to `seq` was delivered.
  return {
    ...current,
    lastReadSeq: seq,
    lastDeliveredSeq: Math.max(current.lastDeliveredSeq, seq),
  };
}

/**
 * Derive the receipt for MY persisted message at `seq` from the OTHER
 * participants' markers. Pure: no mutation, deterministic ordering.
 *
 * @param othersMarkers markers for every participant except the sender
 * @param seq sequence position of the sent message
 */
export function deriveReceipt(
  othersMarkers: readonly ParticipantMarkers[],
  seq: number,
): DeliveryStatus {
  if (othersMarkers.length === 0) return "sent";
  let allDelivered = true;
  let allRead = true;
  for (const m of othersMarkers) {
    if (m.lastReadSeq < seq) allRead = false;
    if (m.lastDeliveredSeq < seq) {
      allDelivered = false;
      allRead = false;
    }
    if (!allDelivered) break;
  }
  if (allRead) return "read";
  if (allDelivered) return "delivered";
  return "sent";
}
