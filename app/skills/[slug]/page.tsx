import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSkillBySlug,
  getOtherSkillsByOwner,
  ownerFromUrl,
  repoPathFromUrl,
  skillLeaf,
  installCommand,
} from "@/lib/db";
import { PUBLISHERS, REAL_STATS, fmtCount } from "@/lib/data";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { InstallCard } from "./InstallCard";

// ─── helpers ──────────────────────────────────────────────────────────────

function fmtDateShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ─── metadata ─────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await getSkillBySlug(slug);
  if (!row) notFound();

  const owner = ownerFromUrl(row.source_url);
  const url = `https://claudinho.xyz/skills/${slug}`;

  return {
    title: row.skill_name,
    description: row.description_excerpt,
    openGraph: {
      type: "website" as const,
      title: `${row.skill_name} — Claudinho`,
      description: row.description_excerpt,
      url,
    },
    twitter: {
      card: "summary_large_image" as const,
      title: `${row.skill_name} — Claudinho`,
      description: row.description_excerpt,
    },
    other: { "skill:publisher": owner },
  };
}

// ─── page ─────────────────────────────────────────────────────────────────

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const row = await getSkillBySlug(slug);
  if (!row) notFound();

  const owner = ownerFromUrl(row.source_url);
  const repoPath = repoPathFromUrl(row.source_url);
  const repoName = repoPath.split("/")[1] ?? repoPath;
  const leaf = skillLeaf(row.skill_name);
  const cmd = installCommand(repoPath, row.skill_name);
  const signal = row.skill_signal;

  // Publisher — use curated catalog if available, fall back to GitHub owner
  const catalogPub = PUBLISHERS[owner];
  const pub = {
    handle: owner,
    name: catalogPub?.name ?? owner,
    role: catalogPub?.role ?? null,
    initials: catalogPub?.initials ?? owner.slice(0, 2).toUpperCase(),
    skills: catalogPub?.skills ?? null,
  };

  const stats = REAL_STATS;
  const others = await getOtherSkillsByOwner(owner, slug, 3);

  return (
    <div className="lp dp accent-orange bg-cream">
      <Nav stats={stats} />

      {/* Title block */}
      <section className="dp-title-block dp-page">
        <nav className="dp-breadcrumb">
          <Link href={`/publishers/${owner}`}>{owner}</Link>
          <span className="sep">/</span>
          <span>{repoName}</span>
          <span className="sep">/</span>
          <span className="here">{leaf}</span>
        </nav>
        <h1>{row.skill_name}</h1>
        <p className="dp-desc">{row.description_excerpt}</p>
        {row.category && (
          <div className="dp-cat">{row.category}</div>
        )}
      </section>

      {/* Two-column grid */}
      <div className="dp-page dp-grid">
        {/* Left column */}
        <div className="dp-left">

          {/* Topics */}
          {row.topics.length > 0 && (
            <section className="dp-block">
              <h2 className="dp-h2">Topics</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {row.topics.map((t) => (
                  <span key={t} className="skill-card tag">{t}</span>
                ))}
              </div>
            </section>
          )}

          {/* Source — links back to the GitHub repo */}
          <section className="dp-block dp-readme">
            <h2 className="dp-h2">Source</h2>
            <p className="dp-h2-sub">
              Publisher&apos;s repository · {repoPath}
            </p>
            <div style={{ marginTop: 12 }}>
              <a
                href={row.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-btn"
              >
                View on GitHub <span style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 11, marginLeft: 2 }}>↗</span>
              </a>
            </div>
            {row.license_spdx && (
              <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--ink-3)" }}>
                License: {row.license_spdx}
              </p>
            )}
          </section>
        </div>

        {/* Right rail */}
        <aside className="dp-right">
          {/* Install card */}
          <InstallCard installCommand={cmd} />

          {/* Source card */}
          <aside className="dp-source-card">
            <div className="hdr">
              <span
                className="lp-avatar"
                style={{ width: 40, height: 40, fontSize: 17 }}
              >
                {pub.initials}
              </span>
              <div className="who">
                <div className="name">{pub.name}</div>
                {pub.role && <div className="role">{pub.role}</div>}
              </div>
            </div>
            <dl className="meta">
              <div className="row">
                <dt>repository</dt>
                <dd className="v link">{repoPath}</dd>
              </div>
              {signal && signal.stars > 0 && (
                <div className="row">
                  <dt>stars on repo</dt>
                  <dd className="v">{fmtCount(signal.stars)}</dd>
                </div>
              )}
              <div className="group-sep" aria-hidden="true" />
              {signal && signal.install_count_estimate > 0 && (
                <div className="row">
                  <dt>installs</dt>
                  <dd className="v">{fmtCount(signal.install_count_estimate)}</dd>
                </div>
              )}
              <div className="row">
                <dt>added</dt>
                <dd className="v">{fmtDateShort(row.created_at)}</dd>
              </div>
              <div className="row">
                <dt>last indexed</dt>
                <dd className="v">{fmtDateShort(row.last_indexed_at)}</dd>
              </div>
            </dl>
            <div className="actions">
              <Link href={`/publishers/${owner}`}>
                view full profile →
              </Link>
            </div>
          </aside>

          {/* Other skills by this publisher */}
          {others.length > 0 && (
            <aside className="dp-other-skills">
              <div className="head">
                <h3>More from {pub.name.split(" ")[0]}</h3>
                <Link className="see-all" href={`/publishers/${owner}`}>
                  all →
                </Link>
              </div>
              <ul className="rows">
                {others.map((s) => (
                  <li key={s.id}>
                    <Link className="row" href={`/skills/${s.slug}`}>
                      <span className="t">{s.skill_name}</span>
                      {s.skill_signal && s.skill_signal.install_count_estimate > 0 && (
                        <span className="m">
                          ↓ {fmtCount(s.skill_signal.install_count_estimate)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </aside>
      </div>

      <Footer stats={stats} />
    </div>
  );
}
