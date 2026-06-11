import type { Metadata } from "next";
import { getBrowseSkills, getPublisherProfiles } from "@/lib/db";
import { BrowseClient } from "@/app/skills/BrowseClient";

export const metadata: Metadata = {
  title: "Search skills",
  description:
    "Search 12,000+ community Claude skills by name, creator, or topic — and install in a click, no terminal.",
};

export default async function SearchPage() {
  const skills = await getBrowseSkills();
  const handles = [...new Set(skills.map((s) => s.ownerHandle).filter(Boolean))];
  const profileMap = await getPublisherProfiles(handles);
  const publisherNames: Record<string, string> = {};
  for (const [handle, profile] of profileMap) {
    if (profile.displayName && profile.displayName.toLowerCase() !== handle.toLowerCase()) {
      publisherNames[handle] = profile.displayName;
    }
  }
  return <BrowseClient initialSkills={skills} publisherNames={publisherNames} />;
}
