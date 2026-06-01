import Link from "next/link";
import { fmtCount, type Skill } from "@/lib/data";
import {
  getBrowseSkills,
  getDBPublisherRows,
  type BrowseSkill,
  type DBPublisherRow,
} from "@/lib/db";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SkillCard } from "@/components/SkillCard";
import { DriftWall } from "@/components/DriftWall";

// Map a DB BrowseSkill to the Skill shape the cards expect (mirrors BrowseClient).
function toSkill(s: BrowseSkill): Skill {
  return {
    id: s.slug,
    title: s.title,
    desc: s.desc,
    publisher: s.ownerHandle,
    installs: s.installs,
    stars: s.stars,
    verifiedDate: s.verifiedDate,
    version: "",
    shelfTitle: s.category ?? "",
    shelfId: s.category?.toLowerCase().replace(/\s+/g, "-") ?? "",
    subShelf: undefined,
    tags: s.topics,
  };
}

function initialsOf(handle: string): string {
  return handle.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "??";
}

// Spread skills across publishers (one each, recent-first) so a single indexing
// batch doesn't dominate, then backfill with the rest.
function spreadByPublisher(skills: BrowseSkill[], limit: number): BrowseSkill[] {
  const firstPer: BrowseSkill[] = [];
  const leftover: BrowseSkill[] = [];
  const seen = new Set<string>();
  for (const s of skills) {
    if (seen.has(s.ownerHandle)) leftover.push(s);
    else {
      seen.add(s.ownerHandle);
      firstPer.push(s);
    }
  }
  return [...firstPer, ...leftover].slice(0, limit);
}

// ─── publisher card (real DB publisher) ───────────────────────────────────

function PubCard({
  pub,
  topSkills,
}: {
  pub: DBPublisherRow;
  topSkills: Skill[];
}) {
  return (
    <div className="lp-pub-card">
      <div className="pub-header">
        <span
          className="lp-avatar"
          style={{ width: 48, height: 48, fontSize: Math.round(48 * 0.42) }}
        >
          {initialsOf(pub.handle)}
        </span>
        <div className="who">
          <div className="pub-name">{pub.handle}</div>
          <div className="pub-handle">@{pub.handle}</div>
          <div className="pub-role">GitHub publisher</div>
        </div>
      </div>
      <div className="pub-stats">
        <div className="s">
          <span className="v lp-num">{pub.skillCount}</span>
          <span className="k">skills</span>
        </div>
        <div className="s">
          <span className="v lp-num">{fmtCount(pub.ghStars)}</span>
          <span className="k">gh stars</span>
        </div>
      </div>
      <div className="pub-top-skills">
        <div className="label">Top skills</div>
        {topSkills.map((s) => (
          <div className="row" key={s.id}>
            <span className="t">{s.title}</span>
            <span className="n">↓ {fmtCount(s.installs)}</span>
          </div>
        ))}
      </div>
      <div className="pub-foot">
        <Link className="lp-btn sm" href={`/creators/${pub.handle}`}>
          View profile →
        </Link>
        <Link className="lp-btn ghost sm" href={`/creators/${pub.handle}`}>
          All {pub.skillCount} skills
        </Link>
      </div>
    </div>
  );
}

// ─── how it works (static) ─────────────────────────────────────────────────

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

export default async function LandingPage() {
  // Real data from Supabase.
  const [dbSkills, dbPubs] = await Promise.all([
    getBrowseSkills(),
    getDBPublisherRows(),
  ]);

  // Most-recently-verified first (last_indexed_at desc).
  const recent = [...dbSkills].sort((a, b) =>
    (b.verifiedDate || "").localeCompare(a.verifiedDate || "")
  );

  const distinctTopics = new Set(dbSkills.flatMap((s) => s.topics)).size;
  const totalInstalls = dbSkills.reduce((a, s) => a + s.installs, 0);

  // Stats for Nav / Footer (they read .skills).
  const stats = {
    skills: dbSkills.length,
    publishers: dbPubs.length,
    installs: fmtCount(totalInstalls),
  };

  // Top skills per publisher handle (for the publisher cards), recent-first.
  const byOwner = new Map<string, Skill[]>();
  for (const s of recent) {
    const arr = byOwner.get(s.ownerHandle);
    if (arr) {
      if (arr.length < 2) arr.push(toSkill(s));
    } else {
      byOwner.set(s.ownerHandle, [toSkill(s)]);
    }
  }

  const spread = spreadByPublisher(recent, 16); // diverse, recent-first
  const wallSkills = spread.map(toSkill);
  const featured = spread.slice(0, 8).map(toSkill);
  const topPubs = dbPubs.slice(0, 8); // already sorted by installs then skillCount

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
            <span className="v lp-num">{fmtCount(stats.skills)}</span>
            <span className="k">skills · verified</span>
          </div>
          <div className="stat">
            <span className="v lp-num">{stats.publishers}</span>
            <span className="k">publishers · sourced</span>
          </div>
          <div className="stat">
            <span className="v lp-num">{distinctTopics}</span>
            <span className="k">topics · tracked</span>
          </div>
        </div>
      </header>

      {/* Drifting wall of recently-verified skills (real data) */}
      <DriftWall skills={wallSkills} />

      {/* Publishers band (real publishers, top by reach) */}
      <section className="lp-pubs" id="publishers">
        <div className="lp-page">
          <div className="lp-section-eyebrow">
            <span className="left">Publishers · {stats.publishers} sourced</span>
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
            {topPubs.map((pub) => (
              <PubCard
                key={pub.handle}
                pub={pub}
                topSkills={byOwner.get(pub.handle) ?? []}
              />
            ))}
            <Link className="lp-pub-end" href="/creators">
              <span className="t">
                Browse all <span className="lp-num">{stats.publishers}</span> publishers
              </span>
              <span className="a">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Recently verified (real data — replaces the un-categorized mock shelves) */}
      <main className="lp-shelves lp-page" id="shelves">
        <div className="lp-section-eyebrow">
          <span className="left">Recently verified</span>
          <span className="right">{fmtCount(stats.skills)} skills</span>
        </div>
        <section className="lp-shelf">
          <div className="lp-shelf-head">
            <div>
              <h2 className="lp-shelf-title">Fresh in the registry</h2>
              <p className="lp-shelf-blurb">
                The latest skills to pass verification, newest first.
              </p>
            </div>
            <div className="lp-shelf-right">
              <span>
                <span className="count lp-num">{fmtCount(stats.skills)}</span> skills
              </span>
              <Link className="see-all" href="/skills">
                browse all →
              </Link>
            </div>
          </div>
          <div className="lp-shelf-grid">
            {featured.map((s) => (
              <SkillCard key={s.id} skill={s} context="shelf" />
            ))}
          </div>
        </section>
      </main>

      {/* How it works */}
      <HowItWorks />

      {/* Footer */}
      <Footer stats={stats} />
    </div>
  );
}
