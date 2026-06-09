import Link from "next/link";
import type { Metadata } from "next";
import { INTRO_PAGES, PLAYS, LIVE_PLAY_COUNT, TOTAL_TOPICS } from "@/lib/playbook";

export const metadata: Metadata = {
  title: "The Playbook — Claudinho",
  description:
    "Learn Claude Cowork, then put it to work. A short product primer, then real case studies grouped by what you do — each ending with the skill that did it and how to install it.",
  openGraph: {
    type: "website",
    title: "The Playbook — Claudinho",
    description:
      "Learn Claude Cowork, then put it to work. Real case studies grouped by what you do — each ending with the skill that did it.",
    url: "https://claudinho.xyz/playbook",
  },
};

export default function PlaybookIndexPage() {
  const firstIntro = INTRO_PAGES[0];
  const firstLive = PLAYS.find((p) => p.status === "live");

  return (
    <article>
      <div className="pb-crumb">
        <span className="o">The Playbook</span>
      </div>
      <h1>Learn Cowork, then put it to work.</h1>
      <p className="pb-lead">
        Everything here teaches you to get real work done with Claude Cowork — no code, nothing to
        learn first.
      </p>
      <p>
        The index on the left holds it all. <b>Intro to Cowork</b> is a five-minute primer on the
        product. Below it, <b>case studies grouped by what you do</b> — each one a real job done with
        a single skill, ending in the exact skill that did it and how to install it.
      </p>

      <div className="pb-overview-cards">
        <Link className="pb-ocard" href={`/playbook/intro/${firstIntro.topic}`}>
          <div className="k">Start here · Intro</div>
          <h3>What Cowork is</h3>
          <p>The five-minute primer: what it is, when to reach for it, and your first 10 minutes.</p>
        </Link>
        {firstLive && (
          <Link className="pb-ocard" href={`/playbook/${firstLive.slug}`}>
            <div className="k">See a real case</div>
            <h3>{firstLive.title}</h3>
            <p>The same job in about ninety seconds — with a real before and after.</p>
          </Link>
        )}
      </div>

      <div className="pb-updated">
        Updated weekly · {TOTAL_TOPICS} topics · {LIVE_PLAY_COUNT} live case
        {LIVE_PLAY_COUNT === 1 ? "" : "s"}
      </div>
    </article>
  );
}
