import Link from "next/link";
import type { Metadata } from "next";
import { START_PAGES, SKILLS_PAGES, FEATURES, CASES, LIVE_CASE_COUNT, SHOW_WIP, visibleCases } from "@/lib/manual";

export const metadata: Metadata = {
  title: "The Manual — Claudinho",
  description:
    "How to get real work out of AI without writing code: Claude Cowork does the work, skills make it repeatable — taught through real examples, grouped by what you do.",
  openGraph: {
    type: "website",
    title: "The Manual — Claudinho",
    description:
      "How to get real work out of AI without writing code — Cowork plus skills, taught through real examples.",
    url: "https://claudinho.xyz/manual",
  },
};

export default function ManualIndexPage() {
  const firstStart = START_PAGES[0];
  const firstLive = CASES.find((p) => p.status === "live");

  return (
    <article>
      <div className="mn-crumb">
        <span className="o">The Manual</span>
      </div>
      <h1>Get real work out of AI. No code required.</h1>
      <p className="mn-lead">
        Most people&apos;s AI stops at a chat box. The Manual takes you past it — Cowork does the
        work, skills make it repeatable, and none of it needs a developer.
      </p>
      <p>
        The index on the left holds it all, in order. <b>Getting started</b> is the five-minute
        on-ramp. <b>Cowork features</b> tours the workspace. <b>Skills</b> covers the layer that
        makes jobs repeatable — what they are, how to install one, how to choose. And{" "}
        <b>Examples</b> shows real jobs done end to end, grouped by what you do, each ending in the
        exact skill that did it.
      </p>

      <div className="mn-overview-cards">
        <Link className="mn-ocard" href={`/manual/start/${firstStart.topic}`}>
          <div className="k">Start here</div>
          <h3>What Cowork is</h3>
          <p>The five-minute on-ramp: what it is, when to reach for it, and your first 10 minutes.</p>
        </Link>
        {firstLive && (
          <Link className="mn-ocard" href={`/manual/${firstLive.slug}`}>
            <div className="k">See a real example</div>
            <h3>{firstLive.title}</h3>
            <p>A real run: broken export in, board-ready workbook out — before and after included.</p>
          </Link>
        )}
      </div>

      <div className="mn-updated">
        Updated weekly ·{" "}
        {START_PAGES.length + 1 + SKILLS_PAGES.length + (SHOW_WIP ? FEATURES.length : 0) + visibleCases().length}{" "}
        topics · {LIVE_CASE_COUNT} live example{LIVE_CASE_COUNT === 1 ? "" : "s"}
      </div>
    </article>
  );
}
