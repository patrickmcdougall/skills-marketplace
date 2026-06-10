import Link from "next/link";
import type { Metadata } from "next";
import { FEATURES_OVERVIEW } from "@/lib/manual";
import { GuideBody } from "@/components/manual/GuideBody";

export const metadata: Metadata = {
  title: `${FEATURES_OVERVIEW.title} — The Manual`,
  description: FEATURES_OVERVIEW.standfirst,
  openGraph: {
    type: "article",
    title: `${FEATURES_OVERVIEW.title} — The Manual`,
    description: FEATURES_OVERVIEW.standfirst,
    url: "https://claudinho.xyz/manual/features",
  },
};

export default function FeaturesOverviewPage() {
  return (
    <article>
      <div className="mn-crumb">
        Features / <span className="o">At a glance</span>
      </div>
      <h1>{FEATURES_OVERVIEW.title}</h1>
      <p className="mn-lead">{FEATURES_OVERVIEW.standfirst}</p>

      <GuideBody body={FEATURES_OVERVIEW.body} />

      {FEATURES_OVERVIEW.next && (
        <Link className="mn-next" href={FEATURES_OVERVIEW.next.href}>
          {FEATURES_OVERVIEW.next.label} →
        </Link>
      )}

      <div className="mn-updated">Features · overview</div>
    </article>
  );
}
