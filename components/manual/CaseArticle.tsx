import Link from "next/link";
import type { CaseStudy } from "@/lib/manual";
import { SHELF_TITLES, getCase } from "@/lib/manual";

export type CaseSignals = { installs: number; stars: number } | null;

// Renders one case (CaseStudy) following the four moves: skill → scenario →
// see it work → install. Live cases get the full walkthrough; "soon" cases get
// the compact scenario + concept stub. Live install/star signals are passed in
// from the route (fetched via getSkillBySlug); this component is presentational.
export function CaseArticle({
  entry,
  signals,
  skillHref,
}: {
  entry: CaseStudy;
  signals: CaseSignals;
  skillHref: string | null;
}) {
  const shelfTitle = SHELF_TITLES[entry.shelf];
  const next = entry.nextCase ? getCase(entry.nextCase) : undefined;
  const hasSkill = entry.skill.skillSlug.length > 0;
  const isLive = entry.status === "live";

  return (
    <article>
      <div className="mn-crumb">
        {shelfTitle} / <span className="o">{entry.navLabel}</span>
      </div>
      <h1>{entry.title}</h1>
      <p className="mn-lead">{entry.standfirst}</p>

      {/* ── Move 1: the skill (protagonist) ── */}
      {hasSkill && (
        <>
          <h2 className="mn-h2">The skill this case uses</h2>
          <div className="mn-skillrow">
            <div className="ico">$_</div>
            <div>
              <div>
                {skillHref ? (
                  <Link className="nm" href={skillHref}>
                    {entry.skill.name}
                  </Link>
                ) : (
                  <span className="nm">{entry.skill.name}</span>
                )}{" "}
                &nbsp;<span className="by">by {entry.skill.publisher}</span>
              </div>
              <p className="desc">{entry.skill.blurb}</p>
              <div className="mn-pillrow">
                {signals && (
                  <>
                    <span className="mn-chip">↓ {signals.installs.toLocaleString()} installs</span>
                    {signals.stars > 0 && <span className="mn-chip">★ {signals.stars.toLocaleString()}</span>}
                  </>
                )}
                <span className="mn-chip">
                  {shelfTitle.toLowerCase()} · {entry.subShelf}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Move 2: the scenario ── */}
      <h2 className="mn-h2">The scenario</h2>
      {entry.scenario.map((para, i) => (
        <p key={i}>{para}</p>
      ))}

      {/* ── Move 3: see it work (live only) ── */}
      {isLive && entry.steps && (
        <>
          <h2 className="mn-h2">See it work</h2>
          <div className="mn-steps">
            {entry.steps.map((s, i) => (
              <div className="mn-step" key={i}>
                <div className="mn-step-n">{i + 1}</div>
                <div>
                  <h3>{s.title}</h3>
                  {s.body && <p>{s.body}</p>}
                  {s.typed && <span className="mn-typed">{s.typed}</span>}
                </div>
              </div>
            ))}
          </div>

          {entry.before && entry.after && (
            <div className="mn-ba">
              <div className="mn-panel before">
                <div className="mn-panel-head">
                  <span className="mn-lbl">{entry.before.label}</span>
                </div>
                <div className="mn-panel-body">
                  {entry.before.lines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
              <div className="mn-panel after">
                <div className="mn-panel-head">
                  <span className="mn-lbl" style={{ color: "var(--verified)" }}>
                    {entry.after.label}
                  </span>
                </div>
                <div className="mn-panel-body mn-rep">
                  <table>
                    <tbody>
                      {entry.after.rows.map((r, i) => (
                        <tr key={i}>
                          <td>
                            {r.dot && <span className="mn-cat" style={{ background: r.dot }} />}
                            {r.label}
                          </td>
                          <td>{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {entry.after.footer && (
                    <div style={{ color: "var(--verified)", marginTop: 8 }}>{entry.after.footer}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── the concept it teaches (after the payoff) ── */}
      <h2 className="mn-h2">{isLive ? "What you just learned" : "What you'll learn"}</h2>
      <p>
        <b>{entry.concept.lead}</b> {entry.concept.body}
      </p>

      {/* ── stat strip (live only) ── */}
      {isLive && entry.stats && (
        <div className="mn-stats">
          {entry.stats.map((s, i) => (
            <div className="mn-stat" key={i}>
              <div className="v">{s.v}</div>
              <div className="k">{s.k}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Move 4: install it, step by step (live only) ── */}
      {isLive && entry.install && (
        <>
          <h2 className="mn-h2">Install it, step by step</h2>
          <div className="mn-steps">
            {entry.install.map((s, i) => (
              <div className="mn-step" key={i}>
                <div className="mn-step-n">{i + 1}</div>
                <div>
                  <h3>{s.title}</h3>
                  {s.body && <p>{s.body}</p>}
                  {s.typed && <span className="mn-typed">{s.typed}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="mn-cta">
            {skillHref && (
              <Link className="mn-btn-accent" href={skillHref}>
                Open this skill on Claudinho →
              </Link>
            )}
          </div>
        </>
      )}

      {/* ── coming-soon stub ── */}
      {!isLive && (
        <div className="mn-soon">Full walkthrough in production.</div>
      )}

      {/* ── next entry ── */}
      {next && (
        <p style={{ marginTop: 24 }}>
          <Link className="mn-next" href={`/manual/${next.slug}`}>
            Next: {next.navLabel} →
          </Link>
        </p>
      )}

      <div className="mn-updated">
        {shelfTitle} · {entry.subShelf} · {isLive ? "live" : "coming soon"}
      </div>
    </article>
  );
}
