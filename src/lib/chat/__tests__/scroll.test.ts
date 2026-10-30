import { describe, expect, it } from "vitest";
import {
  adjustScrollTopAfterPrepend,
  adjustScrollTopAfterResize,
  distanceFromBottom,
  shouldShowJumpToLatest,
  shouldStickToLatest,
  type ScrollGeometry,
} from "@/lib/chat/scroll";

const geom = (scrollTop: number, scrollHeight: number, clientHeight: number): ScrollGeometry => ({
  scrollTop,
  scrollHeight,
  clientHeight,
});

describe("distanceFromBottom / stickiness", () => {
  it("computes distance and stick threshold", () => {
    expect(distanceFromBottom(geom(0, 2000, 500))).toBe(1500);
    expect(distanceFromBottom(geom(1500, 2000, 500))).toBe(0);
    expect(shouldStickToLatest(geom(1400, 2000, 500), 120)).toBe(true); // 100 px away
    expect(shouldStickToLatest(geom(1000, 2000, 500), 120)).toBe(false); // 500 px away
  });

  it("jump-to-latest appears beyond its threshold", () => {
    expect(shouldShowJumpToLatest(geom(0, 2000, 500), 400)).toBe(true); // 1500 px
    expect(shouldShowJumpToLatest(geom(1200, 2000, 500), 400)).toBe(false); // 300 px
  });

  it("clamps negative distances from rounding jitter", () => {
    expect(distanceFromBottom(geom(1600, 2000, 500))).toBe(0);
  });
});

describe("adjustScrollTopAfterPrepend", () => {
  it("anchors the viewport when older pages are prepended", () => {
    const before = geom(800, 3000, 500);
    const result = adjustScrollTopAfterPrepend(before, 4000);
    expect(result.wasAtBottom).toBe(false);
    expect(result.scrollTop).toBe(800 + 1000); // keep visible content stable
  });

  it("follows to the new bottom when the user was at the bottom", () => {
    const before = geom(2500, 3000, 500);
    const result = adjustScrollTopAfterPrepend(before, 4000);
    expect(result.wasAtBottom).toBe(true);
    expect(result.scrollTop).toBe(4000);
  });

  it("handles empty-content growth of zero", () => {
    const before = geom(100, 1000, 500);
    expect(adjustScrollTopAfterPrepend(before, 1000).scrollTop).toBe(100);
  });
});

describe("adjustScrollTopAfterResize", () => {
  it("compensates late growth above the viewport for a mid-scroll reader", () => {
    const before = geom(700, 3000, 500);
    const after = geom(700, 3400, 500); // 400 px grew above
    expect(adjustScrollTopAfterResize(before, after)).toBe(1100);
  });

  it("sticky-to-latest wins when the reader is near the bottom", () => {
    const before = geom(2500, 3000, 500);
    const after = geom(2500, 3400, 500); // now 400 px from bottom
    expect(adjustScrollTopAfterResize(before, after, 120)).toBe(3400);
    const stillNear = geom(2820, 3400, 500); // 80 px away
    expect(adjustScrollTopAfterResize(before, stillNear, 120)).toBe(3400);
  });
});
