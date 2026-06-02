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
const WALL_CURATORS = new Set([
  "obra", "mattpocock", "anthropic", "coreyhaines31", "addyosmani", "garrytan",
]);

// Handles that are always shown in the publishers band, regardless of install rank.
const PINNED_PUBLISHERS = new Set(["garrytan"]);

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
    // Always include pinned publishers; fill remaining slots from the ranked list.
    const pinned = pubs.filter(p => PINNED_PUBLISHERS.has(p.handle));
    const ranked = pubs.filter(p => !PINNED_PUBLISHERS.has(p.handle));
    const topPubs = [...pinned, ...ranked].slice(0, 8);

    const recent = [...skills].sort((a, b) =>
      (b.verifiedDate || "").localeCompare(a.verifiedDate || "")
    );

    // Top 2 skills per top-publisher by installs (for the publisher cards).
    const topHandles = new Set(topPubs.map((p) => p.handle));
    const topSkillsByPub: Record<string, BrowseSkill[]> = {};
    const byInstalls = [...skills].sort((a, b) => b.installs - a.installs);
    for (const s of byInstalls) {
      if (!topHandles.has(s.ownerHandle)) continue;
      const arr = (topSkillsByPub[s.ownerHandle] ??= []);
      if (arr.length < 2) arr.push(s);
    }

    // Wall: skills from curated handles, interleaved by publisher so the wall
    // looks diverse. Sorted by installs within each publisher's bucket so the
    // best skills surface first. Fall back to all-publisher spread if the
    // curated set is too thin (< 8 cards).
    const wallByPub = new Map<string, BrowseSkill[]>();
    for (const s of skills) {
      if (!WALL_CURATORS.has(s.ownerHandle)) continue;
      if (!wallByPub.has(s.ownerHandle)) wallByPub.set(s.ownerHandle, []);
      const bucket = wallByPub.get(s.ownerHandle)!;
      bucket.push(s);
    }
    for (const bucket of wallByPub.values()) {
      bucket.sort((a, b) => b.installs - a.installs);
    }
    const wallCurated = interleaveByPublisher(wallByPub, 24);
    const wall = wallCurated.length >= 8
      ? wallCurated
      : spreadByPublisher(recent, 16);

    return {
      totalSkills: skills.length,
      totalPublishers: pubs.length,
      totalInstalls,
      distinctTopics: new Set(skills.flatMap((s) => s.topics)).size,
      topPubs,
      wall,
      spread: spreadByPublisher(recent, 16),
      topSkillsByPub,
    };
  },
  ["landing-data-v6"],
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

// Round-robin across per-publisher buckets so no single publisher dominates
// the wall. Each bucket should already be sorted by desired order (e.g. installs).
function interleaveByPublisher(
  byPub: Map<string, BrowseSkill[]>,
  limit: number
): BrowseSkill[] {
  const buckets = [...byPub.values()];
  const out: BrowseSkill[] = [];
  let i = 0;
  while (out.length < limit) {
    let added = false;
    for (const bucket of buckets) {
      if (i < bucket.length) {
        out.push(bucket[i]);
        added = true;
        if (out.length >= limit) break;
      }
    }
    if (!added) break;
    i++;
  }
  return out;
}

// Known display names / roles for select publishers.
const PUBLISHER_META: Record<string, { name: string; role: string }> = {
  garrytan: { name: "Garry Tan", role: "President & CEO, Y Combinator" },
};

// ─── publisher card (real DB publisher) ───────────────────────────────────

function PubCard({
  pub,
  topSkills,
}: {
  pub: DBPublisherRow;
  topSkills: Skill[];
}) {
  const meta = PUBLISHER_META[pub.handle];
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
          <div className="pub-name">{meta?.name ?? pub.handle}</div>
          <div className="pub-handle">@{pub.handle}</div>
          <div className="pub-role">{meta?.role ?? "GitHub publisher"}</div>
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
            {s.installs > 0 && <span className="n">↓ {fmtCount(s.installs)}</span>}
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
          <span className="left">How it works</span>
          <span className="right">no terminal required</span>
        </div>
        <div className="lp-how-head">
          <h2>From "I want Claude to do this" to actually done.</h2>
          <p className="lede">
            Three steps. No command line, no reading someone&apos;s GitHub repo, no guessing whether it works.
          </p>
        </div>
        <div className="lp-how-grid">
          <div className="step">
            <span className="n">01 · Find</span>
            <h3>Browse by job, not by search term.</h3>
            <p>
              Skills are organised by what they do — Marketing, Engineering, Sales, Operations —
              not by repo name or keyword. Each card tells you what the skill does and who it&apos;s best for
              before you click anything.
            </p>
            <span className="out">
              <span className="k">how: </span>
              <span className="v">browse by shelf · filter by topic · sort by installs</span>
            </span>
          </div>
          <div className="step">
            <span className="n">02 · Install</span>
            <h3>Download the file. Drag it in. Done.</h3>
            <p>
              Every skill is packaged as a <code>.skill</code> file. Download it and drag it into
              Claude Desktop or Cowork — the same way you&apos;d open any file. No terminal,
              no install command, no reading code.
            </p>
            <span className="out">
              <span className="k">works with: </span>
              <span className="v">Claude Desktop · Cowork · CLI for power users</span>
            </span>
          </div>
          <div className="step">
            <span className="n">03 · Share</span>
            <h3>Send it to your team in one click.</h3>
            <p>
              Found something useful? Hit &ldquo;Copy for Slack&rdquo; on any skill page and paste it
              directly into a message — title, what it&apos;s best for, and the install link, formatted
              and ready to send.
            </p>
            <span className="out">
              <span className="k">also: </span>
              <span className="v">every skill link previews with title + image in Slack</span>
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
    wall,
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

  const wallSkills = wall.map(toSkill);
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
            <span className="k">skills · ready to install</span>
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
            <span className="left">Publishers · {stats.publishers} creators</span>
            <Link className="right" href="/creators">view all →</Link>
          </div>
          <div className="head">
            <div>
              <h2>Built by people who use Claude for this every&nbsp;day.</h2>
            </div>
            <p className="lede">
              When the person who built a skill uses it in their own work, it&apos;s a different kind
              of thing than a weekend project.
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
          <span className="left">Ready to install</span>
          <span className="right">{fmtCount(stats.skills)} skills</span>
        </div>
        <section className="lp-shelf">
          <div className="lp-shelf-head">
            <div>
              <h2 className="lp-shelf-title">New this week</h2>
              <p className="lp-shelf-blurb">
                Skills added this week, ready to drag into Claude.
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
