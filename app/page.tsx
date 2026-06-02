import Link from "next/link";
import { unstable_cache } from "next/cache";
import { fmtCount, genShelfId, shelfLabel, type Skill } from "@/lib/data";
import {
  getBrowseSkills,
  type BrowseSkill,
  type DBPublisherRow,
} from "@/lib/db";
import { Nav } from "@/components/Nav";

// The landing reads aggregate registry data that doesn't need to be realtime.
// One cached full scan (revalidated every 10 min) feeds the stat strip, the
// publishers band, and the recent-skills wall/grid — instead of two scans per
// request, which made the page take minutes to render.
export const revalidate = 600;

// Derive everything the landing needs from one full scan, then cache ONLY the
// small result — not the 2.2k-row array, which exceeds Next's 2MB data-cache
// limit and silently fails to cache (forcing a slow re-scan every request).
const getLandingData = unstable_cache(
  async () => {
    const skills = await getBrowseSkills();

    // Publisher aggregates (avoids a second full-table scan).
    const pubMap = new Map<string, DBPublisherRow>();
    let totalInstalls = 0;
    for (const s of skills) {
      totalInstalls += s.installs;
      if (!s.ownerHandle) continue;
      const e =
        pubMap.get(s.ownerHandle) ??
        { handle: s.ownerHandle, skillCount: 0, installs: 0, ghStars: 0 };
      e.skillCount++;
      e.installs += s.installs;
      e.ghStars += s.stars;
      pubMap.set(s.ownerHandle, e);
    }
    const pubs = [...pubMap.values()].sort(
      (a, b) => b.installs - a.installs || b.skillCount - a.skillCount
    );
    const topPubs = pubs.slice(0, 8);

    const recent = [...skills].sort((a, b) =>
      (b.verifiedDate || "").localeCompare(a.verifiedDate || "")
    );

    // Top 2 recent skills per top-publisher (for the publisher cards).
    const topHandles = new Set(topPubs.map((p) => p.handle));
    const topSkillsByPub: Record<string, BrowseSkill[]> = {};
    for (const s of recent) {
      if (!topHandles.has(s.ownerHandle)) continue;
      const arr = (topSkillsByPub[s.ownerHandle] ??= []);
      if (arr.length < 2) arr.push(s);
    }

    return {
      totalSkills: skills.length,
      totalPublishers: pubs.length,
      totalInstalls,
      distinctTopics: new Set(skills.flatMap((s) => s.topics)).size,
      topPubs,
      spread: spreadByPublisher(recent, 16), // diverse, recent-first
      topSkillsByPub,
    };
  },
  ["landing-data-v3"],
  { revalidate: 600 }
);
import { Footer } from "@/components/Footer";
import { SkillCard } from "@/components/SkillCard";
import { DriftWall } from "@/components/DriftWall";

// Map a DB BrowseSkill to the Skill shape the cards expect (mirrors BrowseClient).
function toSkill(s: BrowseSkill): Skill {
  // Prefer generated copy only when content_status is 'ok'; use generated
  // shelf/tags for classification whenever present.
  const ok = s.contentStatus === "ok";
  const sid = genShelfId(s.genShelf);
  return {
    id: s.slug,
    title: ok && s.displayTitle ? s.displayTitle : s.title,
    desc: ok && s.displayDescription ? s.displayDescription : s.desc,
    publisher: s.ownerHandle,
    installs: s.installs,
    stars: s.stars,
    verifiedDate: s.verifiedDate,
    version: "",
    shelfTitle: s.genShelf ? shelfLabel(sid) : (s.category ?? ""),
    shelfId: s.genShelf ? sid : (s.category?.toLowerCase().replace(/\s+/g, "-") ?? ""),
    subShelf: s.subShelf ?? undefined,
    tags: s.genTags && s.genTags.length ? s.genTags : s.topics,
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
  // Real data from Supabase (single cached scan, small cached payload).
  const {
    totalSkills,
    totalPublishers,
    totalInstalls,
    distinctTopics,
    topPubs,
    spread,
    topSkillsByPub,
  } = await getLandingData();

  // Stats for Nav / Footer (they read .skills).
  const stats = {
    skills: totalSkills,
    publishers: totalPublishers,
    installs: fmtCount(totalInstalls),
  };

  // Top skills per publisher handle (for the publisher cards).
  const byOwner = new Map<string, Skill[]>();
  for (const [handle, list] of Object.entries(topSkillsByPub)) {
    byOwner.set(handle, list.map(toSkill));
  }

  const wallSkills = spread.map(toSkill);
  const featured = spread.slice(0, 8).map(toSkill);

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
          Two thousand community skills, sorted by the job they do. Find the one for your
          work and install it in a click — no terminal.
        </p>
        <div className="actions">
          <a href="#shelves" className="lp-btn solid">
            Browse skills →
          </a>
          <a href="#how" className="lp-btn ghost">
            How install works
          </a>
        </div>
        <div className="stat-strip">
          <div className="stat">
            <span className="v lp-num">{fmtCount(stats.skills)}</span>
            <span className="k">skills · indexed</span>
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
