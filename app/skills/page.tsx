import type { Metadata } from "next";
import { getBrowseSkills } from "@/lib/db";
import { BrowseClient } from "./BrowseClient";

export const metadata: Metadata = {
  title: "Browse skills",
  description:
    "Two thousand community skills, sorted by the job they do. Find the one for your work and install it in a click — no terminal.",
  openGraph: {
    title: "Browse skills — Claudinho",
    description:
      "Two thousand community skills, sorted by the job they do. Find the one for your work and install it in a click — no terminal.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Browse skills — Claudinho",
    description:
      "Two thousand community skills, sorted by the job they do. Find the one for your work and install it in a click — no terminal.",
  },
};

export default async function SkillsPage() {
  const skills = await getBrowseSkills();
  return <BrowseClient initialSkills={skills} />;
}
