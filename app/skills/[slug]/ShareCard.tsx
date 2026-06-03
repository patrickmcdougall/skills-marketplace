"use client";

import { useState } from "react";

interface ShareCardProps {
  title: string;
  bestFor: string | null;
  slug: string;
  installCommand: string;
}

type CopyTarget = "link" | "slack" | "discord";

export function ShareCard({ title, bestFor, slug, installCommand }: ShareCardProps) {
  const [copied, setCopied] = useState<CopyTarget | null>(null);

  const getUrl = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/skills/${slug}`
      : `https://claudinho.xyz/skills/${slug}`;

  const flash = (target: CopyTarget, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(target);
    setTimeout(() => setCopied(null), 1800);
  };

  const copyLink = () => flash("link", getUrl());

  const copySlack = () => {
    const url = getUrl();
    const parts = [bestFor ? `${title} — ${bestFor}` : title, url, installCommand];
    flash("slack", parts.join("\n"));
  };

  const copyDiscord = () => {
    const url = getUrl();
    const desc = bestFor ? `${bestFor}` : "";
    const parts = [
      `**${title}**${desc ? ` — ${desc}` : ""}`,
      url,
      `\`\`\`\n${installCommand}\n\`\`\``,
    ];
    flash("discord", parts.join("\n"));
  };

  const shareX = () => {
    const url = getUrl();
    const text = bestFor ? `${title} — ${bestFor}` : title;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const shareBluesky = () => {
    const url = getUrl();
    const text = bestFor
      ? `${title} — ${bestFor}\n${url}`
      : `${title}\n${url}`;
    window.open(
      `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="dp-install dp-share-card">
      {/* Copy link */}
      <div className="alt-row" style={{ borderTop: "none", paddingTop: 0 }}>
        <button className="alt" onClick={copyLink}>
          <span>{copied === "link" ? "Copied!" : "Copy link"}</span>
          <span className="arrow" style={{ fontSize: 12 }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M8 4H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M12 2h6v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 2 11 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </span>
        </button>
      </div>

      {/* Copy for Slack */}
      <div className="alt-row">
        <button className="alt" onClick={copySlack}>
          <span>{copied === "slack" ? "Copied!" : "Copy for Slack"}</span>
          <span className="arrow" style={{ fontSize: 11 }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/>
              <rect x="8" y="8" width="10" height="10" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
          </span>
        </button>
      </div>

      {/* Copy for Discord */}
      <div className="alt-row">
        <button className="alt" onClick={copyDiscord}>
          <span>{copied === "discord" ? "Copied!" : "Copy for Discord"}</span>
          <span className="arrow" style={{ fontSize: 11 }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M7 8.5h6M7 11.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M4 2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6l-4 3V4a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>
      </div>

      {/* Social row */}
      <div className="alt-row dp-share-social">
        <span className="alt-label">Share on</span>
        <div className="dp-share-icons">
          <button
            className="dp-share-icon"
            onClick={shareX}
            aria-label="Share on X"
            title="Share on X"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M15.75 2h-2.9l-3.6 4.8L5.9 2H2l5.4 7.2L2 18h2.9l3.85-5.14L12.1 18H16l-5.6-7.48L15.75 2ZM13.3 16.3l-9.1-12.1h1.5l9.1 12.1h-1.5Z"/>
            </svg>
          </button>
          <button
            className="dp-share-icon"
            onClick={shareBluesky}
            aria-label="Share on Bluesky"
            title="Share on Bluesky"
          >
            <svg width="15" height="13" viewBox="0 0 568 501" fill="currentColor" aria-hidden="true">
              <path d="M123.1 33.2C188 79.8 257.8 174.2 284 221.2c26.2-47 96-141.4 160.9-188C491.5-0.1 568 -6.6 568 97.4c0 21.4-12.3 179.8-19.5 205.5-25 89.7-116 112.6-196.8 98.8 141.3 24 177.3 103.5 99.5 183-147.5 151.3-212.1-37.9-228.4-86.3-3.2-9.4-4.7-13.8-4.8-10-0.1-3.8-1.6 0.6-4.8 10-16.3 48.4-80.9 237.6-228.4 86.3-77.8-79.5-41.8-159 99.5-183C104.5 415.5 13.5 392.6-11.5 303c-7.2-25.7-19.5-184.1-19.5-205.5C-31 -6.6 45.5-0.1 123.1 33.2Z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
