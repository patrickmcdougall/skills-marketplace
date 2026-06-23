import { NextRequest } from "next/server";
import { serverDb } from "@/lib/db";
import { isBot } from "@/lib/bot";
import {
  TRACK_EVENTS,
  FREE_TEXT_EVENTS,
  MAX_SLUG_LEN,
  MAX_DETAIL_LEN,
  MAX_CONTACT_LEN,
} from "@/lib/track";

const ALLOWED_EVENTS = new Set<string>(TRACK_EVENTS);
const SLUG_SHAPE = /^[a-zA-Z0-9._-]+$/;

export async function POST(req: NextRequest) {
  let payload: { event?: unknown; skillSlug?: unknown; detail?: unknown; contact?: unknown };
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
  // Only free-text events (feedback_comment, site_feedback) carry a message;
  // strip a trailing lone surrogate the cap can create by splitting an emoji.
  const detail =
    FREE_TEXT_EVENTS.has(event) && typeof payload.detail === "string"
      ? payload.detail.slice(0, MAX_DETAIL_LEN).replace(/[\uD800-\uDBFF]$/, "") || null
      : null;
  // Optional contact, only on site_feedback — lets a visitor leave an email
  // so we can follow up. Trimmed and capped; never required.
  const contact =
    event === "site_feedback" && typeof payload.contact === "string" && payload.contact.trim()
      ? payload.contact.trim().slice(0, MAX_CONTACT_LEN)
      : null;

  // site_feedback is the only event a visitor sends on purpose, so report
  // whether it actually saved; telemetry events stay silent (always ok).
  try {
    const { error } = await serverDb()
      .from("site_event")
      .insert({ event, skill_slug: skillSlug, detail, contact });
    if (error) {
      console.error("site_event insert failed:", error.message);
      if (event === "site_feedback") return Response.json({ ok: false }, { status: 500 });
    }
  } catch (err) {
    console.error("site_event insert threw:", err);
    if (event === "site_feedback") return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
