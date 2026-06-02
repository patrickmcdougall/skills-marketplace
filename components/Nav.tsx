import Link from "next/link";

interface NavProps {
  stats: {
    skills: number;
    publishers: number;
    installs: string;
  };
}

export function Nav({ stats: _ }: NavProps) {
  return (
    <nav className="lp-nav">
      <div className="logo-row">
        <div className="brand-stack">
          <Link className="logo" href="/" style={{ fontSize: "18px" }}>
            Claudinho
          </Link>
          <span className="brand-tag">ready-made skills</span>
        </div>
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
