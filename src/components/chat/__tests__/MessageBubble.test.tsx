// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MessageBubble } from "@/components/chat/MessageBubble";

afterEach(cleanup);

describe("MessageBubble", () => {
  it("renders sender name for incoming messages only", () => {
    render(
      <MessageBubble senderName="Agent GLM" text="hello" timeLabel="10:00" mine={false} />,
    );
    expect(screen.getByText("Agent GLM")).toBeTruthy();
    expect(screen.getByText("hello")).toBeTruthy();
  });

  it("hides sender name for own messages", () => {
    render(<MessageBubble senderName="Me" text="hi" timeLabel="10:01" mine />);
    expect(screen.queryByText("Me")).toBeNull();
  });

  it("shows delivery indicator for outgoing messages", () => {
    render(<MessageBubble senderName="Me" text="hi" timeLabel="10:01" mine state="read" />);
    expect(screen.getByLabelText("Delivery: Read")).toBeTruthy();
  });

  it("shows no delivery indicator for incoming messages", () => {
    render(<MessageBubble senderName="A" text="x" timeLabel="t" mine={false} />);
    expect(screen.queryByTestId("delivery-indicator")).toBeNull();
  });

  it.each(["pending", "sent", "delivered", "read", "failed"] as const)(
    "renders state %s without crashing",
    (state) => {
      render(<MessageBubble senderName="Me" text="x" timeLabel="t" mine state={state} />);
      expect(screen.getByTestId("delivery-indicator")).toBeTruthy();
    },
  );

  it("offers Retry only for failed outgoing messages with a clientMsgId and handler", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <MessageBubble
        senderName="Me"
        text="x"
        timeLabel="t"
        mine
        state="failed"
        clientMsgId="cmid-9"
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByTestId("retry-button"));
    expect(onRetry).toHaveBeenCalledWith("cmid-9");

    rerender(
      <MessageBubble senderName="Me" text="x" timeLabel="t" mine state="sent" clientMsgId="cmid-9" onRetry={onRetry} />,
    );
    expect(screen.queryByTestId("retry-button")).toBeNull();

    rerender(
      <MessageBubble senderName="Me" text="x" timeLabel="t" mine state="failed" />,
    );
    expect(screen.queryByTestId("retry-button")).toBeNull();
  });

  it("preserves multiline text with whitespace-pre-wrap", () => {
    render(<MessageBubble senderName="Me" text={"line1\nline2"} timeLabel="t" mine />);
    const p = screen.getByText(
      (_content, el) => el?.tagName === "P" && el.textContent === "line1\nline2",
    );
    expect(p).toHaveClass("whitespace-pre-wrap");
  });
});
