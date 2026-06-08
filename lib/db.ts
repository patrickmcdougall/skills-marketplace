// Server-side data access — do not import in Client Components.
import { createClient } from "@supabase/supabase-js";
import { auditRowsToInput, getSkillTrust, type SkillTrustStatus } from "./trust";

function serverDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your deployment environment."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── types ────────────────────────────────────────────────────────────────

export type SkillSignal = {
  stars: number;
  forks: number;
  install_count_estimate: number;
  install_count: number;
  fetched_at: string;
  // skills.sh trending signals
  installs_yesterday: number | null;
  trending_velocity: number | null;
  trending_rank: number | null;
  hot_rank: number | null;
};

export type SkillAuditRow = {
  id: string;
  skill_id: string;
  provider: string;
  provider_slug: string;
  status: string;           // 'pass' | 'warn' | 'fail'
  summary: string | null;
  risk_level: string | null; // 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  categories: string[] | null;
  audited_at: string | null;
  fetched_at: string;
};

export type SkillRow = {
  id: string;
  slug: string;
  source_type: string;
  source_url: string;
  skill_name: string;
  description_excerpt: string;
  license_spdx: string | null;
  topics: string[];
  category: string | null;
  last_indexed_at: string;
  last_modified_upstream_at: string | null;
  created_at: string;
  status: string;
  skill_signal: SkillSignal | null;
  // AI-generated card content (via "*" select; present once generated)
  display_title: string | null;
  display_description: string | null;
  best_for: string | null;
  shelf: string | null;
  sub_shelf: string | null;
  tags: string[] | null;
  content_status: string | null;
  // Install bundle
  distribution_mode: string | null;
  bundle_url: string | null;
  bundle_status: string | null;
  bundle_source_ref: string | null;
  bundle_packaged_at: string | null;
  skill_path: string | null;
  // skills.sh identity
  skillssh_id: string | null;
  skillssh_url: string | null;
  skillssh_hash: string | null;
  is_first_party: boolean;
};

// ─── helpers ──────────────────────────────────────────────────────────────

// "https://github.com/obra/superpowers" → "obra"
export function ownerFromUrl(url: string): string {
  try {
    return new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
  } catch {
    return "";
  }
}

// "https://github.com/obra/superpowers" → "obra/superpowers"
export function repoPathFromUrl(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0] ?? "";
  } catch {
    return "";
  }
}

// "virtual-agent/android" → "android"
export function skillLeaf(skillName: string): string {
  return skillName.split("/").pop() ?? skillName;
}

// "obra/superpowers" + "brainstorming" → "npx skills add obra/superpowers --skill brainstorming"
export function installCommand(repoPath: string, skillName: string): string {
  return `npx skills add ${repoPath} --skill ${skillName}`;
}

// ─── browse / publisher types ─────────────────────────────────────────────

// Serialisable shape passed from server → client for browse & publisher pages.
export type BrowseSkill = {
  slug: string;
  title: string;       // raw skill_name
  desc: string;        // raw description_excerpt
  ownerHandle: string;
  repoName: string;
  installs: number;
  stars: number;
  verifiedDate: string;  // ISO date string
  category: string | null;
  topics: string[];
  // AI-generated (present once content_status !== 'pending')
  displayTitle: string | null;
  displayDescription: string | null;
  bestFor: string | null;
  genShelf: string | null;
  subShelf: string | null;
  genTags: string[] | null;
  contentStatus: string | null;  // 'pending' | 'ok' | 'review'
  trendingRank: number | null;
  hotRank: number | null;
};

// Raw publisher aggregate from DB (no catalog enrichment).
export type DBPublisherRow = {
  handle: string;
  skillCount: number;
  installs: number;
  ghStars: number;
};

// GitHub profile data from publisher_profile table.
export type PublisherProfile = {
  handle: string;
  displayName: string | null;
  bio: string | null;
  company: string | null;
  blog: string | null;
  twitterUsername: string | null;
  avatarUrl: string | null;
  ghFollowers: number | null;
  location: string | null;
};

export type RepoInfo = {
  repoPath: string;
  name: string | null;
  description: string | null;
  stars: number | null;
};

// ─── queries ──────────────────────────────────────────────────────────────

export async function getSkillBySlug(slug: string): Promise<SkillRow | null> {
  const { data, error } = await serverDb()
    .from("skill_listing")
    .select("*, skill_signal(*)")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as SkillRow;
}

