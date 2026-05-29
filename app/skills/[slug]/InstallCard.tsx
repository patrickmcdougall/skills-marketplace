"use client";

import { useState } from "react";

interface InstallCardProps {
  installCommand: string;
}

export function InstallCard({ installCommand }: InstallCardProps) {
  const [showCmd, setShowCmd] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard?.writeText(installCommand);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="dp-install">
      <a className="primary" href="#">
        <span className="arrow">↓</span>
        Download .skill file
      </a>
      <p className="subscript">
        Drag into Cowork or Claude Code. Runs locally in your session.
      </p>

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
    </div>
  );
}
