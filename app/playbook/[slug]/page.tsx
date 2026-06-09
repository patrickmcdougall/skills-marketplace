import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PLAYS, getPlay, PLAYBOOK_ENABLED } from "@/lib/playbook";
import { PlayArticle, type PlaySignals } from "@/components/playbook/PlayArticle";
import { getSkillBySlug } from "@/lib/db";

// Cases are ISR-cached; live skill signals refresh hourly.
export const revalidate = 3600;

export function generateStaticParams() {
  if (!PLAYBOOK_ENABLED) return [];
  return PLAYS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const play = getPlay(slug);
  if (!play) return {};
  const title = `${play.title} — The Playbook`;
  return {
    title,
    description: play.standfirst,
    openGraph: {
      type: "article",
      title,
      description: play.standfirst,
      url: `https://claudinho.xyz/playbook/${play.slug}`,
    },
  };
}

// Fetch live install/star signals + confirm the skill exists in the catalogue.
// Falls back to null (static anchor, no signals) when the slug is a placeholder
// or the DB is unreachable (e.g. local dev without Supabase creds).
async function loadSignals(skillSlug: string): Promise<{ signals: PlaySignals; href: string | null }> {
  if (!skillSlug) return { signals: null, href: null };
  try {
    const row = await getSkillBySlug(skillSlug);
    if (!row) return { signals: null, href: null };
    const s = row.skill_signal;
    return {
      signals: {
        installs: (s?.install_count_estimate ?? 0) + (s?.install_count ?? 0),
        stars: s?.stars ?? 0,
      },
      href: `/skills/${row.slug}`,
    };
  } catch {
    return { signals: null, href: null };
  }
}

export default async function PlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const play = getPlay(slug);
  if (!play) notFound();

  const { signals, href } = await loadSignals(play.skill.skillSlug);

  return <PlayArticle play={play} signals={signals} skillHref={href} />;
}
