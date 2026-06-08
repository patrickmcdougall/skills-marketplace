import { getBrowseSkills, getPublisherProfiles, getSkillTrustMap } from "@/lib/db";
import type { SkillTrustStatus } from "@/lib/trust";
import { BrowseClient } from "./BrowseClient";

export const revalidate = 600;

export default async function SkillsPage() {
  const [skills, trustMap] = await Promise.all([
    getBrowseSkills(),
    getSkillTrustMap(),
  ]);

  // Collect unique handles, fetch display names from publisher_profile.
  const handles = [...new Set(skills.map((s) => s.ownerHandle).filter(Boolean))];
  const profileMap = await getPublisherProfiles(handles);

  // Build handle → displayName map; omit entries where name === handle (no info added).
  const publisherNames: Record<string, string> = {};
  for (const [handle, profile] of profileMap) {
    if (profile.displayName && profile.displayName.toLowerCase() !== handle.toLowerCase()) {
      publisherNames[handle] = profile.displayName;
    }
  }

  return <BrowseClient initialSkills={skills} publisherNames={publisherNames} trustMap={trustMap} />;
}
