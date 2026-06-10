// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallCard } from "./InstallCard";
import { track } from "@/lib/track";

vi.mock("@/lib/track");

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const SLUG = "my-skill";
const STORAGE_KEY = `claudinho-fb:${SLUG}`;
const PROPS = {
  slug: SLUG,
  installCommand: "npx claudinho install my-skill",
  sourceUrl: "https://github.com/example/my-skill",
};

const QUESTION = "Did the skill work for you?";
const THANKS = "Thanks for the feedback.";

// In this vitest/jsdom combo window.localStorage has no working methods
// (Node's experimental webstorage shadows it), so stub a real in-memory one.
function makeStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
}
let storage: ReturnType<typeof makeStorage>;

function setup() {
  const user = userEvent.setup();
  render(<InstallCard {...PROPS} />);
  // userEvent.setup() installs its own clipboard stub; replace it afterwards
  // so we control writeText (jsdom has no native navigator.clipboard).
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return { user, writeText };
}

async function revealAndCopy(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /copy install command/i }));
  await user.click(screen.getByRole("button", { name: "copy" }));
}

beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("InstallCard install actions", () => {
  it("copy install command: reveals the command, copy fires track and shows feedback prompt", async () => {
    const { user, writeText } = setup();

    // command hidden initially
    expect(document.querySelector(".cmd")).toBeNull();
    expect(screen.queryByText(QUESTION)).toBeNull();

    const toggle = screen.getByRole("button", { name: /copy install command/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.click(toggle);

    // command revealed
    expect(screen.getByText(PROPS.installCommand)).toBeTruthy();
    expect(screen.getByRole("button", { name: /hide command/i }).getAttribute("aria-expanded")).toBe("true");

    await user.click(screen.getByRole("button", { name: "copy" }));

    expect(track).toHaveBeenCalledWith("install_copy_command", SLUG);
    expect(writeText).toHaveBeenCalledWith(PROPS.installCommand);
    expect(screen.getByText("copied")).toBeTruthy();
    expect(screen.getByText(QUESTION)).toBeTruthy();
  });

  it("Open in Claude Code: fires track and shows feedback prompt", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /open in claude code/i }));

    expect(track).toHaveBeenCalledWith("install_claude_code", SLUG);
    expect(screen.getByText("Opening Claude Code…")).toBeTruthy();
    expect(screen.getByText(QUESTION)).toBeTruthy();
  });

  it("Download .skill link: fires track and shows feedback prompt", async () => {
    const { user } = setup();
    // jsdom can't navigate; swallow the default action of the anchor click
    const preventNav = (e: Event) => e.preventDefault();
    document.addEventListener("click", preventNav);

    try {
      const link = screen.getByRole("link", { name: /download \.skill/i });
      expect(link.getAttribute("href")).toBe(`/i/${SLUG}`);
      await user.click(link);
    } finally {
      document.removeEventListener("click", preventNav);
    }

    expect(track).toHaveBeenCalledWith("install_download", SLUG);
    expect(screen.getByText(QUESTION)).toBeTruthy();
  });
});

describe("FeedbackPrompt", () => {
  it("already-given feedback (localStorage marker) renders thanks instead of the question", async () => {
    storage.setItem(STORAGE_KEY, "1");
    const { user } = setup();

    await revealAndCopy(user);

    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(screen.getByText(THANKS)).toBeTruthy();
  });

  it("localStorage.getItem throwing still renders the question", async () => {
    storage.getItem.mockImplementation(() => {
      throw new Error("storage blocked");
    });
    const { user } = setup();

    await revealAndCopy(user);

    expect(screen.getByText(QUESTION)).toBeTruthy();
    expect(screen.queryByText(THANKS)).toBeNull();
  });

  it("thumbs up: tracks feedback_up, writes the marker, shows thanks", async () => {
    const { user } = setup();
    await revealAndCopy(user);

    await user.click(screen.getByRole("button", { name: "Yes, it worked" }));

    expect(track).toHaveBeenCalledWith("feedback_up", SLUG);
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "1");
    expect(screen.getByText(THANKS)).toBeTruthy();
    expect(screen.queryByText(QUESTION)).toBeNull();
  });

  it("thumbs down: tracks feedback_down, writes the marker, reveals the comment input", async () => {
    const { user } = setup();
    await revealAndCopy(user);

    await user.click(screen.getByRole("button", { name: "No, something went wrong" }));

    expect(track).toHaveBeenCalledWith("feedback_down", SLUG);
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, "1");
    expect(screen.getByPlaceholderText("What went wrong? (optional)")).toBeTruthy();
    expect(screen.queryByText(THANKS)).toBeNull();
  });

  it("comment submit with text tracks feedback_comment with the trimmed text and shows thanks", async () => {
    const { user } = setup();
    await revealAndCopy(user);
    await user.click(screen.getByRole("button", { name: "No, something went wrong" }));

    await user.type(screen.getByPlaceholderText("What went wrong? (optional)"), "  it crashed  ");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(track).toHaveBeenCalledWith("feedback_comment", SLUG, "it crashed");
    expect(screen.getByText(THANKS)).toBeTruthy();
  });

  it("comment submit with empty text sends no feedback_comment event but shows thanks", async () => {
    const { user } = setup();
    await revealAndCopy(user);
    await user.click(screen.getByRole("button", { name: "No, something went wrong" }));

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(track).not.toHaveBeenCalledWith("feedback_comment", SLUG, expect.anything());
    expect(screen.getByText(THANKS)).toBeTruthy();
  });

  it("localStorage.setItem throwing does not break the thumbs-up flow", async () => {
    storage.setItem.mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const { user } = setup();
    await revealAndCopy(user);

    await user.click(screen.getByRole("button", { name: "Yes, it worked" }));

    expect(track).toHaveBeenCalledWith("feedback_up", SLUG);
    expect(screen.getByText(THANKS)).toBeTruthy();
  });
});
