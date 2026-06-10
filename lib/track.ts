// Client-side event tracking. Fire-and-forget; never blocks or throws.
export type TrackEvent =
  | "install_download"
  | "install_claude_code"
  | "install_copy_command"
  | "copy_for_slack"
  | "feedback_up"
  | "feedback_down"
  | "feedback_comment";

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
