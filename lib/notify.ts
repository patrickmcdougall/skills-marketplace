// Best-effort email notification for visitor feedback.
// Sends via Resend's REST API (no SDK dependency). Never throws — a mail
// failure must not break the feedback save or surface to the visitor.

type FeedbackEmail = {
  message: string;
  contact: string | null;
  pathname: string | null;
  referrer: string | null;
};

export async function notifyFeedback(fb: FeedbackEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // email not configured — skip silently

  const to = process.env.FEEDBACK_NOTIFY_TO ?? "patrick.mcdougalls@gmail.com";
  const from = process.env.FEEDBACK_FROM ?? "Claudinho <onboarding@resend.dev>";

  const lines = [
    fb.message,
    "",
    `Contact: ${fb.contact ?? "(none left)"}`,
    `Page: ${fb.pathname ?? "(unknown)"}`,
    `Referrer: ${fb.referrer ?? "(none)"}`,
  ].join("\n");

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        // Reply-To the visitor when they left an email, so you can just hit reply.
        ...(fb.contact && fb.contact.includes("@")
          ? { reply_to: fb.contact }
          : {}),
        subject: "New Claudinho feedback",
        text: lines,
      }),
    });
  } catch {
    // swallow — the feedback is already saved in the DB
  }
}
