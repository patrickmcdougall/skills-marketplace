import Link from "next/link";
import {
  SHELVES,
  PUBLISHERS,
  REAL_STATS,
  publisherStats,
  topSkills,
  fmtCount,
  fmtVerifiedDate,
} from "@/lib/data";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SkillCard } from "@/components/SkillCard";
import { DriftWall } from "@/components/DriftWall";
import { ShelfGlyph } from "@/components/ShelfGlyph";

// ─── publisher card (server component) ────────────────────────────────────

function PubCard({ handle }: { handle: string }) {
  const p = PUBLISHERS[handle];
  if (!p) return null;
  const stats = publisherStats(handle);
  const top = topSkills(handle, 2);
  return (
    <div className="lp-pub-card">
      <div className="pub-header">
        <span
          className="lp-avatar"
          style={{
            width: 48,
            height: 48,
            fontSize: Math.round(48 * 0.42),
          }}
        >
          {p.initials}
        </span>
        <div className="who">
          <div className="pub-name">{p.name}</div>
          <div className="pub-handle">
            @{p.handle} · {p.loc}
          </div>
          <div className="pub-role">{p.role}</div>
        </div>
      </div>
      <div className="pub-stats">
        <div className="s">
          <span className="v lp-num">{stats.count}</span>
          <span className="k">skills</span>
        </div>
        <div className="s">
          <span className="v lp-num">{fmtCount(stats.installs)}</span>
          <span className="k">installs</span>
        </div>
        <div className="s">
          <span className="v lp-num">{fmtCount(p.fol)}</span>
          <span className="k">followers</span>
        </div>
      </div>
      <div className="pub-top-skills">
        <div className="label">Top skills</div>
        {top.map((s) => (
          <div className="row" key={s.id}>
            <span className="t">{s.title}</span>
            <span className="n">↓ {fmtCount(s.installs)}</span>
          </div>
        ))}
      </div>
      <div className="pub-foot">
        <Link className="lp-btn sm" href={`/creators/${handle}`}>
          View profile →
        </Link>
        <a className="lp-btn ghost sm" href="#">
          All {stats.count} skills
        </a>
      </div>
    </div>
  );
}

// ─── publishers band ───────────────────────────────────────────────────────

