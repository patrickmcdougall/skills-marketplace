import { NextRequest } from "next/server";
import { serverDb } from "@/lib/db";
import { isBot } from "@/lib/bot";
import { TRACK_EVENTS, MAX_SLUG_LEN, MAX_DETAIL_LEN } from "@/lib/track";

const ALLOWED_EVENTS = new Set<string>(TRACK_EVENTS);
const SLUG_SHAPE = /^[a-zA-Z0-9._-]+$/;

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

  // Reject (don't truncate) over-long slugs — a sliced slug matches no real
  // skill and would be silent data corruption.
  const skillSlug =
    typeof payload.skillSlug === "string" &&
    payload.skillSlug.length <= MAX_SLUG_LEN &&
    SLUG_SHAPE.test(payload.skillSlug)
      ? payload.skillSlug
      : null;
  // Only feedback_comment legitimately carries free text; strip a trailing
  // lone surrogate the cap can create by splitting an emoji.
  const detail =
    event === "feedback_comment" && typeof payload.detail === "string"
      ? payload.detail.slice(0, MAX_DETAIL_LEN).replace(/[\uD800-\uDBFF]$/, "") || null
      : null;

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
