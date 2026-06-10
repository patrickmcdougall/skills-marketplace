// Client-side event tracking. Fire-and-forget; never blocks or throws.
// Single source of truth for event names and field caps — the /api/event
// route derives its whitelist from TRACK_EVENTS, so the two can't drift.
export const TRACK_EVENTS = [
  "install_download",
  "install_claude_code",
  "install_copy_command",
  "copy_for_slack",
  "feedback_up",
  "feedback_down",
  "feedback_comment",
] as const;

export type TrackEvent = (typeof TRACK_EVENTS)[number];

export const MAX_SLUG_LEN = 200;
export const MAX_DETAIL_LEN = 500;

export function track(event: TrackEvent, skillSlug?: string, detail?: string) {
  try {
    const body = JSON.stringify({ event, skillSlug, detail });
    if (navigator.sendBeacon?.("/api/event", new Blob([body], { type: "application/json" }))) {
      return;
    }
    fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // tracking must never break the UI
  }
}
