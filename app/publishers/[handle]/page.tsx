import { notFound } from "next/navigation";
import {
  PUBLISHERS,
  REAL_STATS,
  getPublisher,
  skillsByPublisher,
  shelvesByPublisher,
  type Skill,
} from "@/lib/data";
import {
  getSkillsByOwner,
  ownerFromUrl,
  repoPathFromUrl,
  skillLeaf,
  type SkillRow,
} from "@/lib/db";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SkillCard } from "@/components/SkillCard";

// Map a DB SkillRow to the Skill shape SkillCard expects.
function rowToSkill(row: SkillRow): Skill {
  return {
    id: row.slug,
    title: row.skill_name,
    desc: row.description_excerpt,
    publisher: ownerFromUrl(row.source_url),
    installs: row.skill_signal?.install_count_estimate ?? 0,
    stars: row.skill_signal?.stars ?? 0,
    verifiedDate: row.last_indexed_at ?? row.created_at,
    version: "",
    shelfTitle: row.category ?? "",
    shelfId: row.category?.toLowerCase().replace(/\s+/g, "-") ?? "",
    subShelf: undefined,
    tags: row.topics ?? [],
  };
}

function fmtCount(n: number | null | undefined): string {
  if (n == null) return "0";
  if (n < 1000) return String(n);
  const k = n / 1000;
  return (k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "")) + "k";
}

function GhIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

function XIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M11.59 2H13.7l-4.61 5.27L14.5 14h-4.25l-3.33-4.36L3.13 14H1.02l4.94-5.64L1 2h4.36l3.01 3.98L11.59 2zm-.74 10.74h1.17L4.97 3.2H3.71l7.14 9.54z"
      />
    </svg>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = PUBLISHERS[handle];
  const dbSkills = !p ? await getSkillsByOwner(handle, 1) : [];
  if (!p && dbSkills.length === 0) return {};

  const name = p?.name ?? handle;
  const skillCount = p ? skillsByPublisher(handle).length : (await getSkillsByOwner(handle)).length;
  const desc = p
    ? `${p.role}. ${skillCount} verified skill${skillCount !== 1 ? "s" : ""}.`
    : `${skillCount} skill${skillCount !== 1 ? "s" : ""} published on Claudinho.`;
  const url = `https://claudinho.xyz/publishers/${handle}`;

  return {
    title: name,
    description: desc,
    openGraph: { type: "website" as const, title: `${name} — Claudinho`, description: desc, url },
    twitter: { card: "summary_large_image" as const, title: `${name} — Claudinho`, description: desc },
  };
}

export default async function PublisherPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const stats = REAL_STATS;

  // Try curated catalog first (enriched bio/social data), fall back to DB.
  const catalogPub = getPublisher(handle);
  const dbSkillRows = await getSkillsByOwner(handle);

  if (!catalogPub && dbSkillRows.length === 0) notFound();

  // Build a unified publisher object.
  const pub = catalogPub ?? {
    handle,
    name: handle,
    role: "GitHub publisher",
    initials: handle.slice(0, 2).toUpperCase(),
    skills: dbSkillRows.length,
    loc: null,
    gh: null,
    fol: null,
    bio: null,
    intro: null,
    github: null,
    twitter: null,
    position: null,
    company: null,
    location: null,
  };

  // Skills: catalog first (richer SkillCard data), otherwise map DB rows.
  const catalogSkills = catalogPub ? skillsByPublisher(handle) : [];
  const skills: Skill[] = catalogSkills.length > 0
    ? catalogSkills
    : dbSkillRows.map(rowToSkill);

  const shelves = catalogPub ? shelvesByPublisher(handle) : [];

  return (
    <div className="lp pp accent-orange bg-cream">
      <Nav stats={stats} />

      {/* Header */}
      <header className="pp-header pp-page">
        <div className="pp-avatar-lg" aria-label={`${pub.name} avatar`}>
          {pub.initials}
        </div>
        <div className="pp-head-text">
          <h1 className="pp-name">{pub.name}</h1>
          <div className="pp-handle">/{pub.handle}</div>
          <div className="pp-role">
            {pub.position || pub.role}
            {pub.company && (
              <>
                <span className="sep">·</span>
                {pub.company}
              </>
            )}
            {(pub.location || pub.loc) && (
              <>
                <span className="sep">·</span>
                {pub.location || pub.loc}
              </>
            )}
          </div>
          <div className="pp-socials">
            {pub.github && (
              <a
                className="pp-social"
                href={`https://github.com/${pub.github.handle}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <GhIcon />
                <span className="handle">{pub.github.handle}</span>
                <span className="sep">·</span>
                <span className="count">{fmtCount(pub.github.followers)}</span>
                <span className="ext">↗</span>
              </a>
            )}
            {pub.twitter && (
              <a
                className="pp-social"
                href={`https://x.com/${pub.twitter.handle}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <XIcon />
                <span className="handle">@{pub.twitter.handle}</span>
                <span className="sep">·</span>
                <span className="count">{fmtCount(pub.twitter.followers)}</span>
                <span className="ext">↗</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Intro paragraph */}
      {pub.intro && (
        <section className="pp-intro pp-page">
          <div className="spacer" aria-hidden="true" />
          <p>{pub.intro}</p>
        </section>
      )}

      {/* Skills grid */}
      <section className="pp-skills pp-page">
        <div className="pp-skills-head">
          <span className="lhs">
            <span className="n">{skills.length}</span>{" "}
            {skills.length === 1 ? "skill" : "skills"}
          </span>
          {shelves.length > 0 && (
            <span className="rhs">
              <span className="k">filed under: </span>
              <span className="shelves">
                {shelves.map((sh, i) => (
                  <span key={sh}>
                    {i > 0 && <span className="sep">·</span>}
                    <a className="v" href="/browse">
                      {sh}
                    </a>
                  </span>
                ))}
              </span>
            </span>
          )}
        </div>
        {skills.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--ink-3)" }}>
            No skills published yet.
          </p>
        ) : (
          <div className="pp-grid">
            {skills.map((s) => (
              <SkillCard key={s.id} skill={s} context="browse" />
            ))}
          </div>
        )}
      </section>

      <Footer stats={stats} />
    </div>
  );
}

// Generate static params for all known publishers
export async function generateStaticParams() {
  return Object.keys(PUBLISHERS).map((handle) => ({ handle }));
}
