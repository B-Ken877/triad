/**
 * Durable message reconciliation helpers (TRIAD domain-neutral port).
 *
 * Trust model: a realtime send() returning TRUE proves only that the frame
 * was BUFFERED — not that the server received or persisted it. The only
 * trustworthy persistence signals are:
 *   1. a persisted echo carrying OUR clientMsgId (emitted only AFTER the
 *      server-side insert, so its arrival proves durability), or
 *   2. the REST POST response (the persisted row itself).
 *
 * Callers wait briefly for (1) and fall back to (2). Retries are safe
 * server-side: `(senderId, clientMsgId)` is unique, so a REST retry after a
 * lost-but-persisted frame returns the ORIGINAL row instead of duplicating it.
 *
 * Ported from the audited Medika delivery helpers (reference snapshot),
 * decoupled from any socket implementation: the caller supplies a subscribe
 * function, so TRIAD can swap WebSocket/SSE transports freely.
 */

export interface PersistedEchoEvent {
  type: string;
  clientMsgId?: unknown;
}

export type EchoSubscriber = (
  handler: (event: PersistedEchoEvent) => void,
) => () => void;

/** How long to wait for the persisted echo before falling back to REST.
 *  Generous for high-latency mobile networks, short enough to feel responsive. */
export const ECHO_TIMEOUT_MS = 8_000;

/**
 * Resolve TRUE when a persisted echo event carrying `clientMsgId` arrives via
 * `subscribe`. Resolves FALSE on timeout. Always unsubscribes; never rejects.
 */
export function waitForPersistedEcho(
  subscribe: EchoSubscriber,
  clientMsgId: string,
  timeoutMs: number = ECHO_TIMEOUT_MS,
  echoType: string = "message:new",
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: (() => void) | null = null;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        unsubscribe?.();
      } catch {
        /* listener already gone */
      }
      resolve(ok);
    };
    try {
      unsubscribe = subscribe((event) => {
        if (event.type === echoType && event.clientMsgId === clientMsgId) {
          finish(true);
        }
      });
    } catch {
      // Broken listener registration: never reject — the caller falls back
      // to the REST path, which carries its own persisted evidence.
      finish(false);
      return;
    }
    timer = setTimeout(() => finish(false), Math.max(0, timeoutMs));
  });
}

/**
 * Monotonic merge of a persisted message into a list without duplicating by
 * id — used when REST was the winning path. Orders deterministically by
 * (createdAt, id) so client render order is stable until server-side sequence
 * ordering (Phase 4 pagination) supersedes it.
 */
export function mergePersistedMessage<T extends { id: string; createdAt: number }>(
  list: T[],
  msg: T,
): T[] {
  if (list.some((m) => m.id === msg.id)) return list;
  const next = [...list, msg];
  next.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return next;
}
