import type { SurfaceRow } from "@/lib/manual";

// The top-down "ways to use Claude" comparison grid. Cowork is the highlighted
// row — the destination this whole Manual is about.
export function SurfaceGrid({ rows }: { rows: SurfaceRow[] }) {
  return (
    <div className="mn-surfaces" role="table" aria-label="Ways to use Claude">
      <div className="mn-surf-head" role="row">
        <span role="columnheader">Surface</span>
        <span role="columnheader">Where it lives</span>
        <span role="columnheader">Best for</span>
      </div>
      {rows.map((r) => (
        <div
          className={`mn-surf-row${r.highlight ? " is-cowork" : ""}`}
          role="row"
          key={r.name}
        >
          <span className="mn-surf-name" role="cell">
            {r.name}
            {r.highlight && <span className="mn-surf-tag">you</span>}
          </span>
          <span className="mn-surf-where" role="cell">{r.where}</span>
          <span className="mn-surf-best" role="cell">{r.bestFor}</span>
        </div>
      ))}
    </div>
  );
}
