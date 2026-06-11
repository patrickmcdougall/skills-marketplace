import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCase, visibleCases, MANUAL_ENABLED, SHOW_WIP } from "@/lib/manual";
import { CaseArticle, type CaseSignals } from "@/components/manual/CaseArticle";
import { getSkillBySlug } from "@/lib/db";

// Cases are ISR-cached; live skill signals refresh hourly.
export const revalidate = 3600;

export function generateStaticParams() {
  if (!MANUAL_ENABLED) return [];
  return visibleCases().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = getCase(slug);
  if (!entry) return {};
  const title = `${entry.title} — The Manual`;
  return {
    title,
    description: entry.standfirst,
    openGraph: {
      type: "article",
      title,
      description: entry.standfirst,
      url: `https://claudinho.xyz/manual/${entry.slug}`,
    },
  };
}

// Fetch live install/star signals + confirm the skill exists in the catalogue.
// Falls back to null (static anchor, no signals) when the slug is a placeholder
// or the DB is unreachable (e.g. local dev without Supabase creds).
async function loadSignals(skillSlug: string): Promise<{ signals: CaseSignals; href: string | null }> {
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
  const entry = getCase(slug);
  if (!entry || (entry.status !== "live" && !SHOW_WIP)) notFound();

  const { signals, href } = await loadSignals(entry.skill.skillSlug);

  return <CaseArticle entry={entry} signals={signals} skillHref={href} />;
}
