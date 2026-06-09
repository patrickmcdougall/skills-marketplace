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

// Curated picks for non-technical teams — shown in order on the landing page.
const CURATED_SLUGS = [
  "mattpocock-skills-grill-me",
  "agentspace-so-runcomfy-agent-skills-video-edit",
  "obra-superpowers-brainstorming",
  "mattpocock-skills-to-prd",
  "mattpocock-skills-triage",
  "mattpocock-skills-handoff",
  "anthropics-skills-pptx",
  "coreyhaines31-marketingskills-seo-audit",
  "anthropics-skills-pdf",
  "coreyhaines31-marketingskills-copywriting",
  "anthropics-skills-xlsx",
  "coreyhaines31-marketingskills-content-strategy",
];

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

    // Hot this week: mix of skills.sh hot + trending, enriched only, top 8.
    const hotSorted = [...skills]
      .filter(s => s.contentStatus === "ok" && (s.hotRank !== null || s.trendingRank !== null))
      .sort((a, b) => {
        const aScore = Math.min(a.hotRank ?? Infinity, a.trendingRank ?? Infinity);
        const bScore = Math.min(b.hotRank ?? Infinity, b.trendingRank ?? Infinity);
        return aScore - bScore || b.installs - a.installs;
      });
    const hotSkills = hotSorted.slice(0, 8);

    // Curated picks for the drift wall: pull in order of CURATED_SLUGS, skip any not in DB.
    const slugIndex = new Map(skills.map(s => [s.slug, s]));
    const curatedSkills = CURATED_SLUGS.map(slug => slugIndex.get(slug)).filter((s): s is BrowseSkill => s !== undefined);

    // Shelf highlights: top 3 skills per shelf for the category browser.
    const SHELF_DEFS = [
      { id: "product",   title: "Product",          blurb: "Spec features, triage feedback, write PRDs.",       genShelf: "product" },
      { id: "marketing", title: "Marketing",         blurb: "Draft campaigns, audit SEO, write copy.",           genShelf: "marketing" },
      { id: "cs",        title: "Customer Success",  blurb: "Triage tickets, build onboarding, draft saves.",    genShelf: "customer-success" },
      { id: "ops",       title: "Operations",        blurb: "Reconcile expenses, prepare docs, run hygiene.",    genShelf: "operations" },
      { id: "eng",       title: "Engineering",       blurb: "Review PRs, generate tests, document code.",        genShelf: "engineering" },
      { id: "design",    title: "Design",            blurb: "Audit UI, spec components, run a11y checks.",       genShelf: "design" },
      { id: "sales",     title: "Sales",             blurb: "Cold outreach, follow-ups, pipeline summaries.",    genShelf: "sales" },
      { id: "finance",   title: "Finance",           blurb: "Build runway models, prep investor updates.",       genShelf: "finance" },
    ];
    const topByGenShelf = new Map<string, BrowseSkill[]>();
    for (const s of byInstalls) {
      if (s.contentStatus !== "ok" || !s.genShelf) continue;
      const arr = topByGenShelf.get(s.genShelf) ?? [];
      if (arr.length < 3) { arr.push(s); topByGenShelf.set(s.genShelf, arr); }
    }
    const shelfHighlights = SHELF_DEFS
      .map(def => {
        const topSkills = topByGenShelf.get(def.genShelf) ?? [];
        if (!topSkills.length) return null;
        return { shelfId: def.id, shelfTitle: def.title, blurb: def.blurb, topSkills };
      })
      .filter((x): x is { shelfId: string; shelfTitle: string; blurb: string; topSkills: BrowseSkill[] } => x !== null);

    const pubProfiles = await getPublisherProfiles(topPubs.map(p => p.handle));

    return {
      totalSkills: skills.length,
      totalPublishers: pubs.length,
      totalInstalls,
      topPubs,
      hotSkills,
      curatedSkills,
      shelfHighlights,
      topSkillsByPub,
      pubProfiles: Object.fromEntries(pubProfiles),
      trustMap,
    };
  },
  ["landing-data-v19"],
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
    hotSkills,
    curatedSkills,
    shelfHighlights,
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

  const driftSkills = curatedSkills.map(toSkill);
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
          12,000+ community skills, sorted by the job they do. Find the one for your
          work and install it in a click — no terminal.
        </p>
        <div className="actions">
          <a href="#shelves" className="lp-btn accent">
            Browse skills →
          </a>
          <a href="#how" className="lp-text-link">
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

      {/* Drifting wall of curated skills */}
      <DriftWall skills={driftSkills} />

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

      {/* Shelves — category browser + hot this week */}
      <main className="lp-shelves lp-page" id="shelves">
        {/* Browse by role */}
        <div className="lp-cat-section">
          <div className="lp-shelf-head">
            <div>
              <h2 className="lp-shelf-title">Browse by role</h2>
              <p className="lp-shelf-blurb">Skills organised by the job they do.</p>
            </div>
            <div className="lp-shelf-right">
              <span><span className="count lp-num">{shelfHighlights.length}</span> categories</span>
              <Link className="see-all" href="/skills">browse all →</Link>
            </div>
          </div>
          <div className="lp-cat-grid">
            {shelfHighlights.map(({ shelfId, shelfTitle, blurb, topSkills }) => {
              const skills = topSkills.map(toSkill);
              return (
                <Link key={shelfId} className={`lp-cat-card cat-${shelfId}`} href={`/skills?shelf=${shelfId}`}>
                  <span className="cat-title">{shelfTitle}</span>
                  <p className="cat-blurb">{blurb}</p>
                  <div className="cat-examples">
                    <span className="cat-examples-label">example skills</span>
                    {skills.map(s => (
                      <div key={s.id} className="cat-ex-row">
                        <span className="t">{s.title}</span>
                        {s.installs > 0 && <span className="n">↓ {fmtCount(s.installs)}</span>}
                      </div>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Hot this week */}
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

      {/* Trust / about */}
      <TrustAbout />

      {/* How it works */}
      <HowItWorks />

      {/* Footer */}
      <Footer stats={stats} />
    </div>
  );
}
