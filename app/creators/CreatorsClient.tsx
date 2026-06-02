"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PUBLISHERS, fmtCount } from "@/lib/data";
import type { DBPublisherRow, PublisherProfile } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

// ─── types ──────────────────────────────────────────────────────────────────

type EnrichedRow = DBPublisherRow & {
  name: string;
  initials: string;
  role: string;
  avatarUrl: string | null;
  location: string | null;
  bio: string | null;
  twitterHandle: string | null;
  blog: string | null;
};

const SORT_OPTIONS = [
  { id: "installs", label: "Most installed" },
  { id: "skillCount", label: "Most skills" },
  { id: "ghStars", label: "GitHub stars" },
  { id: "az", label: "A–Z" },
] as const;

type SortKey = "installs" | "skillCount" | "ghStars" | "az";

const TABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "ghStars", label: "GH ★" },
  { key: "skillCount", label: "Skills" },
  { key: "installs", label: "Installs" },
];

function sortRows(rows: EnrichedRow[], sortKey: SortKey, sortDir: "asc" | "desc"): EnrichedRow[] {
  if (sortKey === "az") {
    const r = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    return sortDir === "desc" ? r.reverse() : r;
  }
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const d = (a[sortKey] - b[sortKey]) * dir;
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
}

function cleanLocation(loc: string | null): string | null {
  if (!loc) return null;
  // Strip US zip codes (e.g. "Berkeley, CA 94703" → "Berkeley, CA")
  return loc.replace(/,?\s*\d{5}(-\d{4})?(?=\s*$)/, "").trim() || null;
}

function creatorRole(cat: ReturnType<typeof Object.values<(typeof PUBLISHERS)[string]>>[number] | undefined, profile: PublisherProfile | undefined): string {
  if (cat?.role) return cat.role;
  if (profile?.company) return profile.company;
  if (profile?.bio) {
    const sentence = profile.bio.split(/[.!?\n]/)[0].trim();
    if (sentence.length <= 70) return sentence;
  }
  return "GitHub creator";
}

// ─── sidebar ────────────────────────────────────────────────────────────────

function FilterSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="bp-fsection">
      <h3><span>Search</span></h3>
      <div className="bp-search">
        <span className="icon">/</span>
        <label htmlFor="pl-creator-q" className="sr-only">Search creators</label>
        <input
          id="pl-creator-q"
          placeholder="name, handle, or company"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
        />
      </div>
    </div>
  );
}

