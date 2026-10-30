// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MessageList } from "@/components/chat/MessageList";
import type { ChatMessageView } from "@/components/chat/types";

afterEach(cleanup);

const DAY1 = Date.UTC(2026, 5, 15, 9, 0, 0);
const DAY2 = Date.UTC(2026, 5, 16, 9, 0, 0);

const view = (overrides: Partial<ChatMessageView> & { id: string }): ChatMessageView => ({
  senderId: "u1",
  senderName: "U1",
  text: `msg-${overrides.id}`,
  createdAt: DAY1,
  mine: false,
  ...overrides,
});

const fmtDay = (ts: number) => `DAY-${new Date(ts).toISOString().slice(0, 10)}`;
const fmtTime = () => "09:00";

function renderList(overrides: Partial<Parameters<typeof MessageList>[0]> = {}) {
  const props: Parameters<typeof MessageList>[0] = {
    messages: [],
    status: "ready",
    connection: "online",
    formatDayLabel: fmtDay,
    formatTime: fmtTime,
    ...overrides,
  };
  return render(<MessageList {...props} />);
}

describe("MessageList", () => {
  it("renders messages with deterministic ordering regardless of input order", () => {
    renderList({
      messages: [view({ id: "b", createdAt: DAY1 + 1000 }), view({ id: "a", createdAt: DAY1 })],
    });
    const log = screen.getByRole("log");
    expect(log.textContent).toContain("msg-a");
    expect(log.textContent).toContain("msg-b");
    // a must precede b in DOM order
    expect(log.textContent!.indexOf("msg-a")).toBeLessThan(log.textContent!.indexOf("msg-b"));
  });

  it("shows day separators from the injected formatter", () => {
    renderList({
      messages: [view({ id: "a", createdAt: DAY1 }), view({ id: "b", createdAt: DAY2 })],
    });
    expect(screen.getAllByText("DAY-2026-06-15")).toHaveLength(1);
    expect(screen.getAllByText("DAY-2026-06-16")).toHaveLength(1);
  });

  it("empty state when ready with no messages", () => {
    renderList({ messages: [] });
    expect(screen.getByText("No messages yet — say hello.")).toBeTruthy();
  });

  it("loading state hides the log", () => {
    renderList({ status: "loading", messages: [view({ id: "a" })] });
    expect(screen.queryByRole("log")).toBeNull();
    expect(screen.getByText("Loading conversation…")).toBeTruthy();
  });

  it("error state with retry callback", async () => {
    const onRetry = vi.fn();
    renderList({ status: "error", errorMessage: "DB unavailable", onErrorRetry: onRetry });
    expect(screen.getByRole("alert")).toBeTruthy();
    await userEvent.setup().click(screen.getByTestId("status-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each(["offline", "reconnecting"] as const)("shows %s connection banner", (connection) => {
    renderList({ connection, messages: [view({ id: "a" })] });
    expect(screen.getByTestId("connection-banner")).toBeTruthy();
  });

  it("no banner while online", () => {
    renderList({ connection: "online", messages: [view({ id: "a" })] });
    expect(screen.queryByTestId("connection-banner")).toBeNull();
  });

  it("failed outgoing message exposes retry wired to onRetryMessage", async () => {
    const onRetryMessage = vi.fn();
    renderList({
      messages: [view({ id: "a", mine: true, state: "failed", clientMsgId: "cmid-7" })],
      onRetryMessage,
    });
    await userEvent.setup().click(screen.getByTestId("retry-button"));
    expect(onRetryMessage).toHaveBeenCalledExactlyOnceWith("cmid-7");
  });

  it("jump-to-latest appears when controlled-visible and fires the callback", async () => {
    const onJump = vi.fn();
    renderList({
      messages: [view({ id: "a" })],
      showJumpToLatest: true,
      onJumpToLatest: onJump,
    });
    await userEvent.setup().click(screen.getByTestId("jump-to-latest"));
    expect(onJump).toHaveBeenCalledTimes(1);
  });

  it("jump-to-latest hidden when controlled-hidden", () => {
    renderList({ messages: [view({ id: "a" })], showJumpToLatest: false });
    expect(screen.queryByTestId("jump-to-latest")).toBeNull();
  });

  it("renders a footer node (typing indicator slot)", () => {
    renderList({
      messages: [view({ id: "a" })],
      footer: <div data-testid="footer-slot">typing…</div>,
    });
    expect(screen.getByTestId("footer-slot")).toBeTruthy();
  });

  it("preserves multiline message text", () => {
    renderList({ messages: [view({ id: "a", text: "one\ntwo" })] });
    const p = screen.getByText(
      (_content, el) => el?.tagName === "P" && el.textContent === "one\ntwo",
    );
    expect(p).toBeInTheDocument();
  });
});
