import { getBrowseSkills, getPublisherProfiles, getSkillTrustMap, type BrowseSkill } from "@/lib/db";
import {
  genShelfId,
  shelfLabel,
  sortSkills,
  publisherListForCurrent,
  fmtCount,
  type Skill,
} from "@/lib/data";
import type { SkillTrustStatus } from "@/lib/trust";

// Map a BrowseSkill to the Skill shape that the browse filter/sort/card logic
// expects. Runs on the server so the client never sees raw catalog rows.
function toSkill(s: BrowseSkill, publisherNames: Record<string, string>): Skill {
  // Prefer generated COPY only when content_status is 'ok'; use the generated
  // shelf/tags for classification whenever present (ok or review).
  const ok = s.contentStatus === "ok";
  const sid = genShelfId(s.genShelf);
  return {
    id: s.slug,
    title: ok && s.displayTitle ? s.displayTitle : s.title,
    desc: ok && s.displayDescription ? s.displayDescription : s.desc,
    publisher: s.ownerHandle,
    publisherDisplayName: publisherNames[s.ownerHandle],
    installs: s.installs,
    stars: s.stars,
    verifiedDate: s.verifiedDate,
    version: "",
    shelfTitle: s.genShelf ? shelfLabel(sid) : (s.category ?? ""),
    shelfId: s.genShelf ? sid : (s.category?.toLowerCase().replace(/\s+/g, "-") ?? ""),
    subShelf: s.subShelf ?? undefined,
    tags: [...(s.genTags && s.genTags.length ? s.genTags : s.topics), s.repoName],
  };
}

export type Catalog = {
  skills: Skill[];
  trust: Record<string, SkillTrustStatus>;
};

export async function getCatalog(): Promise<Catalog> {
  const [browse, trust] = await Promise.all([getBrowseSkills(), getSkillTrustMap()]);

  const handles = [...new Set(browse.map((s) => s.ownerHandle).filter(Boolean))];
  const profileMap = await getPublisherProfiles(handles);
  const publisherNames: Record<string, string> = {};
  for (const [handle, profile] of profileMap) {
    if (profile.displayName && profile.displayName.toLowerCase() !== handle.toLowerCase()) {
      publisherNames[handle] = profile.displayName;
    }
  }

  // Default browse order so the server-rendered first page matches the client.
  const skills = sortSkills(browse.map((s) => toSkill(s, publisherNames)), "installs");
  return { skills, trust };
}

// How many skills get server-rendered into the page HTML. The rest arrive via
// /api/catalog after hydration — keeps the document small enough for crawlers.
export const INITIAL_SKILLS = 24;

export type BrowseProps = {
  initialSkills: Skill[];
  totalCount: number;
  initialShelfCounts: Record<string, number>;
  initialPublishers: { handle: string; count: number }[];
  initialTrust: Record<string, SkillTrustStatus>;
  stats: { skills: number; creators: number; weekly: number; installs: string };
};

export function browseProps(catalog: Catalog): BrowseProps {
  const { skills, trust } = catalog;
  const initialSkills = skills.slice(0, INITIAL_SKILLS);

  const initialShelfCounts: Record<string, number> = {};
  for (const s of skills) initialShelfCounts[s.shelfId] = (initialShelfCounts[s.shelfId] || 0) + 1;

  const initialTrust: Record<string, SkillTrustStatus> = {};
  for (const s of initialSkills) if (trust[s.id]) initialTrust[s.id] = trust[s.id];

  return {
    initialSkills,
    totalCount: skills.length,
    initialShelfCounts,
    initialPublishers: publisherListForCurrent(skills),
    initialTrust,
    stats: {
      skills: skills.length,
      creators: new Set(skills.map((s) => s.publisher)).size,
      weekly: 6,
      installs: fmtCount(skills.reduce((a, s) => a + s.installs, 0)),
    },
  };
}
