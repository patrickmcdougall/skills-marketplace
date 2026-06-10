import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SKILLS_PAGES, getSkillsPage, MANUAL_ENABLED } from "@/lib/manual";
import { GuideBody } from "@/components/manual/GuideBody";

export function generateStaticParams() {
  if (!MANUAL_ENABLED) return [];
  return SKILLS_PAGES.map((p) => ({ topic: p.topic }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  const page = getSkillsPage(topic);
  if (!page) return {};
  const title = `${page.title} — The Manual`;
  return {
    title,
    description: page.standfirst,
    openGraph: {
      type: "article",
      title,
      description: page.standfirst,
      url: `https://claudinho.xyz/manual/skills/${page.topic}`,
    },
  };
}

export default async function SkillsTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  const page = getSkillsPage(topic);
  if (!page) notFound();

  return (
    <article>
      <div className="mn-crumb">
        Skills / <span className="o">{page.title}</span>
      </div>
      <h1>{page.title}</h1>
      <p className="mn-lead">{page.standfirst}</p>

      <GuideBody body={page.body} />

      {page.next && (
        <Link className="mn-next" href={page.next.href}>
          {page.next.label} →
        </Link>
      )}

      <div className="mn-updated">
        Skills · {page.order} of {SKILLS_PAGES.length}
      </div>
    </article>
  );
}
