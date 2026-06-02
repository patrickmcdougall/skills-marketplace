import Link from "next/link";

interface NavProps {
  stats: {
    skills: number;
    publishers: number;
    installs: string;
  };
  hideStatus?: boolean;
}

export function Nav({ stats, hideStatus }: NavProps) {
  return (
    <nav className="lp-nav">
      <div className="logo-row">
        <div className="brand-stack">
          <Link className="logo" href="/" style={{ fontSize: "18px" }}>
            Claudinho
          </Link>
          <span className="brand-tag">pick your lineup of skills</span>
        </div>
        {!hideStatus && (
          <span className="status" title="Last full re-verification run">
            <span>{stats.skills} verified · last run today</span>
          </span>
        )}
      </div>
      <div className="right">
        <div className="links">
          <Link href="/skills">Browse</Link>
          <Link href="/creators">Creators</Link>
          <a href="/#how">About</a>
        </div>
      </div>
    </nav>
  );
}
