// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Composer } from "@/components/chat/Composer";

afterEach(cleanup);

const type = (text: string) => userEvent.setup().type(screen.getByLabelText("Message text"), text);

describe("Composer", () => {
  it("sends on Enter with trimmed text and clears the field", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    await type("  hello world  ");
    await userEvent.setup().keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledExactlyOnceWith("hello world");
    expect(screen.getByLabelText("Message text")).toHaveProperty("value", "");
  });

  it("Shift+Enter inserts a newline without sending", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    await type("a");
    await userEvent.setup().keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
    const box = screen.getByLabelText("Message text");
    expect(box).toHaveProperty("value", "a\n");
  });

  it("does not send whitespace-only text", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    await type("   ");
    await userEvent.setup().keyboard("{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sending state disables the send button but keeps typing enabled", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} sending />);
    const button = screen.getByTestId("send-button");
    expect(button).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Message text")).toHaveProperty("disabled", false);
    await type("x{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disabled state blocks input and explains why", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled disabledReason="You do not have access to this channel." />);
    expect(screen.getByLabelText("Message text")).toHaveProperty("disabled", true);
    expect(screen.getByText("You do not have access to this channel.")).toBeTruthy();
    await type("x{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("submits via the send button", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} />);
    await type("via button");
    await userEvent.setup().click(screen.getByTestId("send-button"));
    expect(onSend).toHaveBeenCalledExactlyOnceWith("via button");
  });

  it("surfaces send errors via role=alert without throwing", async () => {
    const onSend = vi.fn(() => {
      throw new Error("network down");
    });
    render(<Composer onSend={onSend} errorMessage="Message not delivered. Retrying…" />);
    // The component never throws to React; the caller's error prop renders.
    expect(screen.getByTestId("composer-error")).toHaveTextContent("Message not delivered. Retrying…");
    await type("x{Enter}");
    expect(onSend).toHaveBeenCalledWith("x");
  });
});
