import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PUBLISHERS,
  REAL_STATS,
  getPublisher,
  shelvesByPublisher,
  type Skill,
  genShelfId,
  shelfLabel,
} from "@/lib/data";
import {
  getSkillsByOwner,
  getPublisherProfiles,
  getRepoInfos,
  repoPathFromUrl,
  ownerFromUrl,
  type SkillRow,
  type PublisherProfile,
  type RepoInfo,
} from "@/lib/db";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CreatorSkillsClient } from "./CreatorSkillsClient";

export const revalidate = 3600;

function rowToSkill(row: SkillRow): Skill {
  const ok = row.content_status === "ok";
  const sid = genShelfId(row.shelf);
  return {
    id: row.slug,
    title: ok && row.display_title ? row.display_title : row.skill_name,
    desc: ok && row.display_description ? row.display_description : row.description_excerpt,
    publisher: ownerFromUrl(row.source_url),
    installs: (row.skill_signal?.install_count_estimate ?? 0) + (row.skill_signal?.install_count ?? 0),
    stars: row.skill_signal?.stars ?? 0,
    verifiedDate: row.last_indexed_at ?? row.created_at,
    version: "",
    shelfTitle: row.shelf ? shelfLabel(sid) : (row.category ?? ""),
    shelfId: row.shelf ? sid : (row.category?.toLowerCase().replace(/\s+/g, "-") ?? ""),
    subShelf: row.sub_shelf ?? undefined,
    tags: row.tags ?? row.topics ?? [],
  };
}

function fmtCount(n: number | null | undefined): string {
  if (n == null) return "0";
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return (k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "")) + "k";
  }
  const m = n / 1_000_000;
  return (m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "")) + "M";
}

