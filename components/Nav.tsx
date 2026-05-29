import Link from "next/link";

interface NavProps {
  stats: {
    skills: number;
    publishers: number;
    installs: string;
  };
}

export function Nav({ stats }: NavProps) {
  return (
    <nav className="lp-nav">
      <div className="logo-row">
        <div className="brand-stack">
          <Link className="logo" href="/" style={{ fontSize: "18px" }}>
            Claudinho
          </Link>
          <span className="brand-tag">pick your skills</span>
        </div>
        <span className="status" title="Last full re-verification run">
          <span>{stats.skills} verified · last run today</span>
        </span>
      </div>
      <div className="right">
        <div className="links">
          <Link href="/browse">Browse</Link>
          <Link href="/publishers">Publishers</Link>
          <a href="/#how">About</a>
        </div>
      </div>
    </nav>
  );
}
