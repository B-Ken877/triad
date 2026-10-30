"use client";

/**
 * Message composer — text entry with send-state and keyboard accessibility.
 *
 * Contract: Enter sends, Shift+Enter inserts a newline. The component knows
 * NOTHING about transports or idempotency; the caller wires `onSend` into the
 * reliability layer (clientMsgId, optimistic pending, retry). While `sending`
 * or `disabled`, the composer cannot submit.
 */

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export interface ComposerProps {
  onSend: (text: string) => void | Promise<void>;
  /** A send is in flight (optimistic pending accepted, awaiting settle). */
  sending?: boolean;
  /** Hard block (no permission, disconnected, etc.). */
  disabled?: boolean;
  /** Disabled-reason surfaced to assistive tech when `disabled` is set. */
  disabledReason?: string;
  /** Transient send error to display under the input. */
  errorMessage?: string;
  placeholder?: string;
}

export function Composer({
  onSend,
  sending = false,
  disabled = false,
  disabledReason,
  errorMessage,
  placeholder = "Write a message…",
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [composing, setComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ariaDescribedBy = useId();
  const blocked = disabled || sending || composing;

  const submit = () => {
    const text = value.trim();
    if (!text || blocked) return;
    // Optimistic UI: clear immediately. Failures are surfaced by the caller
    // via `errorMessage` + the pending entry's failed state — never by
    // throwing into React (sync throw and promise rejection are both swallowed).
    try {
      const result = onSend(text);
      void Promise.resolve(result).catch(() => undefined);
    } catch {
      /* caller surfaces the failure through its own state */
    }
    setValue("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-neutral-200 p-3 dark:border-neutral-800"
      aria-label="Message composer"
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          disabled={disabled}
          aria-disabled={disabled}
          aria-describedby={disabled && disabledReason ? ariaDescribedBy : undefined}
          aria-label="Message text"
          rows={1}
          placeholder={placeholder}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700"
        />
        <button
          type="submit"
          data-testid="send-button"
          disabled={blocked}
          aria-disabled={blocked}
          aria-label={sending ? "Sending message" : "Send message"}
          className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
      {disabled && disabledReason && (
        <p id={ariaDescribedBy} className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {disabledReason}
        </p>
      )}
      {errorMessage && (
        <p role="alert" data-testid="composer-error" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
