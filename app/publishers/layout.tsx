import type { Metadata } from "next";
import { REAL_STATS, PUBLISHERS } from "@/lib/data";

const stats = REAL_STATS;
const publisherCount = Object.keys(PUBLISHERS).length;

export const metadata: Metadata = {
  title: "Publishers",
  description: `The ${publisherCount} people and teams behind Claudinho's verified skills — ${stats.installs} total installs across ${stats.skills} skills.`,
  openGraph: {
    title: "Publishers — Claudinho",
    description: `The ${publisherCount} people and teams behind Claudinho's verified skills — ${stats.installs} total installs across ${stats.skills} skills.`,
    url: "https://claudinho.xyz/publishers",
  },
  twitter: {
    card: "summary_large_image",
    title: "Publishers — Claudinho",
    description: `The ${publisherCount} people and teams behind Claudinho's verified skills.`,
  },
};

export default function PublishersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
