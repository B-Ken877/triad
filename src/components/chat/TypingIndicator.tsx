/** Live typing indicator. The label comes from `typingLabel()` (pure util). */
export function TypingIndicator({ label }: { label: string }) {
  if (!label) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="typing-indicator"
      className="px-4 py-1 text-xs italic text-neutral-500 dark:text-neutral-400"
    >
      {label}…
    </div>
  );
}
