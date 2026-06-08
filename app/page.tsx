import Link from "next/link";
import { unstable_cache } from "next/cache";
import { fmtCount, genShelfId, shelfLabel, skillsByPublisher, type Skill } from "@/lib/data";
import {
  getBrowseSkills,
  getPublisherProfiles,
  getAllRepoInfos,
  getSkillTrustMap,
  type BrowseSkill,
  type DBPublisherRow,
  type PublisherProfile,
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

// Handles always shown first in the creators band regardless of star rank.
const PINNED_PUBLISHERS = new Set(["garrytan"]);
// Handles excluded from the band even if they rank highly.
const SUPPRESSED_PUBLISHERS = new Set(["doany-ai"]);

const getLandingData = unstable_cache(
  async () => {
    const [skills, repoInfos, trustMap] = await Promise.all([getBrowseSkills(), getAllRepoInfos(), getSkillTrustMap()]);

    // Publisher aggregates (avoids a second full-table scan).
    const pubMap = new Map<string, DBPublisherRow>();
    let totalInstalls = 0;
    const seenRepos = new Set<string>();
    for (const s of skills) {
      totalInstalls += s.installs;
      if (!s.ownerHandle) continue;
      const e =
        pubMap.get(s.ownerHandle) ??
        { handle: s.ownerHandle, skillCount: 0, installs: 0, ghStars: 0 };
      e.skillCount++;
      e.installs += s.installs;
      // Count repo stars once per repo using repo_info (fresh) over skill_signal (stale).
      const repoKey = `${s.ownerHandle}/${s.repoName}`;
      if (!seenRepos.has(repoKey)) {
        e.ghStars += repoInfos.get(repoKey)?.stars ?? s.stars;
        seenRepos.add(repoKey);
      }
      pubMap.set(s.ownerHandle, e);
    }
    // Creators: sort by GH stars, pinned handles always first.
    const pubs = [...pubMap.values()].sort(
      (a, b) => b.ghStars - a.ghStars || b.installs - a.installs
    );
    const pinned = pubs.filter(p => PINNED_PUBLISHERS.has(p.handle));
    const ranked = pubs.filter(p => !PINNED_PUBLISHERS.has(p.handle) && !SUPPRESSED_PUBLISHERS.has(p.handle));
    const topPubs = [...pinned, ...ranked].slice(0, 8);

    // Top 2 skills per top-publisher by installs (for the publisher cards).
    const topHandles = new Set(topPubs.map((p) => p.handle));
    const topSkillsByPub: Record<string, BrowseSkill[]> = {};
    const byInstalls = [...skills].sort((a, b) => b.installs - a.installs);
    for (const s of byInstalls) {
      if (!topHandles.has(s.ownerHandle)) continue;
      const arr = (topSkillsByPub[s.ownerHandle] ??= []);
      if (arr.length < 2) arr.push(s);
    }

    // Wall: top 10 most-installed enriched skills, max 1 per creator for diversity.
    const seenWallOwners = new Set<string>();
    const wall = byInstalls
      .filter(s => {
        if (s.installs < 100_000 || s.contentStatus !== "ok") return false;
        if (seenWallOwners.has(s.ownerHandle)) return false;
        seenWallOwners.add(s.ownerHandle);
        return true;
      })
      .slice(0, 10);

    // Hot this week: mix of skills.sh hot + trending, enriched only, top 8.
    const hotSorted = [...skills]
      .filter(s => s.contentStatus === "ok" && (s.hotRank !== null || s.trendingRank !== null))
      .sort((a, b) => {
        const aScore = Math.min(a.hotRank ?? Infinity, a.trendingRank ?? Infinity);
        const bScore = Math.min(b.hotRank ?? Infinity, b.trendingRank ?? Infinity);
        return aScore - bScore || b.installs - a.installs;
      });
    const hotSkills = hotSorted.slice(0, 8);

    const pubProfiles = await getPublisherProfiles(topPubs.map(p => p.handle));

    return {
      totalSkills: skills.length,
      totalPublishers: pubs.length,
      totalInstalls,
      topPubs,
      wall,
      hotSkills,
      topSkillsByPub,
      pubProfiles: Object.fromEntries(pubProfiles),
      trustMap,
    };
  },
  ["landing-data-v16"],
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


// ─── publisher card (real DB publisher) ───────────────────────────────────

function pubRole(profile: PublisherProfile | undefined): string {
  if (!profile) return "GitHub creator";
  const parts: string[] = [];
  if (profile.company) parts.push(profile.company);
  if (!parts.length && profile.bio) {
    // Use first sentence of bio as fallback role line.
    const sentence = profile.bio.split(/[.!?\n]/)[0].trim();
    if (sentence.length <= 60) parts.push(sentence);
  }
  return parts.join(" · ") || "GitHub creator";
}

function PubCard({
  pub,
  topSkills,
  profile,
}: {
  pub: DBPublisherRow;
  topSkills: Skill[];
  profile?: PublisherProfile;
}) {
  const displayName = profile?.displayName ?? pub.handle;
  // Only show @handle if it adds information (i.e. there's a real name different from the handle).
  const showHandle = displayName.toLowerCase() !== pub.handle.toLowerCase();
  return (
    <div className="lp-pub-card">
      <div className="pub-header">
        <span
          className="lp-avatar"
          style={{ width: 48, height: 48, fontSize: Math.round(48 * 0.42), overflow: "hidden", padding: 0 }}
        >
          {profile?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt={displayName} width={48} height={48} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            initialsOf(pub.handle)
          )}
        </span>
        <div className="who">
          <div className="pub-name">{displayName}</div>
          {showHandle && <div className="pub-handle">@{pub.handle}</div>}
          <div className="pub-role">{pubRole(profile)}</div>
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

// ─── trust / about ─────────────────────────────────────────────────────────

function TrustAbout() {
  return (
    <section className="lp-trust-about lp-page" id="about">
      <div className="lp-section-eyebrow">
        <span className="left">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }}>
            <circle cx="5.5" cy="5.5" r="5" fill="var(--verified-soft)" stroke="var(--verified)" strokeWidth="1"/>
            <path d="M3 5.5l1.6 1.6 3.4-3.4" stroke="var(--verified)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Built-in security
        </span>
        <span className="right">3 independent checks · every skill</span>
      </div>
      <p className="lp-trust-about-body">
        Every skill on Claudinho is automatically checked by three independent security
        firms — Gen Agent Trust Hub, Socket, and Snyk — before it reaches you. You can
        browse and install without worrying about what you&apos;re running.
      </p>
    </section>
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
    topPubs,
    wall,
    hotSkills,
    topSkillsByPub,
    pubProfiles,
    trustMap,
  } = await getLandingData();

  // Stats for Nav / Footer (they read .skills).
  const stats = {
    skills: totalSkills,
    creators: totalPublishers,
    installs: fmtCount(totalInstalls),
  };

  // Skills shown on each publisher card: catalog picks take priority, but pad to 2
  // with DB top-by-installs when fewer than 2 picks exist (e.g. obra has 1 pick).
  const byOwner = new Map<string, Skill[]>();
  for (const [handle, list] of Object.entries(topSkillsByPub)) {
    const picks = skillsByPublisher(handle).filter((s) => s.pick).slice(0, 2);
    const dbSkills = list.map(toSkill);
    const merged = picks.length >= 2
      ? picks
      : [...picks, ...dbSkills.filter((d) => !picks.some((p) => p.id === d.id))].slice(0, 2);
    byOwner.set(handle, merged);
  }

  const wallSkills = wall.map(toSkill);
  const featured = hotSkills.map(toSkill);

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
            <span className="v lp-num">{fmtCount(totalInstalls)}</span>
            <span className="k">installs · all time</span>
          </div>
          <div className="stat">
            <div className="stat-v-row">
              <span className="v lp-num">{fmtCount(stats.skills)}</span>
              <span className="lp-trust-badge-sm" title="Every skill is automatically checked by three independent security firms">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <circle cx="6" cy="6" r="5.5" fill="var(--verified-soft)" stroke="var(--verified)" strokeWidth="1"/>
                  <path d="M3.5 6l1.8 1.8 3.2-3.6" stroke="var(--verified)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </div>
            <span className="k">skills · every one security-checked</span>
          </div>
          <div className="stat">
            <span className="v lp-num">{fmtCount(stats.creators)}</span>
            <span className="k">creators · indexed</span>
          </div>
        </div>
      </header>

      {/* Drifting wall of recently-verified skills (real data) */}
      <DriftWall skills={wallSkills} />

      {/* Creators band */}
      <section className="lp-pubs" id="creators">
        <div className="lp-page">
          <div className="lp-section-eyebrow">
            <span className="left">Creators · {fmtCount(stats.creators)}</span>
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
                profile={pubProfiles[pub.handle.toLowerCase()]}
              />
            ))}
            <Link className="lp-pub-end" href="/creators">
              <span className="t">
                Browse all <span className="lp-num">{fmtCount(stats.creators)}</span> creators
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
              <h2 className="lp-shelf-title">Hot this week</h2>
              <p className="lp-shelf-blurb">
                Trending across the community right now.
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
              <SkillCard key={s.id} skill={s} context="shelf" trust={trustMap[s.id]} />
            ))}
          </div>
        </section>
      </main>

      {/* How it works */}
      <HowItWorks />

      {/* Trust / about */}
      <TrustAbout />

      {/* Footer */}
      <Footer stats={stats} />
    </div>
  );
}
