// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackTab } from "./FeedbackTab";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const PROMPT = "What were you hoping to find?";
const THANKS = "Thank you — really.";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FeedbackTab", () => {
  it("opens the panel from the floating tab", async () => {
    const user = userEvent.setup();
    render(<FeedbackTab />);
    expect(screen.queryByText(PROMPT)).toBeNull();
    await user.click(screen.getByRole("button", { name: /send feedback/i }));
    expect(screen.getByText(PROMPT)).toBeTruthy();
  });

  it("posts a site_feedback event with the message + contact, then thanks the visitor", async () => {
    const user = userEvent.setup();
    render(<FeedbackTab />);
    await user.click(screen.getByRole("button", { name: /send feedback/i }));

    await user.type(screen.getByLabelText(PROMPT), "I wanted a Notion skill");
    await user.type(screen.getByLabelText(/email/i), "me@example.com");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/event", expect.any(Object)));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      event: "site_feedback",
      detail: "I wanted a Notion skill",
      contact: "me@example.com",
    });
    expect(await screen.findByText(THANKS)).toBeTruthy();
  });

  it("does not submit an empty message", async () => {
    const user = userEvent.setup();
    render(<FeedbackTab />);
    await user.click(screen.getByRole("button", { name: /send feedback/i }));
    await user.click(screen.getByRole("button", { name: /^send$/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an error when the save fails, without losing the typed message", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false }) });
    const user = userEvent.setup();
    render(<FeedbackTab />);
    await user.click(screen.getByRole("button", { name: /send feedback/i }));
    await user.type(screen.getByLabelText(PROMPT), "something broke");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/something went wrong/i)).toBeTruthy();
    // message preserved so the visitor can retry
    expect((screen.getByLabelText(PROMPT) as HTMLTextAreaElement).value).toBe("something broke");
  });
});
