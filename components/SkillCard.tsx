"use client";

import Link from "next/link";
import { fmtCount, fmtVerifiedDate, PUBLISHERS, type Skill } from "@/lib/data";

interface SkillCardProps {
  skill: Skill;
  context?: "wall" | "shelf" | "browse" | "detail";
}

export function SkillCard({ skill, context = "shelf" }: SkillCardProps) {
  const showFullPath = context === "wall" || context === "browse";
  const showSubOnly = context === "shelf";
  const showTags = context === "browse" || context === "detail";
  const oneLine = context === "shelf";

  const publisher = PUBLISHERS[skill.publisher];
  const publisherName = publisher?.name ?? skill.publisher;

  return (
    <Link className={`skill-card ctx-${context}`} href={`/skills/${skill.id}`}>
      <div className="top-row">
        <span className="lp-verified">
          verified · {fmtVerifiedDate(skill.verifiedDate)}
        </span>
        {showFullPath && (
          <span className="shelf-path">
            {skill.shelfTitle}
            {skill.subShelf ? ` / ${skill.subShelf}` : ""}
          </span>
        )}
        {showSubOnly && skill.subShelf && (
          <span className="shelf-path">{skill.subShelf}</span>
        )}
      </div>
      <div className="title">{skill.title}</div>
      <div className={`desc${oneLine ? " one-line" : ""}`}>{skill.desc}</div>
      {showTags && skill.tags && skill.tags.length > 0 && (
        <div className="tags">
          {skill.tags.map((t) => (
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
          <span className="dot-sep">·</span>
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
            <span className="num">{fmtCount(publisher?.fol)}</span>
          </span>
        </span>
        <span className="signals" title="installs">
          <span className="icon">↓</span>
          <span className="num">{fmtCount(skill.installs)}</span>
        </span>
      </div>
    </Link>
  );
}
