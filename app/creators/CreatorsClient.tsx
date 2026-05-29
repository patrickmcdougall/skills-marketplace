"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  SHELVES,
  PUBLISHERS,
  fmtCount,
} from "@/lib/data";
import type { DBPublisherRow } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

// ─── helpers ──────────────────────────────────────────────────────────────

// Enriched row — raw DBPublisherRow plus catalog name/initials/role.
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

function sortRows(
  rows: EnrichedRow[],
  sortKey: SortKey,
  sortDir: "asc" | "desc"
): EnrichedRow[] {
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

// ─── page ──────────────────────────────────────────────────────────────────

export function CreatorsClient({ rawRows }: { rawRows: DBPublisherRow[] }) {
  const router = useRouter();

  // Enrich with catalog data on the client (PUBLISHERS is a static bundle import).
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

  const [activeShelves, setActiveShelves] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("installs");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // shelfCounts: DB rows don't have shelfIds yet (category=null), so all chips
  // will show 0 counts and be disabled until category is populated.
  const shelfCounts: Record<string, number> = {};

  const rows = useMemo(() => sortRows(allRows, sortKey, sortDir),
    [allRows, sortKey, sortDir]
  );

  const toggleShelf = (id: string) => {
    setActiveShelves((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );
  };

  const headerSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <div className="lp bg-cream">
      <Nav stats={stats} />

      <div className="pl-page">
        <header className="bp-head">
          <h1>Creators</h1>
        </header>

        {/* Toolbar: shelf filter chips */}
        <div className="pl-toolbar">
          <div className="pl-filter-row">
            <button
              className={`pl-filter-chip all-chip${
                activeShelves.length === 0 ? " is-active" : ""
              }`}
              onClick={() => setActiveShelves([])}
            >
              All
            </button>
            {SHELVES.map((sh) => {
              const c = shelfCounts[sh.id] || 0;
              const active = activeShelves.includes(sh.id);
              return (
                <button
                  key={sh.id}
                  className={`pl-filter-chip${active ? " is-active" : ""}`}
                  onClick={() => (c > 0 || active) && toggleShelf(sh.id)}
                  disabled={c === 0 && !active}
                >
                  {sh.title}
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: "10px",
                      opacity: 0.6,
                      marginLeft: 2,
                    }}
                  >
                    {c}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Count + sort */}
          <div className="pl-count-row">
            <p className="pl-count">
              <span className="n">{rows.length}</span>
              {rows.length === allRows.length ? (
                " creators"
              ) : (
                <>
                  {" of "}
                  <span className="n">{allRows.length}</span>
                  {" creators"}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <div className="bp-empty">
            <h3>No creators match this filter.</h3>
            <p>Try removing a shelf, or view all creators.</p>
            <div className="actions">
              <button
                className="lp-btn"
                onClick={() => setActiveShelves([])}
              >
                Clear filters
              </button>
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
                    className={`num sortable${
                      sortKey === c.key ? " is-sorted" : ""
                    }`}
                    onClick={() => headerSort(c.key)}
                  >
                    {c.label}
                    {sortKey === c.key && (
                      <span className="arrow">
                        {sortDir === "desc" ? "▼" : "▲"}
                      </span>
                    )}
                  </th>
                ))}
                <th className="pl-arrow-cell" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.handle}
                  onClick={() => router.push(`/creators/${r.handle}`)}
                >
                  <td>
                    <div className="pl-pub">
                      <span
                        className="lp-avatar"
                        style={{
                          width: 36,
                          height: 36,
                          fontSize: Math.round(36 * 0.42),
                        }}
                      >
                        {r.initials}
                      </span>
                      <div className="who">
                        <span className="name">{r.name}</span>
                        <span className="role">{r.role}</span>
                      </div>
                    </div>
                  </td>
                  <td className="num" data-label="Skills">
                    {r.skillCount}
                  </td>
                  <td className="num" data-label="Installs">
                    {fmtCount(r.installs)}
                  </td>
                  <td className="num dim" data-label="GH ★">
                    {fmtCount(r.ghStars)}
                  </td>
                  <td>{/* shelves — available once category is populated */}</td>
                  <td className="pl-arrow-cell">→</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Footer stats={stats} />
    </div>
  );
}
