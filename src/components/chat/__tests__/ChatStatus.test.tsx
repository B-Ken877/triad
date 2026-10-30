// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ChatStatus } from "@/components/chat/ChatStatus";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

afterEach(cleanup);

describe("ChatStatus", () => {
  it.each([
    ["loading", "Loading conversation…"],
    ["empty", "No messages yet — say hello."],
    ["offline", "You are offline. Messages will sync when you reconnect."],
    ["reconnecting", "Reconnecting…"],
    ["error", "Something went wrong loading this conversation."],
  ] as const)("renders %s with a generic, domain-neutral default", (variant, text) => {
    render(<ChatStatus variant={variant} />);
    expect(screen.getByText(text)).toBeTruthy();
  });

  it("offline/reconnecting expose a polite status banner", () => {
    render(<ChatStatus variant="reconnecting" />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("error offers retry and fires it once", async () => {
    const onRetry = vi.fn();
    render(<ChatStatus variant="error" onRetry={onRetry} />);
    await userEvent.setup().click(screen.getByTestId("status-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("error without handler shows no retry button", () => {
    render(<ChatStatus variant="error" />);
    expect(screen.queryByTestId("status-retry")).toBeNull();
  });

  it("supports custom message overrides", () => {
    render(<ChatStatus variant="empty" message="This channel is new." />);
    expect(screen.getByText("This channel is new.")).toBeTruthy();
  });
});

describe("TypingIndicator", () => {
  it("renders the label with a live region", () => {
    render(<TypingIndicator label="Ava and Noel are typing" />);
    const el = screen.getByTestId("typing-indicator");
    expect(el).toHaveTextContent("Ava and Noel are typing…");
    expect(el.getAttribute("aria-live")).toBe("polite");
  });

  it("renders nothing when the label is empty", () => {
    render(<TypingIndicator label="" />);
    expect(screen.queryByTestId("typing-indicator")).toBeNull();
  });
});
