import { NextRequest } from "next/server";
import { serverDb } from "@/lib/db";
import { TRACK_EVENTS, MAX_SLUG_LEN, MAX_DETAIL_LEN } from "@/lib/track";

const ALLOWED_EVENTS = new Set<string>(TRACK_EVENTS);
const SLUG_SHAPE = /^[a-zA-Z0-9._-]+$/;

function isBot(req: NextRequest): boolean {
  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  return ua.includes("bot") || ua.includes("crawler") || ua.includes("spider");
}

export async function POST(req: NextRequest) {
  let payload: { event?: unknown; skillSlug?: unknown; detail?: unknown };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (payload === null || typeof payload !== "object") {
    return Response.json({ ok: false }, { status: 400 });
  }

  const event = typeof payload.event === "string" ? payload.event : "";
  if (!ALLOWED_EVENTS.has(event) || isBot(req)) {
    // Silently accept so clients never retry or surface errors.
    return Response.json({ ok: true });
  }

  const rawSlug =
    typeof payload.skillSlug === "string" ? payload.skillSlug.slice(0, MAX_SLUG_LEN) : null;
  const skillSlug = rawSlug && SLUG_SHAPE.test(rawSlug) ? rawSlug : null;
  const detail =
    typeof payload.detail === "string" ? payload.detail.slice(0, MAX_DETAIL_LEN) : null;

  // Never fail the client over telemetry — but always leave an ops trace,
  // since supabase-js reports DB errors by resolving { error }, not throwing.
  try {
    const { error } = await serverDb()
      .from("site_event")
      .insert({ event, skill_slug: skillSlug, detail });
    if (error) console.error("site_event insert failed:", error.message);
  } catch (err) {
    console.error("site_event insert threw:", err);
  }
  return Response.json({ ok: true });
}
