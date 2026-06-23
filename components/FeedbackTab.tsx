"use client";

import { useEffect, useRef, useState } from "react";

const ORANGE = "#F25C1F";
const CREAM = "#efece4";
const INK = "#1A1A18";

type Status = "idle" | "sending" | "done" | "error";

export function FeedbackTab() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when the panel opens; close on Escape.
  useEffect(() => {
    if (!open) return;
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "site_feedback", detail: message, contact }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
      setMessage("");
      setContact("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 10,
      }}
    >
      {open && (
        <div
          role="dialog"
          aria-label="Send feedback"
          style={{
            width: 320,
            maxWidth: "calc(100vw - 40px)",
            background: CREAM,
            color: INK,
            border: `1px solid ${INK}`,
            borderRadius: 6,
            boxShadow: "0 12px 32px rgba(26,26,24,0.18)",
            padding: 16,
          }}
        >
          {status === "done" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                Thank you — really.
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, opacity: 0.8 }}>
                Every note here decides what gets built next. If you left a
                way to reach you, I might follow up.
              </p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setStatus("idle");
                }}
                style={squareButton(INK, CREAM)}
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label
                htmlFor="feedback-message"
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                What were you hoping to find?
              </label>
              <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, opacity: 0.7 }}>
                I&apos;m not actively building right now — your answer tells me
                whether to start again.
              </p>
              <textarea
                id="feedback-message"
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="A specific skill? A workflow? Just curious?"
                style={fieldStyle}
              />
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email (optional — so I can reply)"
                aria-label="Email (optional)"
                style={fieldStyle}
              />
              {status === "error" && (
                <p style={{ fontSize: 12, color: "#b3261e", margin: 0 }}>
                  Something went wrong — try again?
                </p>
              )}
              <button
                type="submit"
                disabled={!message.trim() || status === "sending"}
                style={{
                  ...squareButton(ORANGE, "#fff"),
                  opacity: !message.trim() || status === "sending" ? 0.55 : 1,
                  cursor: !message.trim() ? "not-allowed" : "pointer",
                }}
              >
                {status === "sending" ? "Sending…" : "Send"}
              </button>
            </form>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (status === "done") setStatus("idle");
        }}
        aria-expanded={open}
        aria-label={open ? "Close feedback" : "Send feedback"}
        style={{
          ...squareButton(open ? INK : ORANGE, open ? CREAM : "#fff"),
          boxShadow: "0 6px 16px rgba(26,26,24,0.2)",
          gap: 8,
          alignSelf: "flex-end",
        }}
      >
        {open ? (
          "Close"
        ) : (
          <>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M3 4h14v9H8l-4 3v-3H3V4z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            Feedback
          </>
        )}
      </button>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "#fff",
  color: INK,
  border: `1px solid rgba(26,26,24,0.25)`,
  borderRadius: 2,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  resize: "vertical",
};

function squareButton(bg: string, fg: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: bg,
    color: fg,
    border: "none",
    borderRadius: 2,
    padding: "9px 14px",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
  };
}
