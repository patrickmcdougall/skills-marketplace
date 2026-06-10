import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const insertMock = vi.fn();
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: fromMock })),
}));

import { POST } from "./route";

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/event", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });
}

const VALID = JSON.stringify({ event: "install_download", skillSlug: "my-skill" });

describe("POST /api/event", () => {
  beforeEach(() => {
    insertMock.mockReset().mockResolvedValue({ error: null });
    fromMock.mockClear();
    // serverDb() from lib/db.ts validates these at call time
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  });

  describe("invalid JSON", () => {
    it("malformed body → 400 with ok:false and no insert", async () => {
      const res = await POST(makeRequest("{not json"));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false });
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("empty body → 400", async () => {
      const res = await POST(makeRequest(""));
      expect(res.status).toBe(400);
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("JSON body 'null' → 400, no crash", async () => {
      const res = await POST(makeRequest("null"));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ ok: false });
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("JSON body '42' (non-object) → 400", async () => {
      const res = await POST(makeRequest("42"));
      expect(res.status).toBe(400);
      expect(insertMock).not.toHaveBeenCalled();
    });
  });

  describe("event whitelist", () => {
    it("non-whitelisted event → silently accepted, no insert", async () => {
      const res = await POST(makeRequest(JSON.stringify({ event: "drop_tables" })));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("missing event → silently accepted, no insert", async () => {
      const res = await POST(makeRequest(JSON.stringify({ skillSlug: "x" })));
      expect(res.status).toBe(200);
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("non-string event → silently accepted, no insert", async () => {
      const res = await POST(makeRequest(JSON.stringify({ event: 42 })));
      expect(res.status).toBe(200);
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("whitelisted event → inserted into site_event", async () => {
      const res = await POST(makeRequest(VALID, { "user-agent": "Mozilla/5.0" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(fromMock).toHaveBeenCalledWith("site_event");
      expect(insertMock).toHaveBeenCalledWith({
        event: "install_download",
        skill_slug: "my-skill",
        detail: null,
      });
    });
  });

  describe("bot filtering", () => {
    it.each(["Googlebot/2.1", "my-crawler 1.0", "Spider/3"])(
      "user-agent %s → accepted but not inserted",
      async (ua) => {
        const res = await POST(makeRequest(VALID, { "user-agent": ua }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
        expect(insertMock).not.toHaveBeenCalled();
      }
    );

    it("missing user-agent → treated as non-bot, inserted", async () => {
      await POST(makeRequest(VALID));
      expect(insertMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("length caps and coercion", () => {
    it("skillSlug capped at 200 chars", async () => {
      const body = JSON.stringify({ event: "feedback_up", skillSlug: "s".repeat(300) });
      await POST(makeRequest(body));
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ skill_slug: "s".repeat(200) })
      );
    });

    it("detail capped at 500 chars", async () => {
      const body = JSON.stringify({
        event: "feedback_comment",
        skillSlug: "x",
        detail: "d".repeat(900),
      });
      await POST(makeRequest(body));
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ detail: "d".repeat(500) })
      );
    });

    it("non-string skillSlug/detail → stored as null", async () => {
      const body = JSON.stringify({ event: "feedback_up", skillSlug: 5, detail: { a: 1 } });
      await POST(makeRequest(body));
      expect(insertMock).toHaveBeenCalledWith({
        event: "feedback_up",
        skill_slug: null,
        detail: null,
      });
    });

    it("slug failing the shape check (HTML/URL garbage) → stored as null", async () => {
      const body = JSON.stringify({
        event: "feedback_up",
        skillSlug: "<script>alert(1)</script>",
      });
      await POST(makeRequest(body));
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ skill_slug: null })
      );
    });
  });

  describe("insert failure swallowed", () => {
    it("supabase insert rejecting → still ok:true, error logged", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      insertMock.mockRejectedValueOnce(new Error("db down"));
      const res = await POST(makeRequest(VALID));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("supabase insert resolving with { error } → still ok:true, error logged", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      insertMock.mockResolvedValueOnce({ error: { message: "rls denied" } });
      const res = await POST(makeRequest(VALID));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(spy).toHaveBeenCalledWith("site_event insert failed:", "rls denied");
      spy.mockRestore();
    });
  });
});
