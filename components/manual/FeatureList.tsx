import Link from "next/link";
import type { ReactNode } from "react";
import { SHOW_WIP, type CoworkFeature } from "@/lib/manual";

// Inline stroke icons (Lucide-style) so the list works in a Server Component and
// matches the codebase convention of hand-rolled SVGs. Keys mirror Cowork's own
// sidebar icons.
const ICON_PATHS: Record<CoworkFeature["icon"], ReactNode> = {
  "new-task": (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  projects: (
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
  ),
  scheduled: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </>
  ),
  "live-artifacts": (
    <>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <line x1="8.2" y1="10.8" x2="15.8" y2="6.3" />
      <line x1="8.2" y1="13.2" x2="15.8" y2="17.7" />
    </>
  ),
  dispatch: (
    <>
      <rect x="7" y="9" width="10" height="12" rx="2" />
      <line x1="12" y1="9" x2="12" y2="5" />
      <line x1="12" y1="5" x2="15.5" y2="3" />
      <circle cx="12" cy="14.5" r="1.6" />
    </>
  ),
  customize: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
};

function FeatIcon({ icon }: { icon: CoworkFeature["icon"] }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[icon]}
    </svg>
  );
}

// The real Cowork feature list — echoes the app's own sidebar (icon + label +
// optional badge) with a plain-language line on what each one is for. Each row
// links to the feature's own page in the Manual.
export function FeatureList({ features }: { features: CoworkFeature[] }) {
  return (
    <div className="mn-features">
      {features.map((f) => {
        const body = (
          <>
            <span className="mn-feat-ico">
              <FeatIcon icon={f.icon} />
            </span>
            <div className="mn-feat-body">
              <div className="mn-feat-head">
                <span className="mn-feat-name">{f.name}</span>
                {f.badge && <span className="mn-feat-badge">{f.badge}</span>}
              </div>
              <p className="mn-feat-text">{f.text}</p>
              <p className="mn-feat-eg">
                <span className="k">Use it for:</span> {f.example}
              </p>
            </div>
          </>
        );
        // Per-feature guide pages are WIP-gated: rows link in dev/preview,
        // render unlinked in production until each guide ships.
        return SHOW_WIP ? (
          <Link className="mn-feat" href={`/manual/features/${f.slug}`} key={f.slug}>
            {body}
          </Link>
        ) : (
          <div className="mn-feat" key={f.slug}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
