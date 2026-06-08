/**
 * scripts/sync-install-counts.ts
 *
 * Claudinho — pull all skills.sh signals into skill_listing + skill_signal.
 *
 * What it collects:
 *   skill_listing:
 *     skillssh_id      — stable "owner/repo/slug" ID; set on first match,
 *                        used as primary key for all future per-skill API calls.
 *     skillssh_url     — direct link on skills.sh
 *     is_first_party   — true when the publisher is on the /curated list
 *
 *   skill_signal:
 *     install_count_estimate — cumulative all-time installs from skills.sh
 *     installs_yesterday     — same clock-hour installs yesterday (hot view)
 *     trending_velocity      — change vs yesterday (hot view; can be negative)
 *     trending_rank          — zero-based position in the trending view
 *     hot_rank               — zero-based position in the hot view
 *
 * Matching strategy:
 *   1. If our DB already has skillssh_id stored → match directly by ID (fast).
 *   2. Otherwise → fuzzy slug match (owner-repo-skillslug). On success the
 *      skillssh_id is written back to skill_listing so future runs skip this.
 *   Unmatched entries are logged; the most common cause is frontmatter `name`
 *   differing from the directory name that skills.sh uses as its slug.
 *
 * Run:
 *   npx tsx scripts/sync-install-counts.ts
 *
 * Required env (in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Auth: Vercel OIDC — enable OIDC Federation in Project → Settings → OIDC
 *   Federation, then `vercel link && vercel env pull` for local runs.
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getVercelOidcToken } from "@vercel/oidc";

loadEnv({ path: ".env.local" });

// ---------- config ----------

const API_BASE = "https://skills.sh/api/v1";
const PER_PAGE = 500;   // API max per page
// No page cap — paginate until hasMore: false.
const REQUEST_GAP_MS = 150;
const USER_AGENT = "claudinho-sync/0.1 (+claudinho.xyz)";

// ---------- env ----------

const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");

function required(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing env: ${name}. Add it to .env.local and re-run.`); process.exit(1); }
  return v;
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ---------- types ----------

type SkillV1 = {
  id: string;               // "owner/repo/slug"
  slug: string;
  name?: string;
  source: string;           // "owner/repo"
  installs: number;
  sourceType?: "github" | "well-known";
  installUrl?: string | null;
  url?: string;
  isDuplicate?: boolean;
  // hot view only
  installsYesterday?: number;
  change?: number;
};

type LeaderboardResponse = {
  data: SkillV1[];
  pagination: { page: number; perPage: number; total: number; hasMore: boolean };
};

type CuratedOwner = {
  owner: string;
  totalInstalls: number;
  featuredRepo: string;
  skills: SkillV1[];
};

type CuratedResponse = {
  data: CuratedOwner[];
  totalOwners: number;
  totalSkills: number;
};

type RankedSkill = SkillV1 & { viewRank: number };

// Per-skill merged data across all views.
type SkillSignals = {
  skill: SkillV1;
  installs: number;
  allTimeRank: number | null;
  trendingRank: number | null;
  hotRank: number | null;
  installsYesterday: number | null;
  trendingVelocity: number | null;
};

type OurSkill = { id: string; slug: string; skillssh_id: string | null };

// ---------- main ----------

async function main() {
  const token = await getVercelOidcToken();

  // Pull all three views sequentially (respects rate limit).
  console.log("[sync] fetching all-time view…");
  const allTime = await fetchLeaderboardRanked(token, "all-time");
  console.log("[sync] fetching trending view…");
  const trending = await fetchLeaderboardRanked(token, "trending");
  console.log("[sync] fetching hot view…");
  const hot = await fetchLeaderboardRanked(token, "hot");

  console.log(`[sync] all-time: ${allTime.length} · trending: ${trending.length} · hot: ${hot.length}`);

  // First-party repos from the curated endpoint.
  console.log("[sync] fetching first-party list from /curated…");
  const firstPartyRepos = await fetchCuratedRepos(token);
  console.log(`[sync] ${firstPartyRepos.size} first-party repos`);

  // Merge all views into a per-skill signal record.
  const byId = new Map<string, SkillSignals>();

  for (const s of allTime) {
    if (!isGithubAndNotDupe(s)) continue;
    byId.set(s.id, {
      skill: s, installs: s.installs,
      allTimeRank: s.viewRank, trendingRank: null, hotRank: null,
      installsYesterday: null, trendingVelocity: null,
    });
  }
  for (const s of trending) {
    if (!isGithubAndNotDupe(s)) continue;
    const existing = byId.get(s.id);
    if (existing) {
      existing.trendingRank = s.viewRank;
      if (s.installs > existing.installs) { existing.installs = s.installs; existing.skill = s; }
    } else {
      byId.set(s.id, {
        skill: s, installs: s.installs,
        allTimeRank: null, trendingRank: s.viewRank, hotRank: null,
        installsYesterday: null, trendingVelocity: null,
      });
    }
  }
  for (const s of hot) {
    if (!isGithubAndNotDupe(s)) continue;
    const existing = byId.get(s.id);
    if (existing) {
      existing.hotRank = s.viewRank;
      existing.installsYesterday = s.installsYesterday ?? null;
      existing.trendingVelocity = s.change ?? null;
      if (s.installs > existing.installs) { existing.installs = s.installs; existing.skill = s; }
    } else {
      byId.set(s.id, {
        skill: s, installs: s.installs,
        allTimeRank: null, trendingRank: null, hotRank: s.viewRank,
        installsYesterday: s.installsYesterday ?? null, trendingVelocity: s.change ?? null,
      });
    }
  }

  console.log(`[sync] merged: ${byId.size} unique skills across all views`);

  // Load our catalog with existing skillssh_id values.
  console.log("[sync] loading our skill_listing…");
  const ours = await loadOurSkills();
  console.log(`[sync] ${ours.bySlug.size} skills in skill_listing`);

  // Match skills.sh entries to our catalog.
  const now = new Date().toISOString();
  let matched = 0;
  let newlyLinked = 0;
  let unmatched = 0;
  const unmatchedExamples: string[] = [];

  // Accumulate updates — write in batches.
  const signalUpdates: {
    skill_id: string;
    installs: number;
    installs_yesterday: number | null;
    trending_velocity: number | null;
    trending_rank: number | null;
    hot_rank: number | null;
  }[] = [];

  const listingUpdates: {
    skill_id: string;
    skillssh_id: string;
    skillssh_url: string | null;
    is_first_party: boolean;
  }[] = [];

  for (const [skillsshId, signals] of byId) {
    const s = signals.skill;

    // Match: direct ID lookup first, then fuzzy slug.
    let ourSkill = ours.bySkillsshId.get(skillsshId);
    let isNewLink = false;

    if (!ourSkill) {
      const candidateSlug = makeOurSlug(s);
      ourSkill = ours.bySlug.get(candidateSlug);
      if (ourSkill) isNewLink = true;
    }

    if (!ourSkill) {
      unmatched++;
      if (unmatchedExamples.length < 10) unmatchedExamples.push(`${makeOurSlug(s)} (skills.sh: ${skillsshId})`);
      continue;
    }

    matched++;
    if (isNewLink) newlyLinked++;

    signalUpdates.push({
      skill_id: ourSkill.id,
      installs: signals.installs,
      installs_yesterday: signals.installsYesterday,
      trending_velocity: signals.trendingVelocity,
      trending_rank: signals.trendingRank,
      hot_rank: signals.hotRank,
    });

    // Queue a listing update if we have new data to write.
    const isFirstParty = firstPartyRepos.has(s.source.toLowerCase());
    if (isNewLink || isFirstParty !== (ourSkill.skillssh_id !== null)) {
      listingUpdates.push({
        skill_id: ourSkill.id,
        skillssh_id: skillsshId,
        skillssh_url: s.url ?? null,
        is_first_party: isFirstParty,
      });
    }
  }

  console.log(`[sync] matched ${matched} / ${byId.size} (${newlyLinked} newly linked by slug)`);
  if (unmatched > 0) {
    console.log(`[sync] ${unmatched} unmatched. First 10:`);
    for (const ex of unmatchedExamples) console.log(`  - ${ex}`);
  }

  // Write signal updates.
  console.log(`[sync] writing ${signalUpdates.length} skill_signal updates…`);
  const BATCH = 200;
  let written = 0;
  for (let i = 0; i < signalUpdates.length; i += BATCH) {
    const batch = signalUpdates.slice(i, i + BATCH);
    await Promise.all(batch.map((u) =>
      db.from("skill_signal").update({
        install_count_estimate: u.installs,
        installs_yesterday: u.installs_yesterday,
        trending_velocity: u.trending_velocity,
        trending_rank: u.trending_rank,
        hot_rank: u.hot_rank,
        fetched_at: now,
      }).eq("skill_id", u.skill_id)
    ));
    written += batch.length;
    console.log(`[sync] skill_signal: ${written}/${signalUpdates.length}`);
  }

  // Write listing updates (skillssh_id, skillssh_url, is_first_party).
  if (listingUpdates.length > 0) {
    console.log(`[sync] writing ${listingUpdates.length} skill_listing updates (identity + first-party)…`);
    let lWritten = 0;
    for (let i = 0; i < listingUpdates.length; i += BATCH) {
      const batch = listingUpdates.slice(i, i + BATCH);
      await Promise.all(batch.map((u) =>
        db.from("skill_listing").update({
          skillssh_id: u.skillssh_id,
          skillssh_url: u.skillssh_url,
          is_first_party: u.is_first_party,
        }).eq("id", u.skill_id)
      ));
      lWritten += batch.length;
      console.log(`[sync] skill_listing: ${lWritten}/${listingUpdates.length}`);
    }
  }

  console.log(`[sync] done.`);
}

// ---------- fetch ----------

async function fetchLeaderboardRanked(token: string, view: "all-time" | "trending" | "hot"): Promise<RankedSkill[]> {
  const out: RankedSkill[] = [];
  let globalRank = 0;
  for (let page = 0; ; page++) {
    const url = `${API_BASE}/skills?view=${view}&per_page=${PER_PAGE}&page=${page}`;
    const res = await fetch(url, { headers: buildHeaders(token) });
    if (res.status === 401) throw new Error(
      "skills.sh 401. Enable OIDC Federation (Project → Settings → OIDC Federation) and run `vercel env pull` locally."
    );
    if (res.status === 429) {
      const retry = res.headers.get("Retry-After") ?? "60";
      console.warn(`[sync] rate limited — waiting ${retry}s`);
      await sleep(parseInt(retry, 10) * 1000);
      page--;
      continue;
    }
    if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
    const body = (await res.json()) as LeaderboardResponse;
    for (const s of body.data) out.push({ ...s, viewRank: globalRank++ });
    console.log(`[sync] ${view} page ${page}: +${body.data.length} (total ${out.length}/${body.pagination.total})`);
    if (!body.pagination.hasMore) break;
    await sleep(REQUEST_GAP_MS);
  }
  return out;
}

async function fetchCuratedRepos(token: string): Promise<Set<string>> {
  const url = `${API_BASE}/skills/curated`;
  const res = await fetch(url, { headers: buildHeaders(token) });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  const body = (await res.json()) as CuratedResponse;
  const repos = new Set<string>();
  for (const owner of body.data) {
    for (const skill of owner.skills) {
      if (isGithubAndNotDupe(skill)) repos.add(skill.source.toLowerCase());
    }
  }
  return repos;
}

function buildHeaders(token: string): Record<string, string> {
  return { "User-Agent": USER_AGENT, accept: "application/json", Authorization: `Bearer ${token}` };
}

// ---------- supabase ----------

async function loadOurSkills(): Promise<{
  bySkillsshId: Map<string, OurSkill>;
  bySlug: Map<string, OurSkill>;
}> {
  const bySkillsshId = new Map<string, OurSkill>();
  const bySlug = new Map<string, OurSkill>();
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await db
      .from("skill_listing")
      .select("id, slug, skillssh_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`skill_listing read failed: ${error.message}`);
    if (!data?.length) break;
    for (const row of data as OurSkill[]) {
      if (row.skillssh_id) bySkillsshId.set(row.skillssh_id, row);
      bySlug.set(row.slug, row);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return { bySkillsshId, bySlug };
}

// ---------- slug ----------

function makeOurSlug(s: SkillV1): string {
  const raw = `${s.source.replace("/", "-")}-${s.slug}`;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

// ---------- utils ----------

function isGithubAndNotDupe(s: SkillV1): boolean {
  return (s.sourceType ?? "github") === "github" && !s.isDuplicate;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- go ----------

main().catch((err) => { console.error("[sync] fatal:", err); process.exit(1); });
