interface FooterProps {
  stats: {
    skills: number;
    creators: number;
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
            <span className="brand-tag">ready-made skills</span>
          </div>
        </div>
        <div className="col">
          <b>Browse</b>
          <a href="/skills">All skills</a>
          <a href="/creators">Creators</a>
          <a href="/skills?sort=newest">New this week</a>
          <a href="/skills?sort=installs">Most installed</a>
        </div>
        <div className="col">
          <b>About</b>
          <a href="/#how">How install works</a>
          <a href="mailto:patrick.mcdougalls@gmail.com">Submit a skill</a>
        </div>
        <div className="col">
          <b>Elsewhere</b>
          <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">Claude →</a>
        </div>
      </div>
      <div className="legal">
        <span>© Claudinho · 2026</span>
        <span>v1.0.0</span>
      </div>
    </footer>
  );
}
