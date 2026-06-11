import type { Metadata } from "next";

const description =
  "Browse 12,000+ community Claude skills, sorted by the job they do. Find the one for your work and install it in a click — no terminal.";

export const metadata: Metadata = {
  title: "Browse skills",
  description,
  openGraph: {
    title: "Browse skills — Claudinho",
    description,
    url: "https://claudinho.xyz/skills",
  },
  twitter: {
    card: "summary_large_image",
    title: "Browse skills — Claudinho",
    description,
  },
};

export default function SkillsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
