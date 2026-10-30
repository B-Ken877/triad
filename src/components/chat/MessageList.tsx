"use client";

/**
 * Conversation list — stable ordering, day separators, delivery states and
 * every conversation-level state (loading, empty, offline/reconnecting,
 * error). Domain-neutral: participants are generic, formatting is injected,
 * transport/persistence live behind the caller (issue #3).
 */

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { MessageBubble } from "./MessageBubble";
import { ChatStatus } from "./ChatStatus";
import { useChatScroll } from "./useChatScroll";
import { buildTimeline, compareMessages, type DayLabelFormatter, type TimelineMessage } from "@/lib/chat/timeline";
import type { ChatListStateProps, ChatMessageView } from "./types";

export interface MessageListProps extends ChatListStateProps {
  messages: readonly ChatMessageView[];
  /** Injected day-label + time formatting keeps rendering deterministic. */
  formatDayLabel: DayLabelFormatter;
  formatTime: (timestamp: number) => string;
  /** Called with the clientMsgId when the user retries a failed send. */
  onRetryMessage?: (clientMsgId: string) => void;
  /** Controlled jump-to-latest; defaults to internal scroll heuristics. */
  showJumpToLatest?: boolean;
  onJumpToLatest?: () => void;
  /** Called when the user chooses to retry after the error state. */
  onErrorRetry?: () => void;
  /** Renders typing/presence affordances between list and composer. */
  footer?: ReactNode;
  /** Accessible label for the conversation region. */
  ariaLabel?: string;
}

export function MessageList({
  messages,
  status,
  connection,
  errorMessage,
  emptyMessage,
  formatDayLabel,
  formatTime,
  onRetryMessage,
  showJumpToLatest,
  onJumpToLatest,
  onErrorRetry,
  footer,
  ariaLabel = "Conversation",
}: MessageListProps) {
  const {
    containerRef,
    bottomRef,
    showJumpToLatest: stickToBottom,
    onScroll,
    scrollToLatest,
  } = useChatScroll();
  const ordered = useMemo(() => [...messages].sort(compareMessages), [messages]);
  const rows = useMemo(() => buildTimeline(ordered, formatDayLabel), [ordered, formatDayLabel]);

  // Keep the viewport pinned to the latest message whenever the list grows
  // while the user was near the bottom. Stickiness is approximated by the
  // internal jump-affordance state maintained in the scroll hook's onScroll.
  const prevCountRef = useRef(0);
  const wasNearBottomRef = useRef(true);
  useEffect(() => {
    wasNearBottomRef.current = containerRef.current ? !stickToBottom : true;
  });
  useEffect(() => {
    const grew = ordered.length > prevCountRef.current;
    prevCountRef.current = ordered.length;
    if (grew && wasNearBottomRef.current) scrollToLatest();
  }, [ordered.length, scrollToLatest]);

  const jumpVisible = showJumpToLatest ?? stickToBottom;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" aria-label={ariaLabel}>
      {(connection === "offline" || connection === "reconnecting") && (
        <ChatStatus variant={connection} />
      )}

      {status === "loading" ? (
        <ChatStatus variant="loading" />
      ) : status === "error" ? (
        <ChatStatus variant="error" message={errorMessage} onRetry={onErrorRetry} />
      ) : ordered.length === 0 ? (
        <ChatStatus variant="empty" message={emptyMessage} />
      ) : (
        <div
          ref={containerRef}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-label={ariaLabel}
          className="flex-1 overflow-y-auto px-3 py-2"
        >
          {rows.map((row) =>
            row.type === "day-separator" ? (
              <div
                key={row.key}
                role="separator"
                aria-label={row.label}
                className="my-3 flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400"
              >
                <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                {row.label}
                <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
              </div>
            ) : (
              <BubbleRow
                key={row.key}
                message={row.message}
                isFirstOfSender={row.isFirstOfSender}
                isLastOfSender={row.isLastOfSender}
                timeLabel={formatTime(row.message.createdAt)}
                onRetryMessage={onRetryMessage}
              />
            ),
          )}
          <div ref={bottomRef} aria-hidden="true" />
        </div>
      )}

      {status === "ready" && ordered.length > 0 && jumpVisible && (
        <button
          type="button"
          data-testid="jump-to-latest"
          onClick={() => (onJumpToLatest ? onJumpToLatest() : scrollToLatest("smooth"))}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900/85 px-3 py-1.5 text-xs font-medium text-white shadow focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-white/90 dark:text-neutral-900"
        >
          Jump to latest ↓
        </button>
      )}

      {footer}
    </div>
  );
}

function BubbleRow({
  message,
  isFirstOfSender,
  isLastOfSender,
  timeLabel,
  onRetryMessage,
}: {
  message: ChatMessageView;
  isFirstOfSender: boolean;
  isLastOfSender: boolean;
  timeLabel: string;
  onRetryMessage?: (clientMsgId: string) => void;
}) {
  return (
    <MessageBubble
      senderName={message.senderName}
      text={message.text}
      timeLabel={timeLabel}
      mine={message.mine}
      state={message.state}
      isFirstOfSender={isFirstOfSender}
      isLastOfSender={isLastOfSender}
      clientMsgId={message.clientMsgId}
      onRetry={onRetryMessage}
    />
  );
}

export type { TimelineMessage };
