"use client";

import { useState } from "react";

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

  const copy = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard?.writeText(installCommand);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const canDownload = !sourceOnly && !installUnavailable;

  return (
    <div className="dp-install">
      {canDownload ? (
        <>
          <a className="primary" href={`/i/${slug}`}>
            <span className="arrow">↓</span>
            Download .skill
          </a>
          <p className="subscript">
            Drag into Cowork or Claude Desktop — no terminal needed.
          </p>
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
          <button className="copy" onClick={copy}>
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

      {installCount !== undefined && installCount > 0 && (
        <p className="subscript" style={{ marginTop: 4, fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 11 }}>
          {installCount.toLocaleString()} install{installCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
