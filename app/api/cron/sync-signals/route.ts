/**
 * Cron: sync install counts, trending signals, skillssh_id, and is_first_party.
 *
 * Called daily by Vercel Cron. Protected by CRON_SECRET.
 * Mirrors the logic in scripts/sync-install-counts.ts — that script remains
 * for manual one-off runs; this route is the production scheduled path.
 */

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getVercelOidcToken } from "@vercel/oidc";

// ---------- auth ----------

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ---------- types ----------

type SkillV1 = {
  id: string;
  slug: string;
  source: string;
  installs: number;
  sourceType?: "github" | "well-known";
  url?: string;
  isDuplicate?: boolean;
  installsYesterday?: number;
  change?: number;
};

type LeaderboardPage = {
  data: SkillV1[];
  pagination: { page: number; perPage: number; total: number; hasMore: boolean };
};

type CuratedResponse = {
  data: { owner: string; skills: SkillV1[] }[];
};

type RankedSkill = SkillV1 & { viewRank: number };

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

// ---------- constants ----------

const API_BASE = "https://skills.sh/api/v1";
const PER_PAGE = 500;
const GAP_MS = 150;
const UA = "claudinho-cron/1.0 (+claudinho.xyz)";

// ---------- route ----------

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = await getVercelOidcToken();
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const headers = buildHeaders(token);

  // Fetch all three views.
  const [allTime, trending, hot] = await Promise.all([
    fetchView(headers, "all-time"),
    fetchView(headers, "trending"),
    fetchView(headers, "hot"),
  ]);

  // First-party repos.
  const firstPartyRepos = await fetchCuratedRepos(headers);

  // Merge into per-skill signals.
  const byId = new Map<string, SkillSignals>();
  mergeView(byId, allTime, "allTime");
  mergeView(byId, trending, "trending");
  mergeView(byId, hot, "hot");

  // Load our catalog.
  const ours = await loadOurSkills(db);

  const now = new Date().toISOString();
  const signalUpdates: {
    skill_id: string; installs: number;
    installs_yesterday: number | null; trending_velocity: number | null;
    trending_rank: number | null; hot_rank: number | null;
  }[] = [];
  const listingUpdates: {
    skill_id: string; skillssh_id: string;
    skillssh_url: string | null; is_first_party: boolean;
  }[] = [];

  let matched = 0, newlyLinked = 0, unmatched = 0;

  for (const [skillsshId, signals] of byId) {
    const s = signals.skill;
    if (!isValid(s)) continue;

    let ourSkill = ours.bySkillsshId.get(skillsshId);
    let isNewLink = false;
    if (!ourSkill) {
      ourSkill = ours.bySlug.get(makeSlug(s));
      if (ourSkill) isNewLink = true;
    }
    if (!ourSkill) { unmatched++; continue; }

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
    if (isNewLink || firstPartyRepos.has(s.source.toLowerCase())) {
      listingUpdates.push({
        skill_id: ourSkill.id,
        skillssh_id: skillsshId,
        skillssh_url: s.url ?? null,
        is_first_party: firstPartyRepos.has(s.source.toLowerCase()),
      });
    }
  }

  // Write in batches.
  const BATCH = 200;
  for (let i = 0; i < signalUpdates.length; i += BATCH) {
    await Promise.all(signalUpdates.slice(i, i + BATCH).map((u) =>
      db.from("skill_signal").update({
        install_count_estimate: u.installs,
        installs_yesterday: u.installs_yesterday,
        trending_velocity: u.trending_velocity,
        trending_rank: u.trending_rank,
        hot_rank: u.hot_rank,
        fetched_at: now,
      }).eq("skill_id", u.skill_id)
    ));
  }
  for (let i = 0; i < listingUpdates.length; i += BATCH) {
    await Promise.all(listingUpdates.slice(i, i + BATCH).map((u) =>
      db.from("skill_listing").update({
        skillssh_id: u.skillssh_id,
        skillssh_url: u.skillssh_url,
        is_first_party: u.is_first_party,
      }).eq("id", u.skill_id)
    ));
  }

  return Response.json({
    ok: true,
    skillsshSkills: byId.size,
    matched, newlyLinked, unmatched,
    signalWrites: signalUpdates.length,
    listingWrites: listingUpdates.length,
    firstPartyRepos: firstPartyRepos.size,
  });
}

