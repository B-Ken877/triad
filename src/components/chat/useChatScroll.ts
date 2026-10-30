"use client";

/**
 * Thin React binding for the pure scroll utilities. The math lives in
 * `lib/chat/scroll.ts` (unit-tested without a browser); this hook only
 * translates DOM refs into geometry and applies the results.
 */

import { useCallback, useRef, useState } from "react";
import {
  adjustScrollTopAfterPrepend,
  adjustScrollTopAfterResize,
  shouldShowJumpToLatest,
  type ScrollGeometry,
} from "@/lib/chat/scroll";

export interface ChatScrollController {
  containerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  /** Whether the jump-to-latest affordance should show (updated on scroll). */
  showJumpToLatest: boolean;
  onScroll: () => void;
  /** Scroll to the latest message (used by the jump button and new sends). */
  scrollToLatest: (behavior?: ScrollBehavior) => void;
  /** Call BEFORE rendering a prepended history page: captures geometry. */
  captureBeforePrepend: () => ScrollGeometry | null;
  /** Call AFTER the prepend rendered: restores reading position. */
  settleAfterPrepend: (before: ScrollGeometry | null) => void;
  /** Call BEFORE late content growth (images loading): captures height. */
  captureBeforeResize: () => ScrollGeometry | null;
  /** Call AFTER the content grew: preserves the reading position. */
  settleAfterResize: (before: ScrollGeometry | null) => void;
}

export function useChatScroll(atBottomThresholdPx = 120, jumpThresholdPx = 400): ChatScrollController {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);

  const geometry = useCallback((): ScrollGeometry | null => {
    const el = containerRef.current;
    if (!el) return null;
    return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = bottomRef.current;
    // jsdom (tests) does not implement scrollIntoView; guard keeps tests honest.
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior, block: "end" });
    }
  }, []);

  const onScroll = useCallback(() => {
    const g = geometry();
    if (g) setShowJump(shouldShowJumpToLatest(g, jumpThresholdPx));
  }, [geometry, jumpThresholdPx]);

  const captureBeforePrepend = useCallback(() => geometry(), [geometry]);

  const settleAfterPrepend = useCallback(
    (before: ScrollGeometry | null) => {
      const el = containerRef.current;
      if (!el || !before) return;
      const { scrollTop } = adjustScrollTopAfterPrepend(before, el.scrollHeight, atBottomThresholdPx);
      el.scrollTop = scrollTop;
    },
    [atBottomThresholdPx],
  );

  const captureBeforeResize = useCallback(() => geometry(), [geometry]);

  const settleAfterResize = useCallback(
    (before: ScrollGeometry | null) => {
      const el = containerRef.current;
      if (!el || !before) return;
      const after: ScrollGeometry = {
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
      el.scrollTop = adjustScrollTopAfterResize(before, after, atBottomThresholdPx);
    },
    [atBottomThresholdPx],
  );

  return {
    containerRef,
    bottomRef,
    showJumpToLatest: showJump,
    onScroll,
    scrollToLatest,
    captureBeforePrepend,
    settleAfterPrepend,
    captureBeforeResize,
    settleAfterResize,
  };
}
