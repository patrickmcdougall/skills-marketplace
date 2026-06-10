import { NextRequest } from "next/server";

// Coarse bot filter — don't count prefetch/crawler hits.
// Single shared copy: /i/[slug] (install counter) and /api/event (funnel
// events) must agree on what a bot is, or the two datasets drift.
export function isBot(req: NextRequest): boolean {
  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  return (
    ua.includes("bot") ||
    ua.includes("crawler") ||
    ua.includes("spider") ||
    ua.includes("prerender") ||
    ua.includes("prefetch") ||
    req.headers.get("x-purpose") === "prefetch" ||
    req.headers.get("purpose") === "prefetch"
  );
}
