"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export type IndexLeaf = {
  href: string;
  label: string;
  dot?: "live" | "soon"; // intro leaves have no dot; cases do
};

export type IndexGroup = {
  title: string;
  count: number;
  leaves: IndexLeaf[];
};

// The persistent left index: ALL material visible at once, grouped by topic,
// with a search box that filters and the active item highlighted. Shared chrome
// across every /playbook route.
export function PlaybookIndex({ groups }: { groups: IndexGroup[] }) {
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const filtered = groups
    .map((g) => ({
      ...g,
      leaves: query
        ? g.leaves.filter((l) => l.label.toLowerCase().includes(query))
        : g.leaves,
    }))
    .filter((g) => g.leaves.length > 0);

  return (
    <aside className="pb-sidebar" aria-label="Playbook index">
      <div className="pb-idxtitle">The Playbook</div>
      <div className="pb-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search all topics"
          aria-label="Search the Playbook"
        />
      </div>

      {filtered.map((g) => (
        <div className="pb-group" key={g.title}>
          <div className="pb-grouptitle">
            <span>{g.title}</span>
            <span className="n">{g.count}</span>
          </div>
          {g.leaves.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`pb-leaf${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {l.dot && <span className={`pb-dot${l.dot === "soon" ? " soon" : ""}`} />}
                {l.label}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
