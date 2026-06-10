import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serverDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const ALLOWED_EVENTS = new Set([
  "install_download",
  "install_claude_code",
  "install_copy_command",
  "copy_for_slack",
  "feedback_up",
  "feedback_down",
  "feedback_comment",
]);

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

  const event = typeof payload.event === "string" ? payload.event : "";
  if (!ALLOWED_EVENTS.has(event) || isBot(req)) {
    // Silently accept so clients never retry or surface errors.
    return Response.json({ ok: true });
  }

  const skillSlug =
    typeof payload.skillSlug === "string" ? payload.skillSlug.slice(0, 200) : null;
  const detail =
    typeof payload.detail === "string" ? payload.detail.slice(0, 500) : null;

  try {
    await serverDb().from("site_event").insert({ event, skill_slug: skillSlug, detail });
  } catch {
    // Never fail the client over telemetry.
  }
  return Response.json({ ok: true });
}
