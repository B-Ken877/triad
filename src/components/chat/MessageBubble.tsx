import type { OutgoingMessageState } from "@/lib/chat/types";

/** Visible delivery label + tone for an outgoing bubble's state. */
export function deliveryIndicator(
  state: OutgoingMessageState | undefined,
): { label: string; tone: "pending" | "ok" | "failed" } {
  switch (state) {
    case "pending":
      return { label: "Sending…", tone: "pending" };
    case "failed":
      return { label: "Failed", tone: "failed" };
    case "delivered":
      return { label: "Delivered", tone: "ok" };
    case "read":
      return { label: "Read", tone: "ok" };
    case "sent":
    case undefined:
      return { label: "Sent", tone: "ok" };
  }
}

export interface MessageBubbleProps {
  senderName: string;
  text: string;
  /** Preformatted time label (caller owns formatting/locale). */
  timeLabel: string;
  mine: boolean;
  /** Outgoing lifecycle; omit for incoming messages. */
  state?: OutgoingMessageState;
  /** Visual grouping hints from the timeline builder. */
  isFirstOfSender?: boolean;
  isLastOfSender?: boolean;
  /** When set on a FAILED outgoing bubble, a Retry button is offered. */
  clientMsgId?: string;
  onRetry?: (clientMsgId: string) => void;
}

/**
 * One message bubble. Domain-neutral: sender names, timestamps and delivery
 * states are plain props; grouping comes from the timeline builder.
 */
export function MessageBubble({
  senderName,
  text,
  timeLabel,
  mine,
  state,
  isFirstOfSender = true,
  isLastOfSender = true,
  clientMsgId,
  onRetry,
}: MessageBubbleProps) {
  const indicator = deliveryIndicator(state);
  const canRetry = mine && state === "failed" && typeof clientMsgId === "string" && !!onRetry;
  return (
    <div
      className={`flex w-full ${mine ? "justify-end" : "justify-start"} ${isLastOfSender ? "mb-2" : "mb-0.5"}`}
      data-mine={mine ? "true" : "false"}
    >
      <div className={`max-w-[85%] sm:max-w-[70%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
        {!mine && isFirstOfSender && (
          <span className="mb-0.5 px-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {senderName}
          </span>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words ${
            mine
              ? "rounded-br-sm bg-emerald-700 text-white"
              : "rounded-bl-sm bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          } ${indicator.tone === "failed" ? "opacity-90 ring-1 ring-red-400" : ""}`}
        >
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
        <div className="mt-0.5 flex items-center gap-2 px-1 text-xs text-neutral-500 dark:text-neutral-400">
          <span>{timeLabel}</span>
          {mine && (
            <span
              data-testid="delivery-indicator"
              aria-label={`Delivery: ${indicator.label}`}
              className={
                indicator.tone === "failed"
                  ? "font-medium text-red-600 dark:text-red-400"
                  : indicator.tone === "pending"
                    ? "italic"
                    : ""
              }
            >
              {indicator.label}
            </span>
          )}
          {canRetry && (
            <button
              type="button"
              data-testid="retry-button"
              onClick={() => onRetry?.(clientMsgId!)}
              className="rounded border border-red-500 px-1.5 py-0.5 font-medium text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-red-400 dark:hover:bg-red-950"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
