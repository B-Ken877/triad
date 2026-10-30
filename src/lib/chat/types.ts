/**
 * TRIAD chat domain types — shared, domain-neutral, framework-free.
 *
 * Terminology is project/participant based on purpose: no healthcare roles,
 * no consultation lifecycle, no calling concepts (issue #1, #3).
 */

/** Aggregate delivery state of a persisted, sent message. */
export type DeliveryStatus = "sent" | "delivered" | "read";

/** Client-side lifecycle of an outgoing message bubble. */
export type OutgoingMessageState = "pending" | DeliveryStatus | "failed";

/** A channel participant for receipt/presence derivations. */
export interface Participant {
  id: string;
  displayName: string;
}
