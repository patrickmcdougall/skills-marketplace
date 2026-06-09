import Link from "next/link";
import type { Play } from "@/lib/playbook";
import { SHELF_TITLES, getPlay } from "@/lib/playbook";

export type PlaySignals = { installs: number; stars: number } | null;

// Renders one case (Play) following the four moves: skill → scenario →
// see it work → install. Live cases get the full walkthrough; "soon" cases get
// the compact scenario + concept stub. Live install/star signals are passed in
// from the route (fetched via getSkillBySlug); this component is presentational.
export function PlayArticle({
  play,
  signals,
  skillHref,
}: {
  play: Play;
  signals: PlaySignals;
  skillHref: string | null;
}) {
  const shelfTitle = SHELF_TITLES[play.shelf];
  const next = play.nextPlay ? getPlay(play.nextPlay) : undefined;
  const hasSkill = play.skill.skillSlug.length > 0;
  const isLive = play.status === "live";

  return (
    <article>
      <div className="pb-crumb">
        {shelfTitle} / <span className="o">{play.navLabel}</span>
      </div>
      <h1>{play.title}</h1>
      <p className="pb-lead">{play.standfirst}</p>

      {/* ── Move 1: the skill (protagonist) ── */}
      {hasSkill && (
        <>
          <h2 className="pb-h2">The skill this case uses</h2>
          <div className="pb-skillrow">
            <div className="ico">$_</div>
            <div>
              <div>
                {skillHref ? (
                  <Link className="nm" href={skillHref}>
                    {play.skill.name}
                  </Link>
                ) : (
                  <span className="nm">{play.skill.name}</span>
                )}{" "}
                &nbsp;<span className="by">by {play.skill.publisher}</span>
              </div>
              <p className="desc">{play.skill.blurb}</p>
              <div className="pb-pillrow">
                {signals && (
                  <>
                    <span className="pb-chip">↓ {signals.installs.toLocaleString()} installs</span>
                    {signals.stars > 0 && <span className="pb-chip">★ {signals.stars.toLocaleString()}</span>}
                  </>
                )}
                <span className="pb-chip">
                  {shelfTitle.toLowerCase()} · {play.subShelf}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Move 2: the scenario ── */}
      <h2 className="pb-h2">The scenario</h2>
      {play.scenario.map((para, i) => (
        <p key={i}>{para}</p>
      ))}

      {/* ── Move 3: see it work (live only) ── */}
      {isLive && play.steps && (
        <>
          <h2 className="pb-h2">See it work</h2>
          <div className="pb-steps">
            {play.steps.map((s, i) => (
              <div className="pb-step" key={i}>
                <div className="pb-step-n">{i + 1}</div>
                <div>
                  <h3>{s.title}</h3>
                  {s.body && <p>{s.body}</p>}
                  {s.typed && <span className="pb-typed">{s.typed}</span>}
                </div>
              </div>
            ))}
          </div>

          {play.before && play.after && (
            <div className="pb-ba">
              <div className="pb-panel before">
                <div className="pb-panel-head">
                  <span className="pb-lbl">{play.before.label}</span>
                </div>
                <div className="pb-panel-body">
                  {play.before.lines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
              <div className="pb-panel after">
                <div className="pb-panel-head">
                  <span className="pb-lbl" style={{ color: "var(--verified)" }}>
                    {play.after.label}
                  </span>
                </div>
                <div className="pb-panel-body pb-rep">
                  <table>
                    <tbody>
                      {play.after.rows.map((r, i) => (
                        <tr key={i}>
                          <td>
                            {r.dot && <span className="pb-cat" style={{ background: r.dot }} />}
                            {r.label}
                          </td>
                          <td>{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {play.after.footer && (
                    <div style={{ color: "var(--verified)", marginTop: 8 }}>{play.after.footer}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── the concept it teaches (after the payoff) ── */}
      <h2 className="pb-h2">{isLive ? "What you just learned" : "What you'll learn"}</h2>
      <p>
        <b>{play.concept.lead}</b> {play.concept.body}
      </p>

      {/* ── stat strip (live only) ── */}
      {isLive && play.stats && (
        <div className="pb-stats">
          {play.stats.map((s, i) => (
            <div className="pb-stat" key={i}>
              <div className="v">{s.v}</div>
              <div className="k">{s.k}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Move 4: install it, step by step (live only) ── */}
      {isLive && play.install && (
        <>
          <h2 className="pb-h2">Install it, step by step</h2>
          <div className="pb-steps">
            {play.install.map((s, i) => (
              <div className="pb-step" key={i}>
                <div className="pb-step-n">{i + 1}</div>
                <div>
                  <h3>{s.title}</h3>
                  {s.body && <p>{s.body}</p>}
                  {s.typed && <span className="pb-typed">{s.typed}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="pb-cta">
            {skillHref && (
              <Link className="pb-btn-accent" href={skillHref}>
                Open this skill on Claudinho →
              </Link>
            )}
          </div>
        </>
      )}

      {/* ── coming-soon stub ── */}
      {!isLive && (
        <div className="pb-soon">Full walkthrough in production.</div>
      )}

      {/* ── next play ── */}
      {next && (
        <p style={{ marginTop: 24 }}>
          <Link className="pb-next" href={`/playbook/${next.slug}`}>
            Next: {next.navLabel} →
          </Link>
        </p>
      )}

      <div className="pb-updated">
        {shelfTitle} · {play.subShelf} · {isLive ? "live" : "coming soon"}
      </div>
    </article>
  );
}
