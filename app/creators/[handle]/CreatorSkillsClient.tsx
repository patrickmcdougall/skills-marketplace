"use client";

import { useState, useMemo } from "react";
import { SkillCard } from "@/components/SkillCard";
import { shelfLabel, genShelfId, type Skill } from "@/lib/data";
import type { RepoInfo } from "@/lib/db";

type RepoSection = {
  repoPath: string;
  info: RepoInfo | undefined;
  skills: Skill[];
};

type SortId = "installs" | "stars" | "newest";

const SORTS: { id: SortId; label: string }[] = [
  { id: "installs", label: "Most installed" },
  { id: "stars", label: "Most stars" },
  { id: "newest", label: "Newest" },
];

function sortSkills(skills: Skill[], sort: SortId): Skill[] {
  return [...skills].sort((a, b) => {
    if (sort === "installs") return b.installs - a.installs;
    if (sort === "stars") return b.stars - a.stars;
    return (b.verifiedDate || "").localeCompare(a.verifiedDate || "");
  });
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

export function CreatorSkillsClient({
  repoSections,
  totalSkills,
}: {
  repoSections: RepoSection[];
  totalSkills: number;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortId>("installs");
  const [activeShelf, setActiveShelf] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);

  const allSkills = useMemo(
    () => repoSections.flatMap((r) => r.skills),
    [repoSections]
  );

  const shelves = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of allSkills) {
      if (s.shelfId) counts.set(s.shelfId, (counts.get(s.shelfId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, label: shelfLabel(genShelfId(id)), count }));
  }, [allSkills]);

  const isFiltering = query.trim().length > 0 || activeShelf !== null || sort !== "installs";

  const filtered = useMemo(() => {
    let out = allSkills;
    if (activeShelf) out = out.filter((s) => s.shelfId === activeShelf);
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.desc.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    return sortSkills(out, sort);
  }, [allSkills, query, activeShelf, sort]);

  const currentSort = SORTS.find((s) => s.id === sort) ?? SORTS[0];

  const displayedCount = isFiltering ? filtered.length : totalSkills;

  return (
    <div className="bp-shell">
      {/* Sidebar */}
      <aside className="bp-aside">
        {shelves.length > 1 && (
          <div className="bp-fsection">
            <h3>
              <span>Shelf</span>
              {activeShelf && (
                <button onClick={() => setActiveShelf(null)}>clear</button>
              )}
            </h3>
            <ul className="bp-check-list">
              {shelves.map(({ id, label, count }) => (
                <li key={id}>
                  <button
                    className={`bp-check${activeShelf === id ? " is-active" : ""}`}
                    onClick={() => setActiveShelf(activeShelf === id ? null : id)}
                  >
                    <span>{label}</span>
                    <span className="num">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="bp-main">
        {/* Topbar: search + sort */}
        <div className="bp-topbar">
          <div className="pp-inline-search">
            <span className="icon">/</span>
            <input
              type="search"
              placeholder={`Search ${totalSkills} skills…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="pp-inline-search-clear" onClick={() => setQuery("")} aria-label="Clear">×</button>
            )}
          </div>

          <div className="right">
            {isFiltering && (
              <span className="count" style={{ marginRight: 12 }}>
                <span className="n">{displayedCount}</span>
                {displayedCount !== totalSkills && (
                  <> of <span className="n">{totalSkills}</span></>
                )}
                {" skills"}
              </span>
            )}
            <div className="bp-sort">
              <button
                className="bp-sort-btn"
                onClick={(e) => { e.stopPropagation(); setSortOpen((v) => !v); }}
              >
                <span className="lbl-k">sort:</span>
                <span className="v">{currentSort.label}</span>
                <span className="caret">▾</span>
              </button>
              {sortOpen && (
                <div className="bp-sort-menu" onClick={(e) => e.stopPropagation()}>
                  {SORTS.map((s) => (
                    <button
                      key={s.id}
                      className={s.id === sort ? "is-active" : ""}
                      onClick={() => { setSort(s.id); setSortOpen(false); }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        {isFiltering ? (
          filtered.length === 0 ? (
            <p className="bp-empty">No skills match &ldquo;{query}&rdquo;.</p>
          ) : (
            <div className="pp-grid">
              {filtered.map((s) => (
                <SkillCard key={s.id} skill={s} context="browse" trust="verified" />
              ))}
            </div>
          )
        ) : (
          repoSections.length === 1 ? (
            <>
              <RepoHead repoPath={repoSections[0].repoPath} info={repoSections[0].info} />
              <div className="pp-grid">
                {repoSections[0].skills.map((s) => (
                  <SkillCard key={s.id} skill={s} context="browse" trust="verified" />
                ))}
              </div>
            </>
          ) : (
            repoSections.map(({ repoPath, info, skills }) => (
              <section key={repoPath} className="pp-repo">
                <div className="pp-repo-head">
                  <div className="pp-repo-title">
                    <a href={`https://github.com/${repoPath}`} target="_blank" rel="noopener noreferrer" className="pp-repo-name">
                      {info?.name ?? repoPath.split("/")[1]}
                    </a>
                    {info?.stars != null && (
                      <span className="pp-repo-stars">{fmtCount(info.stars)} ★</span>
                    )}
                    <span className="pp-repo-count">{skills.length} {skills.length === 1 ? "skill" : "skills"}</span>
                  </div>
                  {info?.description && <p className="pp-repo-desc">{info.description}</p>}
                </div>
                <div className="pp-grid">
                  {skills.map((s) => (
                    <SkillCard key={s.id} skill={s} context="browse" trust="verified" />
                  ))}
                </div>
              </section>
            ))
          )
        )}
      </div>
    </div>
  );
}

function RepoHead({ repoPath, info }: { repoPath: string; info: RepoInfo | undefined }) {
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
  const repoName = info?.name ?? repoPath.split("/")[1];
  return (
    <div className="pp-repo-head" style={{ marginBottom: 24 }}>
      <div className="pp-repo-title">
        <a href={`https://github.com/${repoPath}`} target="_blank" rel="noopener noreferrer" className="pp-repo-name">
          {repoName}
        </a>
        {info?.stars != null && (
          <span className="pp-repo-stars">{fmtCount(info.stars)} ★</span>
        )}
      </div>
      {info?.description && <p className="pp-repo-desc">{info.description}</p>}
    </div>
  );
}
