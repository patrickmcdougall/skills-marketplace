"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export type IndexLeaf = {
  href: string;
  label: string;
  dot?: "live" | "soon"; // guide leaves have no dot; cases do
};

export type IndexSubgroup = {
  title: string;
  leaves: IndexLeaf[];
};

export type IndexGroup = {
  title: string;
  count: number;
  leaves: IndexLeaf[];
  /** Optional nested level — e.g. Examples → one subgroup per theme. */
  subgroups?: IndexSubgroup[];
};

// The persistent left index: ALL material visible at once, grouped by topic,
// with a search box that filters and the active item highlighted. Shared chrome
// across every /manual route. Two levels: groups, and (for Examples) theme
// subgroups nested inside one group.
export function ManualIndex({ groups }: { groups: IndexGroup[] }) {
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const matches = (l: IndexLeaf) => !query || l.label.toLowerCase().includes(query);

  const filtered = groups
    .map((g) => ({
      ...g,
      leaves: g.leaves.filter(matches),
      subgroups: (g.subgroups ?? [])
        .map((s) => ({ ...s, leaves: s.leaves.filter(matches) }))
        .filter((s) => s.leaves.length > 0),
    }))
    .filter((g) => g.leaves.length > 0 || g.subgroups.length > 0);

  const renderLeaf = (l: IndexLeaf, sub = false) => {
    const active = pathname === l.href;
    return (
      <Link
        key={l.href}
        href={l.href}
        className={`mn-leaf${sub ? " sub" : ""}${active ? " active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        {l.dot && <span className={`mn-dot${l.dot === "soon" ? " soon" : ""}`} />}
        {l.label}
      </Link>
    );
  };

  return (
    <aside className="mn-sidebar" aria-label="Manual index">
      <div className="mn-idxtitle">The Manual</div>
      <div className="mn-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search all topics"
          aria-label="Search the Manual"
        />
      </div>

      {filtered.map((g) => (
        <div className="mn-group" key={g.title}>
          <div className="mn-grouptitle">
            <span>{g.title}</span>
            <span className="n">{g.count}</span>
          </div>
          {g.leaves.map((l) => renderLeaf(l))}
          {g.subgroups.map((s) => (
            <div className="mn-subgroup" key={s.title}>
              <div className="mn-subtitle">{s.title}</div>
              {s.leaves.map((l) => renderLeaf(l, true))}
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}
