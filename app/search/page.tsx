import type { Metadata } from "next";
import { getBrowseSkills } from "@/lib/db";
import { BrowseClient } from "@/app/skills/BrowseClient";

export const metadata: Metadata = {
  title: "Search skills",
  description: "Search across verified Claude skills by name, creator, or topic.",
};

export default async function SearchPage() {
  const skills = await getBrowseSkills();
  return <BrowseClient initialSkills={skills} />;
}