// ---------- fetch ----------

async function fetchView(headers: Record<string, string>, view: "all-time" | "trending" | "hot"): Promise<RankedSkill[]> {
  const out: RankedSkill[] = [];
  let globalRank = 0;
  for (let page = 0; ; page++) {
    const res = await fetch(`${API_BASE}/skills?view=${view}&per_page=${PER_PAGE}&page=${page}`, { headers });
    if (res.status === 429) {
      const retry = parseInt(res.headers.get("Retry-After") ?? "60", 10);
      await sleep(retry * 1000); page--; continue;
    }
    if (!res.ok) throw new Error(`skills.sh ${view} page ${page}: ${res.status}`);
    const body = (await res.json()) as LeaderboardPage;
    for (const s of body.data) out.push({ ...s, viewRank: globalRank++ });
    if (!body.pagination.hasMore) break;
    await sleep(GAP_MS);
  }
  return out;
}

async function fetchCuratedRepos(headers: Record<string, string>): Promise<Set<string>> {
  const res = await fetch(`${API_BASE}/skills/curated`, { headers });
  if (!res.ok) throw new Error(`skills.sh /curated: ${res.status}`);
  const body = (await res.json()) as CuratedResponse;
  const repos = new Set<string>();
  for (const owner of body.data) {
    for (const s of owner.skills) {
      if (isValid(s)) repos.add(s.source.toLowerCase());
    }
  }
  return repos;
}

function buildHeaders(token: string): Record<string, string> {
  return { "User-Agent": UA, accept: "application/json", Authorization: `Bearer ${token}` };
}

// ---------- merge ----------

function mergeView(
  byId: Map<string, SkillSignals>,
  skills: RankedSkill[],
  view: "allTime" | "trending" | "hot",
) {
  for (const s of skills) {
    const existing = byId.get(s.id);
    if (!existing) {
      byId.set(s.id, {
        skill: s, installs: s.installs,
        allTimeRank: view === "allTime" ? s.viewRank : null,
        trendingRank: view === "trending" ? s.viewRank : null,
        hotRank: view === "hot" ? s.viewRank : null,
        installsYesterday: s.installsYesterday ?? null,
        trendingVelocity: s.change ?? null,
      });
    } else {
      if (view === "allTime") existing.allTimeRank = s.viewRank;
      if (view === "trending") existing.trendingRank = s.viewRank;
      if (view === "hot") {
        existing.hotRank = s.viewRank;
        existing.installsYesterday = s.installsYesterday ?? null;
        existing.trendingVelocity = s.change ?? null;
      }
      if (s.installs > existing.installs) { existing.installs = s.installs; existing.skill = s; }
    }
  }
}

// ---------- db ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadOurSkills(db: any) {
  const bySkillsshId = new Map<string, OurSkill>();
  const bySlug = new Map<string, OurSkill>();
  let from = 0;
  for (;;) {
    const { data, error } = await db.from("skill_listing").select("id, slug, skillssh_id").range(from, from + 999);
    if (error) throw new Error(`skill_listing: ${error.message}`);
    if (!data?.length) break;
    for (const row of data as OurSkill[]) {
      if (row.skillssh_id) bySkillsshId.set(row.skillssh_id, row);
      bySlug.set(row.slug, row);
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  return { bySkillsshId, bySlug };
}

// ---------- utils ----------

function isValid(s: SkillV1): boolean {
  return (s.sourceType ?? "github") === "github" && !s.isDuplicate;
}

function makeSlug(s: SkillV1): string {
  return `${s.source.replace("/", "-")}-${s.slug}`
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
