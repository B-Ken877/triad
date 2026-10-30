/**
 * Conversation status surfaces: loading, empty, offline/reconnecting, error.
 * Pure presentational; callers own data/transport (issue #3).
 */

export interface ChatStatusProps {
  variant: "loading" | "empty" | "offline" | "reconnecting" | "error";
  /** Custom message override; defaults are generic and domain-neutral. */
  message?: string;
  /** Error variant only: offers a retry action when provided. */
  onRetry?: () => void;
}

const DEFAULTS: Record<ChatStatusProps["variant"], string> = {
  loading: "Loading conversation…",
  empty: "No messages yet — say hello.",
  offline: "You are offline. Messages will sync when you reconnect.",
  reconnecting: "Reconnecting…",
  error: "Something went wrong loading this conversation.",
};

export function ChatStatus({ variant, message, onRetry }: ChatStatusProps) {
  const text = message ?? DEFAULTS[variant];
  if (variant === "offline" || variant === "reconnecting") {
    return (
      <div
        role="status"
        data-testid="connection-banner"
        className="mx-3 my-1 rounded-md bg-amber-100 px-3 py-1.5 text-center text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
      >
        {text}
      </div>
    );
  }
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center"
    >
      {variant === "loading" && (
        <span
          aria-hidden="true"
          className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600 dark:border-neutral-700 dark:border-t-neutral-300"
        />
      )}
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{text}</p>
      {variant === "error" && onRetry && (
        <button
          type="button"
          data-testid="status-retry"
          onClick={onRetry}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Try again
        </button>
      )}
    </div>
  );
}
