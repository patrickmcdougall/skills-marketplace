// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyForSlack } from "./CopyForSlack";
import { track } from "@/lib/track";

vi.mock("@/lib/track");

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CopyForSlack", () => {
  it("copy button click tracks copy_for_slack and writes title, best-for line and URL to the clipboard", async () => {
    const user = userEvent.setup();
    render(<CopyForSlack title="My Skill" bestFor="reviewing PRs" slug="my-skill" />);

    // jsdom has no navigator.clipboard; replace userEvent's stub with our mock
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await user.click(screen.getByRole("button", { name: /copy for slack/i }));

    expect(track).toHaveBeenCalledWith("copy_for_slack", "my-skill");
    expect(writeText).toHaveBeenCalledWith(
      `My Skill — reviewing PRs\n${window.location.origin}/skills/my-skill`
    );
    expect(screen.getByText("Copied — paste it in Slack")).toBeTruthy();
  });

  it("null bestFor copies title and URL only", async () => {
    const user = userEvent.setup();
    render(<CopyForSlack title="My Skill" bestFor={null} slug="my-skill" />);

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await user.click(screen.getByRole("button", { name: /copy for slack/i }));

    expect(writeText).toHaveBeenCalledWith(
      `My Skill\n${window.location.origin}/skills/my-skill`
    );
  });
});