function PublishersBand() {
  const allHandles = Object.keys(PUBLISHERS);
  return (
    <section className="lp-pubs" id="publishers">
      <div className="lp-page">
        <div className="lp-section-eyebrow">
          <span className="left">Publishers · {allHandles.length} sourced</span>
          <Link className="right" href="/creators">view all →</Link>
        </div>
        <div className="head">
          <div>
            <h2>Sourced from operators who already ship&nbsp;these.</h2>
          </div>
          <p className="lede">
            Each publisher&apos;s external footprint — GitHub stars, follower count, role — is part
            of the source signal. Skills don&apos;t ship without it.
          </p>
        </div>
      </div>
      <div className="lp-pub-scroll">
        <div className="lp-pub-grid">
          {allHandles.map((h) => (
            <PubCard key={h} handle={h} />
          ))}
          <Link className="lp-pub-end" href="/creators">
            <span className="t">
              Browse all <span className="lp-num">{allHandles.length}</span> publishers
            </span>
            <span className="a">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── shelf row ─────────────────────────────────────────────────────────────

function ShelfRow({ shelf }: { shelf: (typeof SHELVES)[number] }) {
  const accent = `var(--c-${shelf.id})`;
  return (
    <section
      className="lp-shelf"
      id={`shelf-${shelf.id}`}
      style={{ ["--shelf-accent" as string]: accent }}
    >
      <div className="lp-shelf-head">
        <div>
          <div className="lp-shelf-eyebrow">
            <span className="glyph">
              <ShelfGlyph id={shelf.id} size={12} />
            </span>
            <span>{shelf.num}</span>
          </div>
          <h2 className="lp-shelf-title">{shelf.title}</h2>
          <p className="lp-shelf-blurb">{shelf.blurb}</p>
        </div>
        <div className="lp-shelf-right">
          <span>
            <span className="count lp-num">{shelf.skills.length}</span> skills
          </span>
          <Link className="see-all" href={`/skills?shelf=${shelf.id}`}>
            see all →
          </Link>
        </div>
      </div>
      <div className="lp-shelf-grid">
        {shelf.skills.slice(0, 4).map((s) => (
          <SkillCard key={s.id} skill={s} context="shelf" />
        ))}
      </div>
    </section>
  );
}

// ─── how it works ──────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section className="lp-how" id="how">
      <div className="lp-page">
        <div className="lp-section-eyebrow">
          <span className="left">About · the registry</span>
          <span className="right">v1.0 · re-verified weekly</span>
        </div>
        <div className="lp-how-head">
          <h2>How verification and signal aggregation work.</h2>
          <p className="lede">
            Three stages. All run by us, all visible. No claims we can&apos;t show metadata for.
          </p>
        </div>
        <div className="lp-how-grid">
          <div className="step">
            <span className="n">01 · Source</span>
            <h3>Skills enter the registry by community signal.</h3>
            <p>
              GitHub stars on the publisher&apos;s repo, install counts across other registries,
              Twitter mentions, and publisher reputation (role, follower count). Signal thresholds
              are public and re-checked daily.
            </p>
            <span className="out">
              <span className="k">tracks: </span>
              <span className="v">twitter followers · install counts · publisher footprint</span>
            </span>
          </div>
          <div className="step">
            <span className="n">02 · Verify</span>
            <h3>Every skill is installed and run by us.</h3>
            <p>
              Each topic has a standard input — 30 anonymized interview transcripts, a real PR diff,
              a messy expense CSV. The skill runs against it. The exact output is captured and shown
              on the detail page.
            </p>
            <span className="out">
              <span className="k">artifact: </span>
              <span className="v">pinned version · captured output · timestamp</span>
            </span>
          </div>
          <div className="step">
            <span className="n">03 · Re-verify</span>
            <h3>Daily polling. Weekly re-runs.</h3>
            <p>
              A cron polls each publisher&apos;s repo for new releases. Every skill is re-run against its
              standard input weekly. Broken skills are hidden from browse, not retried in public.
              Source-only skills are re-verified monthly.
            </p>
            <span className="out">
              <span className="k">cadence: </span>
              <span className="v">poll daily · run weekly · health-check quarterly</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── page ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const stats = REAL_STATS;
  // Wall uses first 16 skills
  const wallSkills = SHELVES.flatMap((sh) => sh.skills).slice(0, 16);

  return (
    <div className="lp accent-orange bg-cream">
      <Nav stats={stats} />

      {/* Hero */}
      <header className="lp-hero lp-page">
        <h1>
          Someone already built the <span className="em">thing</span>{" "}you wanted Claude
          to&nbsp;do.
        </h1>
        <p className="sub">
          Skills built and shared by the community. Every skill is installed, run on a real
          input, and re-verified weekly — the output you see is the output you get.
        </p>
        <div className="actions">
          <a href="#shelves" className="lp-btn solid">
            Browse the registry ↓
          </a>
          <a href="#how" className="lp-btn ghost">
            How we verify
          </a>
        </div>
        <div className="stat-strip">
          <div className="stat">
            <span className="v lp-num">{stats.skills}</span>
            <span className="k">skills · verified</span>
          </div>
          <div className="stat">
            <span className="v lp-num">{stats.publishers}</span>
            <span className="k">publishers · sourced</span>
          </div>
          <div className="stat">
            <span className="v lp-num">{stats.installs}</span>
            <span className="k">installs · all-time</span>
          </div>
        </div>
      </header>

      {/* Drifting wall (client component for animation) */}
      <DriftWall skills={wallSkills} />

      {/* Publishers band */}
      <PublishersBand />

      {/* Shelves */}
      <main className="lp-shelves lp-page" id="shelves">
        <div className="lp-section-eyebrow">
          <span className="left">Topics · 8 business functions</span>
          <span className="right">{stats.skills} skills</span>
        </div>
        {SHELVES.map((sh) => (
          <ShelfRow key={sh.id} shelf={sh} />
        ))}
      </main>

      {/* How it works */}
      <HowItWorks />

      {/* Footer */}
      <Footer stats={stats} />
    </div>
  );
}
