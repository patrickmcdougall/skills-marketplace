import type { Metadata } from "next";
import { ALL_SKILLS } from "@/lib/data";

const count = ALL_SKILLS.length;

export const metadata: Metadata = {
  title: "Browse skills",
  description: `Browse and filter ${count} verified Claude skills by role, stage, setup, and creator. Every skill is installed and re-verified weekly.`,
  openGraph: {
    title: "Browse skills — Claudinho",
    description: `Browse and filter ${count} verified Claude skills by role, stage, setup, and creator.`,
    url: "https://claudinho.xyz/skills",
  },
  twitter: {
    card: "summary_large_image",
    title: "Browse skills — Claudinho",
    description: `Browse and filter ${count} verified Claude skills by role, stage, setup, and creator.`,
  },
};

export default function SkillsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
