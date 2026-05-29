import type { Metadata } from "next";
import { REAL_STATS, PUBLISHERS } from "@/lib/data";

const stats = REAL_STATS;
const publisherCount = Object.keys(PUBLISHERS).length;

export const metadata: Metadata = {
  title: "Creators",
  description: `The ${publisherCount} people and teams behind Claudinho's verified skills — ${stats.installs} total installs across ${stats.skills} skills.`,
  openGraph: {
    title: "Creators — Claudinho",
    description: `The ${publisherCount} people and teams behind Claudinho's verified skills — ${stats.installs} total installs across ${stats.skills} skills.`,
    url: "https://claudinho.xyz/creators",
  },
  twitter: {
    card: "summary_large_image",
    title: "Creators — Claudinho",
    description: `The ${publisherCount} people and teams behind Claudinho's verified skills.`,
  },
};

export default function CreatorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
