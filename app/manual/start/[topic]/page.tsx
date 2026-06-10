import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { INTRO_PAGES, getIntro, PLAYBOOK_ENABLED } from "@/lib/playbook";
import { RichText } from "@/components/playbook/RichText";
import { SurfaceGrid } from "@/components/playbook/SurfaceGrid";
import { FeatureList } from "@/components/playbook/FeatureList";
import { CoworkWalkthrough } from "@/components/playbook/CoworkWalkthrough";

export function generateStaticParams() {
  if (!PLAYBOOK_ENABLED) return [];
  return INTRO_PAGES.map((p) => ({ topic: p.topic }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  const page = getIntro(topic);
  if (!page) return {};
  const title = `${page.title} — The Playbook`;
  return {
    title,
    description: page.standfirst,
    openGraph: {
      type: "article",
      title,
      description: page.standfirst,
      url: `https://claudinho.xyz/playbook/intro/${page.topic}`,
    },
  };
}

export default async function IntroTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  const page = getIntro(topic);
  if (!page) notFound();

  return (
    <article>
      <div className="pb-crumb">
        Intro to Cowork / <span className="o">{page.title}</span>
      </div>
      <h1>{page.title}</h1>
      <p className="pb-lead">{page.standfirst}</p>

      {page.body.map((block, i) => {
        switch (block.kind) {
          case "p":
            return (
              <p key={i}>
                <RichText text={block.text} />
              </p>
            );
          case "h2":
            return (
              <h2 className="pb-h2" key={i}>
                {block.text}
              </h2>
            );
          case "callout":
            return (
              <div className="pb-callout" key={i}>
                <div className="pb-callout-title">{block.title}</div>
                <p>
                  <RichText text={block.text} />
                </p>
              </div>
            );
          case "list":
            return (
              <ul className="pb-list" key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>
                    <RichText text={item} />
                  </li>
                ))}
              </ul>
            );
          case "surface-grid":
            return <SurfaceGrid key={i} rows={block.rows} />;
          case "feature-list":
            return <FeatureList key={i} features={block.features} />;
          case "cowork-walkthrough":
            return <CoworkWalkthrough key={i} intro={block.intro} steps={block.steps} />;
        }
      })}

      {page.next && (
        <Link className="pb-next" href={page.next.href}>
          {page.next.label} →
        </Link>
      )}

      <div className="pb-updated">
        Intro · {page.order} of {INTRO_PAGES.length}
      </div>
    </article>
  );
}
