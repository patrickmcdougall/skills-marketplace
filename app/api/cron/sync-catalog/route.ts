/**
 * Cron: grow and refresh the catalog from skills.sh.
 *
 * Skills.sh is the source of truth for what skills exist and how many installs
 * they have. Each run:
 *   1. Pulls the leaderboard (all-time, trending, hot) up to LEADERBOARD_MAX_PAGES
 *      pages per view, stopping early if the time budget runs low.
 *   2. For skills already linked in our catalog: updates install counts + signals.
 *   3. For skills in our catalog by slug but not yet linked: sets skillssh_id.
 *   4. For brand-new skills: fetches the detail endpoint to get SKILL.md content,
 *      then inserts a full skill_listing + skill_signal row. Capped at
 *      CATALOG_PER_RUN per run. Skills are processed highest-installs-first.
 *
 * The function self-limits to BUDGET_MS (240s) so it never hits the 300s hard
 * timeout. Partial progress is committed on every run — just trigger again to
 * continue the bootstrap.
 *
 * Env vars:
 *   CATALOG_PER_RUN      — max new skills to fully index per run (default: 50)
 *   LEADERBOARD_MAX_PAGES — max pages per leaderboard view (default: 30 = 15k skills)
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
  name?: string;
  source: string;
  installs: number;
  sourceType?: "github" | "well-known";
  installUrl?: string | null;
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

type DetailResponse = {
  id: string;
  slug: string;
  name?: string;
  source: string;
  installs: number;
  url?: string;
  hash: string;
  files: { path: string; contents: string }[];
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

type CatalogEntry = { id: string; slug: string; skillssh_id: string | null };

// ---------- constants ----------

const API_BASE = "https://skills.sh/api/v1";
const PER_PAGE = 500;
const GAP_MS = 150;
const UA = "claudinho-cron/1.0 (+claudinho.xyz)";
// Stop processing at 240s — well before Vercel's 300s hard limit.
const BUDGET_MS = 240_000;

// ---------- route ----------

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;
  const budgetLeft = () => BUDGET_MS - elapsed();

  const catalogLimit = parseInt(process.env.CATALOG_PER_RUN ?? "50", 10);
  const maxPages = parseInt(process.env.LEADERBOARD_MAX_PAGES ?? "30", 10);

  const token = await getVercelOidcToken();
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const headers = buildHeaders(token);

  // Fetch leaderboard views sequentially. Pass budget so each view stops early
  // if we're running out of time.
  const allTime = await fetchView(headers, "all-time", maxPages, budgetLeft);
  const trending = budgetLeft() > 30_000
    ? await fetchView(headers, "trending", maxPages, budgetLeft)
    : [];
  const hot = budgetLeft() > 20_000
    ? await fetchView(headers, "hot", maxPages, budgetLeft)
    : [];
  const firstPartyRepos = budgetLeft() > 5_000
    ? await fetchCuratedRepos(headers)
    : new Set<string>();

  const byId = new Map<string, SkillSignals>();
  mergeView(byId, allTime, "allTime");
  mergeView(byId, trending, "trending");
  mergeView(byId, hot, "hot");

  const { bySkillsshId, bySlug } = await loadCatalog(db);

  const now = new Date().toISOString();

  type LinkUpdate = { id: string; skillsshId: string; skillsshUrl: string | null; isFirstParty: boolean };
  type SignalUpdate = { id: string; signals: SkillSignals };

  const toIndex: SkillSignals[] = [];
  const toLink: LinkUpdate[] = [];
  const signalUpdates: SignalUpdate[] = [];

  for (const [skillsshId, signals] of byId) {
    const s = signals.skill;
    if (!isValid(s)) continue;

    const existing = bySkillsshId.get(skillsshId);
    if (existing) {
      signalUpdates.push({ id: existing.id, signals });
    } else {
      const slug = makeSlug(s);
      const slugMatch = bySlug.get(slug);
      if (slugMatch) {
        toLink.push({
          id: slugMatch.id,
          skillsshId,
          skillsshUrl: s.url ?? null,
          isFirstParty: firstPartyRepos.has(s.source.toLowerCase()),
        });
        signalUpdates.push({ id: slugMatch.id, signals });
      } else {
        toIndex.push(signals);
      }
    }
  }

  toIndex.sort((a, b) => b.installs - a.installs);

  const BATCH = 200;

  // Link GitHub-indexed skills to their skills.sh IDs (fast — no API calls).
  for (let i = 0; i < toLink.length; i += BATCH) {
    await Promise.all(toLink.slice(i, i + BATCH).map((u) =>
      db.from("skill_listing").update({
        skillssh_id: u.skillsshId,
        skillssh_url: u.skillsshUrl,
        is_first_party: u.isFirstParty,
      }).eq("id", u.id)
    ));
  }

  // Index new skills — stop if budget is running low.
  let indexed = 0, detailFailed = 0;
  for (const signals of toIndex.slice(0, catalogLimit)) {
    if (budgetLeft() < 15_000) break;
    const s = signals.skill;
    try {
      const detail = await fetchDetail(headers, s.id);
      const isFirstParty = firstPartyRepos.has(s.source.toLowerCase());
      const listingRow = buildListingRow(s, detail, isFirstParty, now);

      const { data: inserted, error: listingErr } = await db
        .from("skill_listing")
        .upsert(listingRow, { onConflict: "slug" })
        .select("id")
        .single();
      if (listingErr) throw new Error(listingErr.message);

      const skillId = (inserted as { id: string }).id;

      await db.from("skill_signal").upsert({
        skill_id: skillId,
        install_count_estimate: signals.installs,
        install_count: 0,
        stars: 0,
        forks: 0,
        installs_yesterday: signals.installsYesterday ?? null,
        trending_velocity: signals.trendingVelocity ?? null,
        trending_rank: signals.trendingRank ?? null,
        hot_rank: signals.hotRank ?? null,
        fetched_at: now,
      }, { onConflict: "skill_id" });

      indexed++;
    } catch (err) {
      detailFailed++;
      console.warn(`[sync-catalog] detail failed ${s.id}: ${(err as Error).message}`);
    }
    await sleep(GAP_MS);
  }

  // Refresh signals for all already-linked skills.
  for (let i = 0; i < signalUpdates.length; i += BATCH) {
    if (budgetLeft() < 5_000) break;
    await Promise.all(signalUpdates.slice(i, i + BATCH).map(({ id, signals }) =>
      db.from("skill_signal").update({
        install_count_estimate: signals.installs,
        installs_yesterday: signals.installsYesterday,
        trending_velocity: signals.trendingVelocity,
        trending_rank: signals.trendingRank,
        hot_rank: signals.hotRank,
        fetched_at: now,
      }).eq("skill_id", id)
    ));
  }

  return Response.json({
    ok: true,
    elapsedMs: elapsed(),
    discoveredOnSkillssh: byId.size,
    alreadyInCatalog: signalUpdates.length - toLink.length,
    newlyLinked: toLink.length,
    newSkillsTotal: toIndex.length,
    indexedThisRun: indexed,
    detailFailed,
    remaining: Math.max(0, toIndex.length - catalogLimit),
    signalRefreshes: signalUpdates.length,
    leaderboardPages: { allTime: Math.ceil(allTime.length / PER_PAGE), trending: Math.ceil(trending.length / PER_PAGE), hot: Math.ceil(hot.length / PER_PAGE) },
  });
}

// ---------- fetch ----------

async function fetchView(
  headers: Record<string, string>,
  view: "all-time" | "trending" | "hot",
  maxPages: number,
  budgetLeft: () => number,
): Promise<RankedSkill[]> {
  const out: RankedSkill[] = [];
  let globalRank = 0;
  for (let page = 0; ; page++) {
    if (budgetLeft() < 20_000) break; // stop if less than 20s left
    const res = await fetch(
      `${API_BASE}/skills?view=${view}&per_page=${PER_PAGE}&page=${page}`,
      { headers },
    );
    if (res.status === 429) {
      const retry = parseInt(res.headers.get("Retry-After") ?? "60", 10);
      await sleep(retry * 1000); page--; continue;
    }
    if (!res.ok) throw new Error(`skills.sh ${view} page ${page}: ${res.status}`);
    const body = (await res.json()) as LeaderboardPage;
    for (const s of body.data) out.push({ ...s, viewRank: globalRank++ });
    if (!body.pagination.hasMore || page + 1 >= maxPages) break;
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

async function fetchDetail(
  headers: Record<string, string>,
  skillsshId: string,
): Promise<DetailResponse> {
  const res = await fetch(`${API_BASE}/skills/${skillsshId}`, { headers });
  if (res.status === 429) {
    const retry = parseInt(res.headers.get("Retry-After") ?? "60", 10);
    await sleep(retry * 1000);
    return fetchDetail(headers, skillsshId);
  }
  if (!res.ok) throw new Error(`detail ${skillsshId}: ${res.status} ${res.statusText}`);
  return (await res.json()) as DetailResponse;
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
async function loadCatalog(db: any): Promise<{
  bySkillsshId: Map<string, CatalogEntry>;
  bySlug: Map<string, CatalogEntry>;
}> {
  const bySkillsshId = new Map<string, CatalogEntry>();
  const bySlug = new Map<string, CatalogEntry>();
  let from = 0;
  for (;;) {
    const { data, error } = await db
      .from("skill_listing")
      .select("id, slug, skillssh_id")
      .range(from, from + 999);
    if (error) throw new Error(`skill_listing load: ${error.message}`);
    if (!data?.length) break;
    for (const row of data as CatalogEntry[]) {
      if (row.skillssh_id) bySkillsshId.set(row.skillssh_id, row);
      bySlug.set(row.slug, row);
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  return { bySkillsshId, bySlug };
}

// ---------- build row ----------

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*"?([^"#\n]*?)"?\s*(?:#.*)?$/);
    if (m) result[m[1].toLowerCase()] = m[2].trim();
  }
  return result;
}

function buildListingRow(
  s: SkillV1,
  detail: DetailResponse,
  isFirstParty: boolean,
  now: string,
) {
  const skillMdFile = detail.files.find(
    (f) => f.path.toLowerCase() === "skill.md" || f.path.toLowerCase().endsWith("/skill.md"),
  );
  const fm = skillMdFile ? parseFrontmatter(skillMdFile.contents) : {};
  const skillPath = skillMdFile && skillMdFile.path.includes("/")
    ? skillMdFile.path.split("/").slice(0, -1).join("/")
    : null;

  return {
    slug: makeSlug(s),
    source_type: "github",
    source_url: `https://github.com/${s.source}`,
    skill_name: fm["name"] || s.name || s.slug,
    description_excerpt: fm["description"] || "",
    license_spdx: fm["license"] || null,
    topics: [] as string[],
    status: "indexed",
    skill_path: skillPath,
    last_indexed_at: now,
    skillssh_id: s.id,
    skillssh_url: s.url ?? null,
    skillssh_hash: detail.hash,
    is_first_party: isFirstParty,
  };
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
