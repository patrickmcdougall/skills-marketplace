import { describe, it, expect, vi, afterEach } from "vitest";
import { track } from "./track";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("track", () => {
  it("uses sendBeacon when available and successful (no fetch)", async () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("fetch", fetchMock);

    track("install_download", "my-skill");

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0];
    expect(url).toBe("/api/event");
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await blob.text())).toEqual({
      event: "install_download",
      skillSlug: "my-skill",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to fetch when sendBeacon returns false", () => {
    const sendBeacon = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("fetch", fetchMock);

    track("feedback_comment", "my-skill", "it broke");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/event");
    expect(init.method).toBe("POST");
    expect(init.keepalive).toBe(true);
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({
      event: "feedback_comment",
      skillSlug: "my-skill",
      detail: "it broke",
    });
  });

  it("falls back to fetch when sendBeacon is not implemented", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("navigator", {}); // no sendBeacon
    vi.stubGlobal("fetch", fetchMock);

    track("feedback_up", "my-skill");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never throws when fetch rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("fetch", fetchMock);

    expect(() => track("copy_for_slack", "my-skill")).not.toThrow();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // flush the rejected promise; the internal .catch must swallow it
    await new Promise((r) => setTimeout(r, 0));
  });

  it("never throws when navigator is missing entirely", () => {
    vi.stubGlobal("navigator", undefined);
    vi.stubGlobal("fetch", undefined);

    expect(() => track("install_claude_code", "my-skill")).not.toThrow();
  });

  it("never throws when sendBeacon itself throws", () => {
    const sendBeacon = vi.fn(() => {
      throw new Error("beacon exploded");
    });
    vi.stubGlobal("navigator", { sendBeacon });

    expect(() => track("install_copy_command", "my-skill")).not.toThrow();
  });
});
