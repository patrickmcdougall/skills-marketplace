"use client";

import { useState } from "react";

interface CopyForSlackProps {
  title: string;
  bestFor: string | null;
  slug: string;
}

export function CopyForSlack({ title, bestFor, slug }: CopyForSlackProps) {
  const [toasted, setToasted] = useState(false);

  const copy = () => {
    const url = `${window.location.origin}/skills/${slug}`;
    const lines = bestFor
      ? `${title} — ${bestFor}\n${url}`
      : `${title}\n${url}`;
    navigator.clipboard?.writeText(lines);
    setToasted(true);
    setTimeout(() => setToasted(false), 2000);
  };

  return (
    <div className="alt-row" style={{ position: "relative" }}>
      <button className="alt" onClick={copy} style={{ width: "100%" }}>
        <span>Copy for Slack</span>
        <span className="arrow" style={{ fontSize: 13 }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <rect x="8" y="8" width="10" height="10" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
      </button>
      {toasted && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1A1A18",
            color: "#efece4",
            fontSize: 12,
            padding: "5px 12px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          Copied — paste it in Slack
        </div>
      )}
    </div>
  );
}
