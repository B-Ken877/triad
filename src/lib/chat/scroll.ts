/**
 * Chat scroll math — pure, DOM-free (TRIAD domain-neutral port).
 *
 * Extracted from the audited Medika scroll behavior so the reading-position
 * guarantees are unit-testable without a browser:
 * - near-bottom stickiness decides whether new content should auto-scroll;
 * - prepend anchoring keeps the viewport stable when older history pages are
 *   inserted above the visible area (late content resize included);
 * - jump-to-latest affordance visibility is a pure distance decision.
 */

export interface ScrollGeometry {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/** Distance (px) between the viewport bottom and the content bottom. */
export function distanceFromBottom(g: ScrollGeometry): number {
  return Math.max(0, g.scrollHeight - g.clientHeight - g.scrollTop);
}

/** Whether the viewport is close enough to the bottom to stick to latest. */
export function shouldStickToLatest(g: ScrollGeometry, thresholdPx = 120): boolean {
  return distanceFromBottom(g) <= thresholdPx;
}

/** Whether the "jump to latest" affordance should be offered. */
export function shouldShowJumpToLatest(g: ScrollGeometry, thresholdPx = 400): boolean {
  return distanceFromBottom(g) > thresholdPx;
}

/**
 * Result of prepending older history above the viewport: the new scrollTop
 * that keeps the currently-visible content in place, plus whether the user
 * was at the bottom before the prepend (they should follow to the new bottom
 * instead of staying anchored to the old position).
 */
export interface PrependAdjustment {
  scrollTop: number;
  wasAtBottom: boolean;
}

/** Compute the post-prepend scrollTop (pure: no DOM access, no side effects). */
export function adjustScrollTopAfterPrepend(
  before: ScrollGeometry,
  newScrollHeight: number,
  atBottomThresholdPx = 120,
): PrependAdjustment {
  const wasAtBottom = shouldStickToLatest(before, atBottomThresholdPx);
  const delta = Math.max(0, newScrollHeight - before.scrollHeight);
  return { scrollTop: wasAtBottom ? newScrollHeight : before.scrollTop + delta, wasAtBottom };
}

/**
 * Late content resize (images, link previews) changing heights ABOVE the
 * viewport: keep the user's reading position by compensating for the height
 * delta. If the reader was near the bottom BEFORE the resize, sticky-to-
 * latest wins and they follow to the new bottom.
 */
export function adjustScrollTopAfterResize(
  before: ScrollGeometry,
  after: ScrollGeometry,
  atBottomThresholdPx = 120,
): number {
  if (shouldStickToLatest(before, atBottomThresholdPx)) return after.scrollHeight;
  const growth = after.scrollHeight - before.scrollHeight;
  return after.scrollTop + Math.max(0, growth);
}