export async function getOtherSkillsByOwner(
  owner: string,
  excludeSlug: string,
  limit = 3
): Promise<SkillRow[]> {
  const { data } = await serverDb()
    .from("skill_listing")
    .select("*, skill_signal(*)")
    .ilike("source_url", `https://github.com/${owner}/%`)
    .eq("status", "indexed")
    .neq("slug", excludeSlug)
    .limit(20);
  if (!data) return [];
  return (data as SkillRow[])
    .sort(
      (a, b) =>
        ((b.skill_signal?.install_count_estimate ?? 0) + (b.skill_signal?.install_count ?? 0)) -
        ((a.skill_signal?.install_count_estimate ?? 0) + (a.skill_signal?.install_count ?? 0))
    )
    .slice(0, limit);
}

export async function getBrowseSkills(): Promise<BrowseSkill[]> {
  const out: BrowseSkill[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await serverDb()
      .from("skill_listing")
      .select(
        "slug, skill_name, description_excerpt, source_url, topics, category, last_indexed_at, display_title, display_description, best_for, shelf, sub_shelf, tags, content_status, skill_signal(install_count_estimate, install_count, stars, trending_rank, hot_rank)"
      )
      .eq("status", "indexed")
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    type BrowseRow = {
      slug: string;
      skill_name: string;
      description_excerpt: string;
      source_url: string;
      topics: string[];
      category: string | null;
      last_indexed_at: string | null;
      display_title: string | null;
      display_description: string | null;
      best_for: string | null;
      shelf: string | null;
      sub_shelf: string | null;
      tags: string[] | null;
      content_status: string | null;
      skill_signal: { install_count_estimate: number; install_count: number; stars: number; trending_rank: number | null; hot_rank: number | null } | null;
    };
    for (const row of data as unknown as BrowseRow[]) {
      out.push({
        slug: row.slug,
        title: row.skill_name,
        desc: row.description_excerpt,
        ownerHandle: ownerFromUrl(row.source_url),
        repoName: repoPathFromUrl(row.source_url).split("/")[1] ?? "",
        installs: (row.skill_signal?.install_count_estimate ?? 0) + (row.skill_signal?.install_count ?? 0),
        stars: row.skill_signal?.stars ?? 0,
        verifiedDate: row.last_indexed_at ?? "",
        category: row.category,
        topics: row.topics ?? [],
        displayTitle: row.display_title,
        displayDescription: row.display_description,
        bestFor: row.best_for,
        genShelf: row.shelf,
        subShelf: row.sub_shelf,
        genTags: row.tags,
        contentStatus: row.content_status,
        trendingRank: row.skill_signal?.trending_rank ?? null,
        hotRank: row.skill_signal?.hot_rank ?? null,
      });
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export async function getDBPublisherRows(): Promise<DBPublisherRow[]> {
  type PubRow = {
    source_url: string;
    skill_signal: { install_count_estimate: number; install_count: number; stars: number } | null;
  };
  const out: PubRow[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await serverDb()
      .from("skill_listing")
      .select("source_url, skill_signal(install_count_estimate, install_count, stars)")
      .eq("status", "indexed")
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    out.push(...(data as unknown as PubRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Collect distinct repo paths, then fetch fresh star counts from repo_info.
  const distinctRepoPaths = [...new Set(out.map(r => repoPathFromUrl(r.source_url)).filter(Boolean))];
  const repoInfoMap = await getRepoInfos(distinctRepoPaths);

  const map = new Map<string, { installs: number; ghStars: number; count: number }>();
  const seenRepos = new Set<string>();
  for (const row of out) {
    const handle = ownerFromUrl(row.source_url);
    if (!handle) continue;
    const entry = map.get(handle) ?? { installs: 0, ghStars: 0, count: 0 };
    entry.installs += (row.skill_signal?.install_count_estimate ?? 0) + (row.skill_signal?.install_count ?? 0);
    if (!seenRepos.has(row.source_url)) {
      // Prefer repo_info.stars (freshly synced) over skill_signal.stars (stale at index time).
      const repoPath = repoPathFromUrl(row.source_url);
      entry.ghStars += repoInfoMap.get(repoPath)?.stars ?? row.skill_signal?.stars ?? 0;
      seenRepos.add(row.source_url);
    }
    entry.count++;
    map.set(handle, entry);
  }

  return Array.from(map.entries())
    .map(([handle, s]) => ({
      handle,
      skillCount: s.count,
      installs: s.installs,
      ghStars: s.ghStars,
    }))
    .sort((a, b) => b.installs - a.installs || b.skillCount - a.skillCount);
}

export async function getSkillsByOwner(
  owner: string,
  limit = 50
): Promise<SkillRow[]> {
  const { data } = await serverDb()
    .from("skill_listing")
    .select("*, skill_signal(*)")
    .ilike("source_url", `https://github.com/${owner}/%`)
    .eq("status", "indexed")
    .limit(limit);
  if (!data) return [];
  return (data as SkillRow[]).sort(
    (a, b) =>
      (b.skill_signal?.install_count_estimate ?? 0) -
      (a.skill_signal?.install_count_estimate ?? 0)
  );
}

export async function getPublisherProfiles(
  handles: string[]
): Promise<Map<string, PublisherProfile>> {
  if (handles.length === 0) return new Map();
  // Profiles are stored with lowercase handles; normalize before querying.
  const lower = handles.map((h) => h.toLowerCase());
  const { data } = await serverDb()
    .from("publisher_profile")
    .select("handle, display_name, bio, company, blog, twitter_username, avatar_url, gh_followers, location")
    .in("handle", lower);
  const out = new Map<string, PublisherProfile>();
  for (const row of (data ?? []) as {
    handle: string;
    display_name: string | null;
    bio: string | null;
    company: string | null;
    blog: string | null;
    twitter_username: string | null;
    avatar_url: string | null;
    gh_followers: number | null;
    location: string | null;
  }[]) {
    out.set(row.handle, {
      handle: row.handle,
      displayName: row.display_name,
      bio: row.bio,
      company: row.company,
      blog: row.blog,
      twitterUsername: row.twitter_username,
      avatarUrl: row.avatar_url,
      ghFollowers: row.gh_followers,
      location: row.location,
    });
  }
  return out;
}

export async function getAllRepoInfos(): Promise<Map<string, RepoInfo>> {
  const { data } = await serverDb()
    .from("repo_info")
    .select("repo_path, name, description, stars");
  const out = new Map<string, RepoInfo>();
  for (const row of (data ?? []) as { repo_path: string; name: string | null; description: string | null; stars: number | null }[]) {
    out.set(row.repo_path, { repoPath: row.repo_path, name: row.name, description: row.description, stars: row.stars });
  }
  return out;
}

export async function getRepoInfos(repoPaths: string[]): Promise<Map<string, RepoInfo>> {
  if (repoPaths.length === 0) return new Map();
  const { data } = await serverDb()
    .from("repo_info")
    .select("repo_path, name, description, stars")
    .in("repo_path", repoPaths);
  const out = new Map<string, RepoInfo>();
  for (const row of (data ?? []) as { repo_path: string; name: string | null; description: string | null; stars: number | null }[]) {
    out.set(row.repo_path, { repoPath: row.repo_path, name: row.name, description: row.description, stars: row.stars });
  }
  return out;
}

export async function getAllSkillSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await serverDb()
      .from("skill_listing")
      .select("slug")
      .eq("status", "indexed")
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    for (const row of data as { slug: string }[]) slugs.push(row.slug);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return slugs;
}

// ─── audit queries ────────────────────────────────────────────────────────

/** Fetch all audit rows for a single skill by its UUID. */
export async function getSkillAudits(skillId: string): Promise<SkillAuditRow[]> {
  const { data } = await serverDb()
    .from("skill_audit")
    .select("*")
    .eq("skill_id", skillId);
  return (data ?? []) as SkillAuditRow[];
}

/**
 * Fetch audit rows for a set of skills identified by slug.
 * Returns a map of slug → audit rows (only slugs with at least one audit are present).
 *
 * Uses an embedded select via the skill_listing FK so one query suffices.
 */
export async function getAuditsBySlug(
  slugs: string[]
): Promise<Record<string, SkillAuditRow[]>> {
  if (slugs.length === 0) return {};
  type Row = { slug: string; skill_audit: SkillAuditRow[] };
  const { data } = await serverDb()
    .from("skill_listing")
    .select("slug, skill_audit(*)")
    .in("slug", slugs);
  const out: Record<string, SkillAuditRow[]> = {};
  for (const row of (data ?? []) as Row[]) {
    if (row.skill_audit?.length) out[row.slug] = row.skill_audit;
  }
  return out;
}

/**
 * Compute trust status for every indexed skill in one pass.
 * Only "verified" and "flagged" slugs are included — pending is omitted so
 * SkillCard treats a missing entry as "no icon" without extra logic.
 */
export async function getSkillTrustMap(): Promise<Record<string, SkillTrustStatus>> {
  type AuditMini = { provider_slug: string; status: string; risk_level: string | null; summary: string | null };
  type Row = { slug: string; skill_audit: AuditMini[] };
  const out: Record<string, SkillTrustStatus> = {};
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await serverDb()
      .from("skill_listing")
      .select("slug, skill_audit(provider_slug, status, risk_level, summary)")
      .eq("status", "indexed")
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    for (const row of data as unknown as Row[]) {
      const t = getSkillTrust(auditRowsToInput(row.skill_audit ?? []));
      if (t.status !== "pending") out[row.slug] = t.status;
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}
