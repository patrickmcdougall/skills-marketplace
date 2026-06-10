import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { REAL_STATS } from "@/lib/data";
import { PlaybookIndex, type IndexGroup } from "@/components/playbook/PlaybookIndex";
import { INTRO_PAGES, playsByShelf, PLAYBOOK_ENABLED } from "@/lib/playbook";

// The Playbook's left index is shared chrome across the index, intro pages, and
// every case — so it lives in the layout, rendered once and persisted on
// client-side navigation between routes.
function buildIndexGroups(): IndexGroup[] {
  const intro: IndexGroup = {
    title: "Intro to Cowork",
    count: INTRO_PAGES.length,
    leaves: INTRO_PAGES.map((p) => ({
      href: `/playbook/intro/${p.topic}`,
      label: p.navLabel,
    })),
  };

  const themes: IndexGroup[] = playsByShelf().map((g) => ({
    title: g.title,
    count: g.plays.length,
    leaves: g.plays.map((p) => ({
      href: `/playbook/${p.slug}`,
      label: p.navLabel,
      dot: p.status === "live" ? ("live" as const) : ("soon" as const),
    })),
  }));

  return [intro, ...themes];
}

export default function PlaybookLayout({ children }: { children: React.ReactNode }) {
  // WIP: hidden in production until launch (see PLAYBOOK_ENABLED).
  if (!PLAYBOOK_ENABLED) notFound();

  const groups = buildIndexGroups();

  return (
    <div className="lp accent-orange bg-cream">
      <Nav stats={REAL_STATS} />
      <div className="pb-shell">
        <PlaybookIndex groups={groups} />
        <main className="pb-content">{children}</main>
      </div>
      <Footer stats={REAL_STATS} />
    </div>
  );
}
