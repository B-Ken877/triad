/**
 * TRIAD client message identity.
 *
 * Every logical send carries one `clientMsgId` for its entire lifetime:
 * optimistic render, retries and reconciliation all reuse the SAME id so the
 * server can deduplicate on `(senderId, clientMsgId)` uniqueness. Retrying a
 * send therefore never creates a duplicate persisted message (issue #1).
 */

/** Generate a fresh client message id (UUID v4 where crypto is available). */
export function newClientMsgId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  // Deterministic fallback for environments without crypto.randomUUID.
  // Not cryptographically random, but unique enough for local tests.
  return `cmid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
