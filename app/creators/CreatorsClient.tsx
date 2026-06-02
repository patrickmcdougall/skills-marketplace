"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PUBLISHERS, fmtCount } from "@/lib/data";
import type { DBPublisherRow } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

// ─── types ──────────────────────────────────────────────────────────────────

type EnrichedRow = DBPublisherRow & {
  name: string;
  initials: string;
  role: string;
};

const SORT_OPTIONS = [
  { id: "installs", label: "Most installed" },
  { id: "skillCount", label: "Most skills" },
  { id: "ghStars", label: "GitHub stars" },
  { id: "az", label: "A–Z" },
] as const;

type SortKey = "installs" | "skillCount" | "ghStars" | "az";

const TABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "skillCount", label: "Skills" },
  { key: "installs", label: "Installs" },
  { key: "ghStars", label: "GH ★" },
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
          placeholder="name or handle"
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

export function CreatorsClient({ rawRows }: { rawRows: DBPublisherRow[] }) {
  const router = useRouter();

  const allRows = useMemo<EnrichedRow[]>(() =>
    rawRows.map((r) => {
      const cat = PUBLISHERS[r.handle];
      return {
        ...r,
        name: cat?.name ?? r.handle,
        initials: cat?.initials ?? r.handle.slice(0, 2).toUpperCase(),
        role: cat?.role ?? "",
      };
    }),
    [rawRows]
  );

  const stats = useMemo(() => ({
    skills: rawRows.reduce((a, r) => a + r.skillCount, 0),
    publishers: rawRows.length,
    weekly: 6,
    installs: fmtCount(rawRows.reduce((a, r) => a + r.installs, 0)),
  }), [rawRows]);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("installs");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    let r = sortRows(allRows, sortKey, sortDir);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter((row) => {
        const hay = (row.name + " @" + row.handle + " " + row.role).toLowerCase();
        return hay.includes(q);
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
                          style={{ width: 36, height: 36, fontSize: Math.round(36 * 0.42) }}
                        >
                          {r.initials}
                        </span>
                        <div className="who">
                          <span className="name">{r.name}</span>
                          <span className="role">{r.role}</span>
                        </div>
                      </div>
                    </td>
                    <td className="num" data-label="Skills">{r.skillCount}</td>
                    <td className="num" data-label="Installs">{fmtCount(r.installs)}</td>
                    <td className="num dim" data-label="GH ★">{fmtCount(r.ghStars)}</td>
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