function FilterSort({
  value,
  sortDir,
  onChange,
  onDirToggle,
}: {
  value: SortKey;
  sortDir: "asc" | "desc";
  onChange: (k: SortKey) => void;
  onDirToggle: () => void;
}) {
  return (
    <div className="bp-fsection">
      <h3><span>Sort</span></h3>
      <ul className="bp-check-list">
        {SORT_OPTIONS.map((opt) => (
          <li key={opt.id}>
            <button
              className={`bp-check${value === opt.id ? " is-active" : ""}`}
              onClick={() => onChange(opt.id as SortKey)}
            >
              <span>{opt.label}</span>
              {value === opt.id && (
                <span
                  className="num"
                  style={{ cursor: "pointer" }}
                  onClick={(e) => { e.stopPropagation(); onDirToggle(); }}
                >
                  {sortDir === "desc" ? "▼" : "▲"}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── top bar ─────────────────────────────────────────────────────────────────

function CreatorsTopBar({ count, total }: { count: number; total: number }) {
  return (
    <div className="bp-topbar">
      <div className="count">
        <span className="n">{count}</span>
        {count === total ? " creators" : (
          <> of <span className="n">{total}</span> creators</>
        )}
      </div>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export function CreatorsClient({
  rawRows,
  profiles,
}: {
  rawRows: DBPublisherRow[];
  profiles: Record<string, PublisherProfile>;
}) {
  const router = useRouter();

  const allRows = useMemo<EnrichedRow[]>(() =>
    rawRows.map((r) => {
      const cat = PUBLISHERS[r.handle];
      const profile = profiles[r.handle.toLowerCase()];
      return {
        ...r,
        name: profile?.displayName ?? cat?.name ?? r.handle,
        initials: (profile?.displayName ?? cat?.initials ?? r.handle).slice(0, 2).toUpperCase(),
        role: creatorRole(cat, profile),
        avatarUrl: profile?.avatarUrl ?? null,
        location: cleanLocation(profile?.location ?? null),
        bio: profile?.bio ?? null,
        twitterHandle: profile?.twitterUsername ?? null,
        blog: profile?.blog ?? null,
      };
    }),
    [rawRows, profiles]
  );

  const stats = useMemo(() => ({
    skills: rawRows.reduce((a, r) => a + r.skillCount, 0),
    publishers: rawRows.length,
    weekly: 6,
    installs: fmtCount(rawRows.reduce((a, r) => a + r.installs, 0)),
  }), [rawRows]);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ghStars");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    let r = sortRows(allRows, sortKey, sortDir);
    if (query.trim()) {
      const lower = query.toLowerCase().replace(/-/g, " ");
      const lowerCompact = query.toLowerCase().replace(/[\s-]/g, "");
      r = r.filter((row) => {
        const parts = [row.name, row.handle, row.role, row.location ?? "", row.bio ?? ""];
        const hay = parts.join(" ").toLowerCase().replace(/-/g, " ");
        const hayCompact = parts.join("").toLowerCase().replace(/[\s-]/g, "");
        return hay.includes(lower) || hayCompact.includes(lowerCompact);
      });
    }
    return r;
  }, [allRows, sortKey, sortDir, query]);

  const changeSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  return (
    <div className="lp bp accent-orange bg-cream">
      <Nav stats={stats} />

      <header className="bp-head bp-page">
        <h1>Creators</h1>
      </header>

      <div className="bp-shell bp-page">
        <aside className="bp-aside">
          <FilterSearch value={query} onChange={setQuery} />
          <FilterSort
            value={sortKey}
            sortDir={sortDir}
            onChange={changeSort}
            onDirToggle={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          />
        </aside>

        <div className="bp-main">
          <CreatorsTopBar count={rows.length} total={allRows.length} />

          {rows.length === 0 ? (
            <div className="bp-empty">
              <h3>No creators match &ldquo;{query}&rdquo;.</h3>
              <p>Try a different search term.</p>
              <div className="actions">
                <button className="lp-btn" onClick={() => setQuery("")}>Clear search</button>
              </div>
            </div>
          ) : (
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Creator</th>
                  {TABLE_COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      className={`num sortable${sortKey === c.key ? " is-sorted" : ""}`}
                      onClick={() => changeSort(c.key)}
                    >
                      {c.label}
                      {sortKey === c.key && (
                        <span className="arrow">{sortDir === "desc" ? "▼" : "▲"}</span>
                      )}
                    </th>
                  ))}
                  <th className="pl-arrow-cell" aria-hidden="true"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.handle} onClick={() => router.push(`/creators/${r.handle}`)}>
                    <td>
                      <div className="pl-pub">
                        <span
                          className="lp-avatar"
                          style={{ width: 36, height: 36, fontSize: Math.round(36 * 0.42), overflow: "hidden", padding: 0, flexShrink: 0 }}
                        >
                          {r.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.avatarUrl} alt={r.name} width={36} height={36} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            r.initials
                          )}
                        </span>
                        <div className="who">
                          <span className="name">{r.name}</span>
                          <span className="role">
                            {r.role}
                            {r.location && (
                              <span className="pl-location"> · {r.location}</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="num dim" data-label="GH ★">{fmtCount(r.ghStars)}</td>
                    <td className="num" data-label="Skills">{r.skillCount}</td>
                    <td className="num" data-label="Installs">{r.installs > 0 ? fmtCount(r.installs) : "—"}</td>
                    <td className="pl-arrow-cell">→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Footer stats={stats} />
    </div>
  );
}
