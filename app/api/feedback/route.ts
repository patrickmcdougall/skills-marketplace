import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyFeedback } from "@/lib/notify";

function serverDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const MAX_MESSAGE = 4000;
const MAX_CONTACT = 320;

export async function POST(req: NextRequest) {
  let body: { message?: unknown; contact?: unknown; pathname?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const contact =
    typeof body.contact === "string" && body.contact.trim()
      ? body.contact.trim().slice(0, MAX_CONTACT)
      : null;
  const pathname =
    typeof body.pathname === "string" ? body.pathname.slice(0, 512) : null;

  const referrer = req.headers.get("referer");
  const db = serverDb();
  const { error } = await db.from("skill_feedback").insert({
    message: message.slice(0, MAX_MESSAGE),
    contact,
    pathname,
    referrer,
    user_agent: req.headers.get("user-agent"),
  });

  if (error) {
    return Response.json({ error: "Could not save feedback" }, { status: 500 });
  }

  // Best-effort email notification — never blocks or fails the save.
  await notifyFeedback({ message: message.slice(0, MAX_MESSAGE), contact, pathname, referrer });

  return Response.json({ ok: true });
}
