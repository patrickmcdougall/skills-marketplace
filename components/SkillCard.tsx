"use client";

import Link from "next/link";
import { fmtCount, PUBLISHERS, type Skill } from "@/lib/data";
import type { SkillTrustStatus } from "@/lib/trust";

interface SkillCardProps {
  skill: Skill;
  context?: "wall" | "shelf" | "browse" | "detail";
  trust?: SkillTrustStatus;
}

function TrustIcon({ status }: { status: SkillTrustStatus }) {
  if (status === "verified") {
    return (
      <span
        className="card-trust verified"
        data-tooltip="Passed all 3 security checks"
        aria-label="Security verified"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="6.5" fill="var(--verified-soft)" stroke="var(--verified)" strokeWidth="1"/>
          <path d="M4.5 7l1.8 1.8 3.2-3.6" stroke="var(--verified)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
    );
  }
  if (status === "flagged") {
    return (
      <span
        className="card-trust flagged"
        data-tooltip="Security concern — check detail page"
        aria-label="Security flagged"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7 1.5L12.5 11.5H1.5L7 1.5Z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1" strokeLinejoin="round"/>
          <line x1="7" y1="5.5" x2="7" y2="8" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="7" cy="9.5" r="0.6" fill="var(--accent)"/>
        </svg>
      </span>
    );
  }
  return null;
}

export function SkillCard({ skill, context = "shelf", trust }: SkillCardProps) {
  const oneLine = context === "shelf";

  const publisher = PUBLISHERS[skill.publisher];
  // Display name: explicit override > catalog name > handle
  const publisherName = skill.publisherDisplayName ?? publisher?.name ?? skill.publisher;
  // Show @handle when it adds info (name differs from handle)
  const showHandle = publisherName.toLowerCase() !== skill.publisher.toLowerCase();
  const tags = (skill.tags ?? []).slice(0, 2);
  const hasChips = Boolean(skill.shelfTitle) || tags.length > 0;
  const fol = publisher?.fol ?? 0;
  const showStars = !fol && skill.stars > 0;

  return (
    <Link className={`skill-card ctx-${context}`} href={`/skills/${skill.id}`}>
      <div className="card-title-row">
        <div className="title">{skill.title}</div>
        {trust && trust !== "pending" && <TrustIcon status={trust} />}
      </div>
      <div className={`desc${oneLine ? " one-line" : ""}`}>{skill.desc}</div>
      {hasChips && (
        <div className="tags">
          {skill.shelfTitle && (
            <span className="tag tag-shelf">
              {skill.shelfTitle}
              {skill.subShelf ? ` / ${skill.subShelf}` : ""}
            </span>
          )}
          {tags.map((t) => (
            <span className="tag" key={t}>
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="foot">
        <span className="foot-left">
          <span className="lp-byline-by">by</span>
          <span className="lp-byline-name">{publisherName}</span>
          {showHandle && (
            <span className="lp-byline-handle">@{skill.publisher}</span>
          )}
          <span className="dot-sep">·</span>
          {showStars ? (
            <span className="fol" title="GitHub stars">
              <span style={{ fontSize: 10, opacity: 0.7 }}>★</span>
              <span className="num">{fmtCount(skill.stars)}</span>
            </span>
          ) : (
            <span className="fol" title="followers on X">
              <svg
                className="fol-icon"
                viewBox="0 0 10 10"
                width="10"
                height="10"
                aria-hidden="true"
              >
                <circle
                  cx="5"
                  cy="3.2"
                  r="1.7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
                <path
                  d="M1.6 9c0-1.9 1.5-3.2 3.4-3.2S8.4 7.1 8.4 9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                />
              </svg>
              <span className="num">{fmtCount(fol)}</span>
            </span>
          )}
        </span>
        <span className="signals" title="installs">
          <span className="icon">↓</span>
          <span className="num">{fmtCount(skill.installs)}</span>
        </span>
      </div>
    </Link>
  );
}