function GhIcon({ size = 13 }: { size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function XIcon({ size = 13 }: { size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M11.59 2H13.7l-4.61 5.27L14.5 14h-4.25l-3.33-4.36L3.13 14H1.02l4.94-5.64L1 2h4.36l3.01 3.98L11.59 2zm-.74 10.74h1.17L4.97 3.2H3.71l7.14 9.54z" />
    </svg>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profileMap = await getPublisherProfiles([handle]);
  const profile = profileMap.get(handle.toLowerCase());
  const dbSkills = await getSkillsByOwner(handle, 1);
  const p = getPublisher(handle);
  if (!p && dbSkills.length === 0) return {};

  const name = profile?.displayName ?? p?.name ?? handle;
  const skillCount = (await getSkillsByOwner(handle)).length;
  const desc = `${name} — ${skillCount} skill${skillCount !== 1 ? "s" : ""} on Claudinho.`;
  const url = `https://claudinho.xyz/creators/${handle}`;

  return {
    title: name,
    description: desc,
    openGraph: { type: "website" as const, title: `${name} — Claudinho`, description: desc, url },
    twitter: { card: "summary_large_image" as const, title: `${name} — Claudinho`, description: desc },
  };
}

export async function generateStaticParams() {
  return Object.keys(PUBLISHERS).map((handle) => ({ handle }));
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const stats = REAL_STATS;

  const catalogPub = getPublisher(handle);
  const [dbSkillRows, profileMap] = await Promise.all([
    getSkillsByOwner(handle),
    getPublisherProfiles([handle]),
  ]);
  const profile: PublisherProfile | undefined = profileMap.get(handle.toLowerCase());

  if (!catalogPub && dbSkillRows.length === 0) notFound();

  // Fetch repo info for all distinct repos this creator has skills in.
  const distinctRepoPaths = [...new Set(dbSkillRows.map(r => repoPathFromUrl(r.source_url)))].filter(Boolean);
  const repoInfoMap = await getRepoInfos(distinctRepoPaths);

  // Group skills by repo, sort repos by star count desc.
  type RepoSection = { repoPath: string; info: RepoInfo | undefined; skills: Skill[] };
  const repoSections: RepoSection[] = distinctRepoPaths
    .map(repoPath => ({
      repoPath,
      info: repoInfoMap.get(repoPath),
      skills: dbSkillRows
        .filter(r => repoPathFromUrl(r.source_url) === repoPath)
        .map(rowToSkill),
    }))
    .sort((a, b) => (b.info?.stars ?? 0) - (a.info?.stars ?? 0));

  // Header data — profile name wins over catalog name.
  const displayName = profile?.displayName ?? catalogPub?.name ?? handle;
  const showHandle = displayName.toLowerCase() !== handle.toLowerCase();
  const avatarUrl = profile?.avatarUrl ?? null;
  const followers = profile?.ghFollowers ?? null;

  // Role line parts — deduplicate if catalog role === profile company.
  const catalogRole = catalogPub?.position || catalogPub?.role;
  const company = catalogPub?.company ?? profile?.company ?? null;
  const showCompany = company && company.toLowerCase() !== catalogRole?.toLowerCase();
  const location = catalogPub?.location ?? catalogPub?.loc ?? profile?.location ?? null;

  // Social links — prefer profile followers for GitHub, catalog for Twitter if available.
  const ghHandle = catalogPub?.github?.handle ?? handle;
  const twitterHandle = catalogPub?.twitter?.handle ?? profile?.twitterUsername ?? null;
  const twitterFollowers = catalogPub?.twitter?.followers ?? null;
  const blog = (catalogPub as { blog?: string | null } | null)?.blog ?? profile?.blog ?? null;

  // Intro paragraph from catalog (curated) or profile bio.
  const intro = catalogPub?.intro ?? profile?.bio ?? null;

  const shelves = catalogPub ? shelvesByPublisher(handle) : [];
  const totalSkills = dbSkillRows.length;

  return (
    <div className="lp pp accent-orange bg-cream">
      <Nav stats={stats} />

      {/* Header */}
      <header className="pp-header pp-page">
        <div className="pp-avatar-lg" aria-label={`${displayName} avatar`}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={displayName} width={80} height={80} style={{ borderRadius: 4, display: "block" }} />
          ) : (
            (profile?.displayName ?? handle).slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="pp-head-text">
          <h1 className="pp-name">{displayName}</h1>
          {showHandle && <div className="pp-handle">/{handle}</div>}
          <div className="pp-role">
            {(() => {
              const parts = [
                catalogRole,
                showCompany ? company : null,
                location,
              ].filter(Boolean) as string[];
              return parts.map((p, i) => (
                <span key={i}>{i > 0 && <span className="sep">·</span>}{p}</span>
              ));
            })()}
          </div>
          <div className="pp-socials">
            <a
              className="pp-social"
              href={`https://github.com/${ghHandle}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <GhIcon />
              <span className="handle">{ghHandle}</span>
              {followers != null && (
                <>
                  <span className="sep">·</span>
                  <span className="count">{fmtCount(followers)}</span>
                  <span className="ext">followers</span>
                </>
              )}
              <span className="ext">↗</span>
            </a>
            {twitterHandle && (
              <a
                className="pp-social"
                href={`https://x.com/${twitterHandle}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <XIcon />
                <span className="handle">@{twitterHandle}</span>
                {twitterFollowers != null && (
                  <>
                    <span className="sep">·</span>
                    <span className="count">{fmtCount(twitterFollowers)}</span>
                  </>
                )}
                <span className="ext">↗</span>
              </a>
            )}
            {blog && (
              <a
                className="pp-social"
                href={blog}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="handle">{blog.replace(/^https?:\/\//, "")}</span>
                <span className="ext">↗</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Intro */}
      {intro && (
        <section className="pp-intro pp-page">
          <div className="spacer" aria-hidden="true" />
          <p>{intro}</p>
        </section>
      )}

      {/* Skills — search/filter/sort via client component */}
      <main className="pp-skills pp-page">
        <div className="pp-skills-head">
          <span className="lhs">
            <span className="n">{totalSkills}</span>{" "}
            {totalSkills === 1 ? "skill" : "skills"}
          </span>
          {shelves.length > 0 && (
            <span className="rhs">
              <span className="k">filed under: </span>
              <span className="shelves">
                {shelves.map((sh, i) => (
                  <span key={sh}>
                    {i > 0 && <span className="sep">·</span>}
                    <a className="v" href="/skills">{sh}</a>
                  </span>
                ))}
              </span>
            </span>
          )}
        </div>

        {totalSkills === 0 ? (
          <p style={{ fontSize: 14, color: "var(--ink-3)" }}>No skills published yet.</p>
        ) : (
          <CreatorSkillsClient repoSections={repoSections} totalSkills={totalSkills} />
        )}
      </main>

      <Footer stats={stats} />
    </div>
  );
}
