interface FooterProps {
  stats: {
    skills: number;
    publishers: number;
    installs: string;
  };
}

export function Footer({ stats }: FooterProps) {
  return (
    <footer className="lp-footer">
      <div className="inner">
        <div className="brand">
          <div className="brand-stack">
            <a className="logo" href="/">
              Claudinho
            </a>
            <span className="brand-tag">pick your skills</span>
          </div>
          <span className="status-foot">
            All systems · {stats.skills} verified · last run today
          </span>
        </div>
        <div className="col">
          <b>Browse</b>
          <a href="/browse">All skills</a>
          <a href="/publishers">Publishers</a>
          <a href="/browse?sort=newest">New this week</a>
          <a href="/browse?sort=installs">Most installed</a>
        </div>
        <div className="col">
          <b>About</b>
          <a href="/#how">How we verify</a>
          <a href="mailto:patrick.mcdougalls@gmail.com">Submit a skill</a>
        </div>
        <div className="col">
          <b>Elsewhere</b>
          <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">Claude →</a>
        </div>
      </div>
      <div className="legal">
        <span>© Skills Marketplace · 2026</span>
        <span>v1.0.0 · status: all systems green</span>
      </div>
    </footer>
  );
}
