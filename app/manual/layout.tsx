import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { REAL_STATS } from "@/lib/data";
import { ManualIndex, type IndexGroup } from "@/components/manual/ManualIndex";
import { START_PAGES, FEATURES, SKILLS_PAGES, casesByShelf, visibleCases, MANUAL_ENABLED, SHOW_WIP } from "@/lib/manual";

// The Manual's left index is shared chrome across every /manual route — so it
// lives in the layout, rendered once and persisted on client-side navigation.
// Four parts: Getting started · Cowork features · Skills · Examples (with the
// catalogue shelves nested one level down as theme subgroups).
function buildIndexGroups(): IndexGroup[] {
  const start: IndexGroup = {
    title: "Getting started",
    count: START_PAGES.length,
    leaves: START_PAGES.map((p) => ({
      href: `/manual/start/${p.topic}`,
      label: p.navLabel,
    })),
  };

  const features: IndexGroup = {
    title: "Cowork features",
    count: FEATURES.length,
    leaves: [
      { href: "/manual/features", label: "At a glance" },
      // Per-feature guides are WIP: listed in dev/preview, absent in prod
      // until each is finished (see SHOW_WIP).
      ...(SHOW_WIP
        ? FEATURES.map((f) => ({
            href: `/manual/features/${f.slug}`,
            label: f.name,
            dot: "soon" as const,
          }))
        : []),
    ],
  };

  const skills: IndexGroup = {
    title: "Skills",
    count: SKILLS_PAGES.length,
    leaves: SKILLS_PAGES.map((p) => ({
      href: `/manual/skills/${p.topic}`,
      label: p.navLabel,
    })),
  };

  const visible = new Set(visibleCases().map((c) => c.slug));
  const byShelf = casesByShelf()
    .map((g) => ({ ...g, cases: g.cases.filter((c) => visible.has(c.slug)) }))
    .filter((g) => g.cases.length > 0);
  const examples: IndexGroup = {
    title: "Examples",
    count: byShelf.reduce((n, g) => n + g.cases.length, 0),
    leaves: [],
    subgroups: byShelf.map((g) => ({
      title: g.title,
      leaves: g.cases.map((p) => ({
        href: `/manual/${p.slug}`,
        label: p.navLabel,
        dot: p.status === "live" ? ("live" as const) : ("soon" as const),
      })),
    })),
  };

  return [start, features, skills, examples];
}

export default function ManualLayout({ children }: { children: React.ReactNode }) {
  // WIP: hidden in production until launch (see MANUAL_ENABLED).
  if (!MANUAL_ENABLED) notFound();

  const groups = buildIndexGroups();

  return (
    <div className="lp accent-orange bg-cream">
      <Nav stats={REAL_STATS} />
      <div className="mn-shell">
        <ManualIndex groups={groups} />
        <main className="mn-content">{children}</main>
      </div>
      <Footer stats={REAL_STATS} />
    </div>
  );
}
