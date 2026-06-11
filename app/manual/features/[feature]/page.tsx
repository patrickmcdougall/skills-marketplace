import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FEATURES, getFeature, MANUAL_ENABLED } from "@/lib/manual";

// Per-feature stub pages: a real (sanitized) screenshot of the feature, the
// one-paragraph description from the overview, and an honest "full guide in
// production" note until each guide is written.

export function generateStaticParams() {
  if (!MANUAL_ENABLED) return [];
  return FEATURES.map((f) => ({ feature: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feature: string }>;
}): Promise<Metadata> {
  const { feature } = await params;
  const f = getFeature(feature);
  if (!f) return {};
  const title = `${f.name} — The Manual`;
  return {
    title,
    description: f.text,
    openGraph: {
      type: "article",
      title,
      description: f.text,
      url: `https://claudinho.xyz/manual/features/${f.slug}`,
    },
  };
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature } = await params;
  const f = getFeature(feature);
  if (!f) notFound();

  const idx = FEATURES.findIndex((x) => x.slug === f.slug);
  const next = FEATURES[idx + 1];

  return (
    <article>
      <div className="mn-crumb">
        Features / <span className="o">{f.name}</span>
      </div>
      <h1>
        {f.name}
        {f.badge && (
          <span className="mn-feat-badge" style={{ marginLeft: 12, verticalAlign: "middle" }}>
            {f.badge}
          </span>
        )}
      </h1>
      <p className="mn-lead">{f.text}</p>
      <p>
        <b>Use it for:</b> {f.example}
      </p>

      <figure className="mn-shot">
        <Image
          src={`/manual/features/${f.slug}.png`}
          alt={`The ${f.name} view in the Claude desktop app`}
          width={1999}
          height={1249}
          sizes="(max-width: 980px) 100vw, 820px"
          priority
        />
        <figcaption>Real screenshot · Claude desktop app, Cowork — personal details blurred</figcaption>
      </figure>

      <div className="mn-soon">
        The full guide for {f.name} — what it&apos;s for, when to reach for it, and a worked
        example — is in production.
      </div>

      <p style={{ marginTop: 24 }}>
        {next ? (
          <Link className="mn-next" href={`/manual/features/${next.slug}`}>
            Next feature: {next.name} →
          </Link>
        ) : (
          <Link className="mn-next" href="/manual/features">
            Back to all features →
          </Link>
        )}
      </p>

      <div className="mn-updated">Features · {f.slug} · coming soon</div>
    </article>
  );
}
