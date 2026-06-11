"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  SHELVES,
  SHELF_SUB_SHELVES,
  SORT_OPTIONS,
  PUBLISHERS,
  sortSkills,
  applyFilters,
  publisherListForCurrent,
  shelfLabel,
  genShelfId,
  fmtCount,
  type BrowseFilters,
  type Skill,
} from "@/lib/data";
import type { BrowseSkill } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SkillCard } from "@/components/SkillCard";
import type { SkillTrustStatus } from "@/lib/trust";

const PAGE_SIZE = 12;

// ─── sidebar: shelf filter ──────────────────────────────────────────────────

export function FilterShelf({
  value,
  onToggle,
  onClear,
  counts,
  subShelf,
  onSubShelf,
  subShelfCounts,
}: {
  value: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  counts: Record<string, number>;
  subShelf: string | null;
  onSubShelf: (val: string | null) => void;
  subShelfCounts: Record<string, number>;
}) {
  return (
    <div className="bp-fsection">
      <h3>
        <span>Shelf</span>
        {value.length > 0 && <button onClick={onClear}>clear</button>}
      </h3>
      <ul className="bp-check-list">
        {SHELVES.map((sh) => {
          const c = counts[sh.id] || 0;
          const active = value.includes(sh.id);
          // Sub-shelves nest under their parent shelf, and only when exactly
          // one shelf is selected (sub-shelf filtering is single-shelf scoped).
          const subs =
            active && value.length === 1 ? SHELF_SUB_SHELVES[sh.id] || [] : [];
          return (
            <li key={sh.id}>
              <button
                className={`bp-check${active ? " is-active" : ""}${
                  c === 0 && !active ? " is-disabled" : ""
                }`}
                onClick={() => (c > 0 || active) && onToggle(sh.id)}
                disabled={c === 0 && !active}
              >
                <span>{sh.title}</span>
                <span className="num">{c}</span>
              </button>
              {subs.length > 0 && (
                <ul className="bp-radio-list bp-subshelf bp-subshelf-nested">
                  {subs.map((s) => (
                    <li key={s}>
                      <button
                        className={`bp-radio${subShelf === s ? " is-active" : ""}`}
                        onClick={() => onSubShelf(subShelf === s ? null : s)}
                      >
                        <span>{s}</span>
                        <span className="num">{subShelfCounts[s] || 0}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── sidebar: publisher filter ──────────────────────────────────────────────

function FilterPublisher({
  list,
  value,
  onToggle,
  onClear,
}: {
  list: { handle: string; count: number }[];
  value: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = q
    ? list.filter((p) => {
        const pub = PUBLISHERS[p.handle];
        const name = pub?.name ?? p.handle;
        const hay = (name + " @" + p.handle).toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : list;

  return (
    <div className="bp-fsection">
      <h3>
        <span>Creator</span>
        {value.length > 0 && <button onClick={onClear}>clear</button>}
      </h3>
      {list.length > 6 && (
        <div className="bp-search">
          <span className="icon">/</span>
          <label htmlFor="bp-creator-q" className="sr-only">Search creators</label>
          <input
            id="bp-creator-q"
            placeholder="search creators"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}
      <div className="bp-publist">
        {filtered.map(({ handle, count }) => {
          const p = PUBLISHERS[handle];
          const name = p?.name ?? handle;
          const initials = p?.initials ?? handle.slice(0, 2).toUpperCase();
          const active = value.includes(handle);
          return (
            <button
              key={handle}
              className={`bp-pubrow${active ? " is-active" : ""}`}
              onClick={() => onToggle(handle)}
            >
              <span
                className="lp-avatar"
                style={{ width: 20, height: 20, fontSize: 9 }}
              >
                {initials}
              </span>
              <span className="name">{name}</span>
              <span className="num">{count}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p
            style={{
              fontSize: 12,
              color: "var(--ink-3)",
              margin: "8px 0",
              textAlign: "left",
            }}
          >
            No creators match &ldquo;{q}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── top bar ────────────────────────────────────────────────────────────────

function BrowseTopBar({
  count,
  total,
  sort,
  onSort,
}: {
  count: number;
  total: number;
  sort: string;
  onSort: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((s) => s.id === sort) || SORT_OPTIONS[0];
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="bp-topbar">
      <div className="count">
        <span className="n">{count}</span>
        {count === total ? (
          " skills"
        ) : (
          <>
            {" "}
            of <span className="n">{total}</span> skills
          </>
        )}
      </div>
      <div className="right">
        <div className="bp-sort" ref={sortRef}>
          <button
            className="bp-sort-btn"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="lbl-k">sort:</span>
            <span className="v">{current.label}</span>
            <span className="caret">▾</span>
          </button>
          {open && (
            <div className="bp-sort-menu">
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  className={s.id === sort ? "is-active" : ""}
                  onClick={() => {
                    onSort(s.id);
                    setOpen(false);
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── active filter chips ─────────────────────────────────────────────────────

function ActiveChips({
  filters,
  query,
  onRemove,
  onClear,
  onClearQuery,
}: {
  filters: BrowseFilters;
  query: string;
  onRemove: (k: string, val?: string) => void;
  onClear: () => void;
  onClearQuery: () => void;
}) {
  const chips: { k: string; label: string; remove: () => void }[] = [];
  if (query.trim()) {
    chips.push({ k: "search", label: `"${query}"`, remove: onClearQuery });
  }
  for (const sh of filters.shelves || []) {
    chips.push({
      k: "shelf",
      label: shelfLabel(sh),
      remove: () => onRemove("shelf", sh),
    });
  }
  if (filters.subShelf) {
    chips.push({
      k: "sub",
      label: filters.subShelf,
      remove: () => onRemove("subShelf"),
    });
  }
  for (const h of filters.publishers || []) {
    const p = PUBLISHERS[h];
    chips.push({
      k: "by",
      label: p ? p.name : h,
      remove: () => onRemove("publisher", h),
    });
  }
  if (chips.length === 0) return null;
  return (
    <div className="bp-chips">
      {chips.map((c, i) => (
        <span className="bp-chip" key={i}>
          <span className="k">{c.k}</span>
          <span>{c.label}</span>
          <button
            className="x"
            onClick={c.remove}
            aria-label={`Remove ${c.k} ${c.label}`}
          >
            ×
          </button>
        </span>
      ))}
      {chips.length >= 2 && (
        <button className="clear" onClick={onClear}>
          Clear all
        </button>
      )}
    </div>
  );
}

// ─── empty state ─────────────────────────────────────────────────────────────

function BrowseEmpty() {
  return (
    <div className="bp-empty">
      <h3>Nothing in that combination yet.</h3>
      <p>Try a different filter, or see everything.</p>
      <div className="actions">
        <Link href="/skills" className="lp-btn">
          Browse all skills
        </Link>
      </div>
    </div>
  );
}

// ─── main browse page ─────────────────────────────────────────────────────────

// Map a BrowseSkill to the Skill shape that existing filter/sort/card logic expects.
function toSkill(s: BrowseSkill, publisherNames: Record<string, string>): Skill {
  // Prefer generated COPY only when content_status is 'ok'; use the generated
  // shelf/tags for classification whenever present (ok or review).
  const ok = s.contentStatus === "ok";
  const sid = genShelfId(s.genShelf);
  return {
    id: s.slug,
    title: ok && s.displayTitle ? s.displayTitle : s.title,
    desc: ok && s.displayDescription ? s.displayDescription : s.desc,
    publisher: s.ownerHandle,
    publisherDisplayName: publisherNames[s.ownerHandle],
    installs: s.installs,
    stars: s.stars,
    verifiedDate: s.verifiedDate,
    version: "",
    shelfTitle: s.genShelf ? shelfLabel(sid) : (s.category ?? ""),
    shelfId: s.genShelf ? sid : (s.category?.toLowerCase().replace(/\s+/g, "-") ?? ""),
    subShelf: s.subShelf ?? undefined,
    tags: [...(s.genTags && s.genTags.length ? s.genTags : s.topics), s.repoName],
  };
}

const compact = (s: string) => s.toLowerCase().replace(/[\s-]/g, "");

function searchSkills(skills: Skill[], q: string): Skill[] {
  if (!q.trim()) return skills;
  const lower = q.toLowerCase().replace(/-/g, " ");
  const lowerCompact = compact(q);
  return skills.filter((s) => {
    const pub = PUBLISHERS[s.publisher];
    const parts = [s.title, s.desc, pub?.name ?? s.publisher, s.shelfTitle, s.subShelf ?? "", ...(s.tags ?? [])];
    const hay = parts.join(" ").toLowerCase().replace(/-/g, " ");
    const hayCompact = parts.join(" ").toLowerCase().replace(/[\s-]/g, "");
    return hay.includes(lower) || hayCompact.includes(lowerCompact);
  });
}

function BrowsePageInner({ initialSkills, publisherNames, trustMap }: { initialSkills: BrowseSkill[]; publisherNames: Record<string, string>; trustMap?: Record<string, SkillTrustStatus> }) {
  const allSkills = useMemo(() => initialSkills.map(s => toSkill(s, publisherNames)), [initialSkills, publisherNames]);
  const stats = useMemo(() => ({
    skills: initialSkills.length,
    creators: new Set(initialSkills.map((s) => s.ownerHandle)).size,
    weekly: 6,
    installs: fmtCount(initialSkills.reduce((a, s) => a + s.installs, 0)),
  }), [initialSkills]);
  const searchParams = useSearchParams();

  // Initialise from URL params so /search?q=... and /skills?sort=... work.
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [filters, setFilters] = useState<BrowseFilters>({
    shelves: [],
    subShelf: null,
    publishers: [],
  });
  const [sort, setSort] = useState(() => {
    const s = searchParams.get("sort");
    return s && SORT_OPTIONS.find((o) => o.id === s) ? s : "installs";
  });

  useEffect(() => {
    const s = searchParams.get("sort");
    if (s && SORT_OPTIONS.find((o) => o.id === s)) setSort(s);
  }, [searchParams]);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(
    () => searchSkills(sortSkills(applyFilters(allSkills, filters), sort), query),
    [filters, sort, query]
  );

  const shelfCounts = useMemo(() => {
    const base = applyFilters(allSkills, {
      ...filters,
      shelves: [],
      subShelf: null,
    });
    const counts: Record<string, number> = {};
    for (const s of base) counts[s.shelfId] = (counts[s.shelfId] || 0) + 1;
    return counts;
  }, [filters]);

  const subShelfCounts = useMemo(() => {
    if (!filters.shelves || filters.shelves.length !== 1) return {};
    const base = applyFilters(allSkills, { ...filters, subShelf: null });
    const counts: Record<string, number> = {};
    for (const s of base) if (s.subShelf) counts[s.subShelf] = (counts[s.subShelf] || 0) + 1;
    return counts;
  }, [filters]);

  const publisherList = useMemo(() => {
    const base = applyFilters(allSkills, { ...filters, publishers: [] });
    return publisherListForCurrent(base);
  }, [filters]);

  const toggleShelf = (id: string) => {
    setFilters((f) => {
      const next = f.shelves.includes(id)
        ? f.shelves.filter((x) => x !== id)
        : [...f.shelves, id];
      return {
        ...f,
        shelves: next,
        subShelf: next.length === 1 ? f.subShelf : null,
      };
    });
    setVisible(PAGE_SIZE);
  };
  const clearShelves = () => {
    setFilters((f) => ({ ...f, shelves: [], subShelf: null }));
    setVisible(PAGE_SIZE);
  };
  const setSubShelf = (id: string | null) => {
    setFilters((f) => ({ ...f, subShelf: id }));
    setVisible(PAGE_SIZE);
  };
  const togglePublisher = (id: string) => {
    setFilters((f) => ({
      ...f,
      publishers: f.publishers.includes(id)
        ? f.publishers.filter((x) => x !== id)
        : [...f.publishers, id],
    }));
    setVisible(PAGE_SIZE);
  };
  const clearPublishers = () => {
    setFilters((f) => ({ ...f, publishers: [] }));
    setVisible(PAGE_SIZE);
  };
  const removeChip = (k: string, val?: string) => {
    setFilters((f) => {
      const next = { ...f };
      if (k === "shelf" && val) {
        next.shelves = f.shelves.filter((x) => x !== val);
        if (next.shelves.length !== 1) next.subShelf = null;
      } else if (k === "subShelf") {
        next.subShelf = null;
      } else if (k === "publisher" && val) {
        next.publishers = f.publishers.filter((x) => x !== val);
      }
      return next;
    });
    setVisible(PAGE_SIZE);
  };
  const clearAll = () => {
    setFilters({ shelves: [], subShelf: null, publishers: [] });
    setQuery("");
    setVisible(PAGE_SIZE);
  };

  const visibleSet = filtered.slice(0, visible);

  return (
    <div className="lp bp accent-orange bg-cream">
      <Nav stats={stats} />

      <header className="bp-head bp-page">
        <h1>Browse</h1>
        <div className="bp-search" style={{ marginTop: 16, maxWidth: 480 }}>
          <span className="icon">⌕</span>
          <label htmlFor="bp-search-q" className="sr-only">Search skills</label>
          <input
            id="bp-search-q"
            placeholder="Search skills, creators, topics…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setVisible(PAGE_SIZE); }}
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setVisible(PAGE_SIZE); }}
              className="bp-search-clear"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      </header>

      <div className="bp-shell bp-page">
        <aside className="bp-aside">
          <FilterShelf
            value={filters.shelves}
            onToggle={toggleShelf}
            onClear={clearShelves}
            counts={shelfCounts}
            subShelf={filters.subShelf}
            onSubShelf={setSubShelf}
            subShelfCounts={subShelfCounts}
          />
          <FilterPublisher
            list={publisherList}
            value={filters.publishers}
            onToggle={togglePublisher}
            onClear={clearPublishers}
          />
        </aside>

        <div className="bp-main">
          <BrowseTopBar
            count={filtered.length}
            total={allSkills.length}
            sort={sort}
            onSort={setSort}
          />
          <ActiveChips
            filters={filters}
            query={query}
            onRemove={removeChip}
            onClear={clearAll}
            onClearQuery={() => { setQuery(""); setVisible(PAGE_SIZE); }}
          />

          {filtered.length === 0 ? (
            <BrowseEmpty />
          ) : (
            <>
              <div className="bp-grid">
                {visibleSet.map((s) => (
                  <SkillCard key={s.id} skill={s} context="browse" trust={trustMap?.[s.id]} />
                ))}
              </div>
              {filtered.length > visible && (
                <button
                  className="bp-loadmore"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                >
                  Load {Math.min(PAGE_SIZE, filtered.length - visible)} more
                  <span className="ct">
                    ({filtered.length - visible} remaining)
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <Footer stats={stats} />
    </div>
  );
}

export function BrowseClient({ initialSkills, publisherNames, trustMap }: { initialSkills: BrowseSkill[]; publisherNames: Record<string, string>; trustMap?: Record<string, SkillTrustStatus> }) {
  return (
    <Suspense>
      <BrowsePageInner initialSkills={initialSkills} publisherNames={publisherNames} trustMap={trustMap} />
    </Suspense>
  );
}
