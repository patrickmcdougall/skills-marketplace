import type { SurfaceRow } from "@/lib/playbook";

// The top-down "ways to use Claude" comparison grid. Cowork is the highlighted
// row — the destination this whole Playbook is about.
export function SurfaceGrid({ rows }: { rows: SurfaceRow[] }) {
  return (
    <div className="pb-surfaces" role="table" aria-label="Ways to use Claude">
      <div className="pb-surf-head" role="row">
        <span role="columnheader">Surface</span>
        <span role="columnheader">Where it lives</span>
        <span role="columnheader">Best for</span>
      </div>
      {rows.map((r) => (
        <div
          className={`pb-surf-row${r.highlight ? " is-cowork" : ""}`}
          role="row"
          key={r.name}
        >
          <span className="pb-surf-name" role="cell">
            {r.name}
            {r.highlight && <span className="pb-surf-tag">you</span>}
          </span>
          <span className="pb-surf-where" role="cell">{r.where}</span>
          <span className="pb-surf-best" role="cell">{r.bestFor}</span>
        </div>
      ))}
    </div>
  );
}
