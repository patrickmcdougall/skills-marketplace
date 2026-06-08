// SecuritySection — full trust breakdown for the skill detail page.
// Rendered server-side; no "use client" needed.

import type { SkillTrust } from "@/lib/trust";

// TODO: Model real permissions from SKILL.md content or a DB column.
// Shape when we have real data: { label: string; icon?: string }[]
type Permission = { label: string };

// Placeholder permissions derived from the skill — replace when data is available.
const PLACEHOLDER_PERMISSIONS: Permission[] = [
  { label: "Reads your files" },
  { label: "Connects to the internet" },
  { label: "Runs code on your machine" },
];

const CHECKS: {
  key: keyof SkillTrust["checks"];
  question: string;
  vendor: string;
}[] = [
  { key: "gen",    question: "Does it try to trick the AI?",    vendor: "Gen Agent Trust Hub" },
  { key: "socket", question: "Does it sneak in hidden code?",   vendor: "Socket" },
  { key: "snyk",   question: "Does it have known bugs?",        vendor: "Snyk" },
];

function CheckRow({
  question,
  vendor,
  present,
  concern,
  subtext,
}: {
  question: string;
  vendor: string;
  present: boolean;
  concern: boolean;
  subtext: string;
}) {
  const icon = !present
    ? null
    : concern
    ? (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="M8 2L14 13H2L8 2Z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.1" strokeLinejoin="round"/>
        <line x1="8" y1="6.5" x2="8" y2="9.5" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="8" cy="11" r="0.65" fill="var(--accent)"/>
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="7" fill="var(--verified-soft)" stroke="var(--verified)" strokeWidth="1"/>
        <path d="M5 8l2.2 2.2 3.8-4.4" stroke="var(--verified)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );

  return (
    <div className="dp-sec-check">
      <div className="dp-sec-check-icon">{icon ?? <span className="dp-sec-pending-dot" />}</div>
      <div className="dp-sec-check-body">
        <span className="dp-sec-check-q">{question}</span>
        <span className="dp-sec-check-verdict" data-concern={concern ? "true" : undefined}>
          {!present ? "Not yet checked" : concern ? "Yes — see below" : "No"}
        </span>
        <span className="dp-sec-check-sub">{subtext} · <span className="dp-sec-vendor">{vendor}</span></span>
      </div>
    </div>
  );
}

interface SecuritySectionProps {
  trust: SkillTrust;
}

export function SecuritySection({ trust }: SecuritySectionProps) {
  const { status, reasons, checks } = trust;
  const concernCount = [checks.gen, checks.socket, checks.snyk].filter(c => c.concern).length;

  return (
    <section className="dp-block dp-security">
      <h2 className="dp-h2">Security</h2>

      {/* Headline verdict pill */}
      <div className={`dp-sec-verdict ${status}`}>
        {status === "verified" && (
          <>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <circle cx="7.5" cy="7.5" r="7" fill="var(--verified-soft)" stroke="var(--verified)" strokeWidth="1"/>
              <path d="M4.5 7.5l2.2 2.2 3.8-4.4" stroke="var(--verified)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <div className="dp-sec-verdict-title">Verified — safe to install</div>
              <div className="dp-sec-verdict-sub">Passed all 3 independent security checks</div>
            </div>
          </>
        )}
        {status === "flagged" && (
          <>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M7.5 1.5L13.5 12.5H1.5L7.5 1.5Z" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.1" strokeLinejoin="round"/>
              <line x1="7.5" y1="6" x2="7.5" y2="9" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="7.5" cy="10.5" r="0.65" fill="var(--accent)"/>
            </svg>
            <div>
              <div className="dp-sec-verdict-title">Flagged — install with caution</div>
              <div className="dp-sec-verdict-sub">{concernCount} of 3 checks raised a concern</div>
              {reasons.length > 0 && (
                <ul className="dp-sec-reasons">
                  {reasons.map((r) => <li key={r}>{r}</li>)}
                </ul>
              )}
            </div>
          </>
        )}
        {status === "pending" && (
          <>
            <span className="dp-sec-pending-dot" />
            <div>
              <div className="dp-sec-verdict-title">Security checks in progress</div>
              <div className="dp-sec-verdict-sub">Results will appear here once audits complete</div>
            </div>
          </>
        )}
      </div>

      {/* What this skill can do — hidden until real permission data is available */}
      {/* TODO: Replace PLACEHOLDER_PERMISSIONS with real permissions derived from
               the skill's SKILL.md content or a future skill_permissions DB column.
               Shape: { label: string }[] — one entry per capability. */}
      {false && (
        <div className="dp-sec-perms">
          <div className="dp-sec-perms-label">What this skill can do</div>
          <div className="dp-sec-perms-list">
            {PLACEHOLDER_PERMISSIONS.map((p) => (
              <span key={p.label} className="dp-sec-perm-pill">{p.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Three-source breakdown */}
      <div className="dp-sec-checks">
        <div className="dp-sec-checks-label">Checked by 3 independent security firms</div>
        {CHECKS.map(({ key, question, vendor }) => (
          <CheckRow
            key={key}
            question={question}
            vendor={vendor}
            present={checks[key].present}
            concern={checks[key].concern}
            subtext={checks[key].subtext}
          />
        ))}
      </div>
    </section>
  );
}
