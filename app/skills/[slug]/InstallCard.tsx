"use client";

import { useState } from "react";
import { track, MAX_DETAIL_LEN } from "@/lib/track";

interface InstallCardProps {
  slug: string;
  installCommand: string;
  sourceUrl: string;
  sourceOnly?: boolean;
  installUnavailable?: boolean;
  installCount?: number;
}

export function InstallCard({
  slug,
  installCommand,
  sourceUrl,
  sourceOnly = false,
  installUnavailable = false,
  installCount,
}: InstallCardProps) {
  const [showCmd, setShowCmd] = useState(sourceOnly || installUnavailable);
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [installed, setInstalled] = useState(false);

  const copy = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard?.writeText(installCommand);
    }
    track("install_copy_command", slug);
    setInstalled(true);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const openInClaudeCode = () => {
    track("install_claude_code", slug);
    setInstalled(true);
    window.location.href = `claude://install?skill=${encodeURIComponent(installCommand)}`;
    setOpening(true);
    setTimeout(() => {
      setOpening(false);
      setShowFallback(true);
    }, 2000);
  };

  const canDownload = !sourceOnly && !installUnavailable;

  return (
    <div className="dp-install">
      {canDownload ? (
        <>
          <a
            className="primary"
            href={`/i/${slug}`}
            onClick={() => {
              track("install_download", slug);
              setInstalled(true);
            }}
          >
            <span className="arrow">↓</span>
            Download .skill
          </a>
          <p className="subscript">
            Drag into Cowork or Claude Desktop — no terminal needed.
          </p>
          <div className="alt-row">
            <button
              className="alt"
              onClick={openInClaudeCode}
            >
              {opening ? (
                <span style={{ color: "var(--verified)" }}>Opening Claude Code…</span>
              ) : (
                <>Open in Claude Code →</>
              )}
            </button>
          </div>
          {showFallback && (
            <p className="subscript" style={{ marginTop: 4 }}>
              If it didn&apos;t open,{" "}
              <button
                className="lp-text-link"
                onClick={() => { setShowCmd(true); setShowFallback(false); }}
              >
                copy the install command below
              </button>
              .
            </p>
          )}
        </>
      ) : (
        <p className="subscript" style={{ textAlign: "left", marginBottom: 4 }}>
          This skill requires the install command below.
        </p>
      )}

      <div className="alt-row">
        <button
          className="alt"
          onClick={() => setShowCmd((v) => !v)}
          aria-expanded={showCmd}
        >
          {showCmd ? "Hide command" : "Copy install command"}
          <span className="arrow">{showCmd ? "↑" : "→"}</span>
        </button>
      </div>

      {showCmd && (
        <div className="cmd">
          <code>{installCommand}</code>
          <button className={`copy${copied ? " is-copied" : ""}`} onClick={copy}>
            {copied ? "copied" : "copy"}
          </button>
        </div>
      )}

      <div className="alt-row" style={{ borderTop: "none", paddingTop: 0 }}>
        <a
          className="alt"
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
        >
          View source on GitHub
          <span className="arrow">↗</span>
        </a>
      </div>

      {installed && <FeedbackPrompt slug={slug} />}

      {installCount !== undefined && installCount > 0 && (
        <p className="subscript" style={{ marginTop: 4, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 11 }}>
          {installCount.toLocaleString()} install{installCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

function FeedbackPrompt({ slug }: { slug: string }) {
  const storageKey = `claudinho-fb:${slug}`;
  const [state, setState] = useState<"ask" | "comment" | "done">(() => {
    try {
      return localStorage.getItem(storageKey) ? "done" : "ask";
    } catch {
      return "ask";
    }
  });
  const [comment, setComment] = useState("");

  const remember = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
  };

  if (state === "done") {
    return (
      <p className="subscript" style={{ marginTop: 8 }}>
        Thanks for the feedback.
      </p>
    );
  }

  if (state === "comment") {
    return (
      <form
        className="dp-fb-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (comment.trim()) track("feedback_comment", slug, comment.trim());
          remember();
          setState("done");
        }}
      >
        <input
          type="text"
          className="dp-fb-input"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What went wrong? (optional)"
          aria-label="What went wrong"
          maxLength={MAX_DETAIL_LEN}
          autoFocus
        />
        <button className="dp-fb-send" type="submit">
          Send
        </button>
      </form>
    );
  }

  return (
    <div className="dp-fb">
      <span className="subscript">Did the skill work for you?</span>
      <button
        type="button"
        className="dp-fb-btn"
        aria-label="Yes, it worked"
        onClick={() => {
          track("feedback_up", slug);
          remember();
          setState("done");
        }}
      >
        👍
      </button>
      <button
        type="button"
        className="dp-fb-btn"
        aria-label="No, something went wrong"
        onClick={() => {
          track("feedback_down", slug);
          remember();
          setState("comment");
        }}
      >
        👎
      </button>
    </div>
  );
}
