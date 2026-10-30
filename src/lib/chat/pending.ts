/**
 * Optimistic pending-entry state machine (TRIAD domain-neutral port).
 *
 * Trust model: a pending entry represents a send whose persistence is
 * UNCONFIRMED. The client can miss both persistence signals (the persisted
 * realtime echo and the REST response) while the server actually stored the
 * message. The entry therefore must never be silently dropped on a transport
 * failure: it is marked `failed` and reconciled later with the SAME
 * `clientMsgId`, which the server dedupes on `(senderId, clientMsgId)`
 * uniqueness. An already-persisted send returns the ORIGINAL row (the bubble
 * merges by id); an unsent one is delivered fresh. Either way the sender's
 * view converges to the server's truth WITHOUT a page refresh and never
 * duplicates.
 *
 * Ported from the audited Medika pending-state machine (reference snapshot),
 * with consultation/medical concepts and media-specific assumptions removed.
 */

/** TRIAD message kinds. Text ships first; attachments arrive in a later phase. */
export type TriadMessageKind = "text" | "attachment";

export interface PendingMessage {
  clientMsgId: string;
  createdAt: number;
  kind: TriadMessageKind;
  text: string;
  /** Reference to an already-completed upload, if any. */
  attachmentRef?: { url: string; size: number } | null;
  /** In-memory file for the retry path (never serialized to the server). */
  fileRef?: File | null;
  failed?: boolean;
}

/** Mark an entry unconfirmed. Pure: returns the SAME array reference when
 *  nothing changed so React state updates stay cheap. */
export function markPendingFailed<T extends { clientMsgId: string; failed?: boolean }>(
  list: T[],
  clientMsgId: string,
): T[] {
  let changed = false;
  const next = list.map((p) => {
    if (p.clientMsgId !== clientMsgId || p.failed) return p;
    changed = true;
    return { ...p, failed: true };
  });
  return changed ? next : list;
}

/** Clear the failed flag while a retry is in flight. No-op when absent. */
export function markPendingRetrying<T extends { clientMsgId: string; failed?: boolean }>(
  list: T[],
  clientMsgId: string,
): T[] {
  let changed = false;
  const next = list.map((p) => {
    if (p.clientMsgId !== clientMsgId || !p.failed) return p;
    changed = true;
    return { ...p, failed: false };
  });
  return changed ? next : list;
}

/** Remove a resolved entry. Pure: same reference when the id is absent. */
export function removePending<T extends { clientMsgId: string }>(
  list: T[],
  clientMsgId: string,
): T[] {
  const next = list.filter((p) => p.clientMsgId !== clientMsgId);
  return next.length === list.length ? list : next;
}

/**
 * Whether the client may re-send this entry itself: text entries always are;
 * attachment entries need the in-memory file (a completed upload is referenced
 * by `attachmentRef`, but the send frame re-uses it without a second upload).
 */
export function isReconcilablePending(entry: PendingMessage): boolean {
  if (entry.kind === "text") return Boolean(entry.text);
  return Boolean(entry.fileRef);
}
