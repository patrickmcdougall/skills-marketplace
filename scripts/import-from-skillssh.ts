/**
 * scripts/import-from-skillssh.ts
 *
 * Claudinho — pulls the skills.sh leaderboard and appends new repos to
 * scripts/curated-repos.txt with install counts as comments.
 *
 * Why skills.sh:
 *   - It's the production-scale registry. 600,000+ skills with install
 *     counts — the one quality signal we can't generate ourselves.
 *   - First-party publishers (companies teaching how to use their own
 *     product) are flagged on a separate `/curated` endpoint.
 *   - Security audits (Socket, Snyk, Gen Agent Trust Hub) are available
 *     per-skill at `/audit/{id}`.
 *
 * What this script does today:
 *   1. Walks `/api/v1/skills?view=all-time` page by page.
 *   2. Filters out duplicates (forks/copies that skills.sh has flagged).
 *   3. Filters to `sourceType === "github"` (we don't handle well-known
 *      sources yet).
 *   4. Sums install counts per `owner/repo`.
 *   5. Appends any owner/repo not already in curated-repos.txt as a new
 *      line, sorted by install count desc, with a `# X installs` comment.
 *
 * What this script does NOT do (yet):
 *   - Write per-skill install counts into skill_signal. That needs a slug
 *     match step. Worth doing — follow-up. (sync-install-counts.ts does this.)
 *   - Use the /curated endpoint to tag first-party publishers. Worth doing
 *     when skill_listing gains an is_first_party column.
 *   - Pull audit results. Worth doing when skill_listing gains a verified
 *     status column.
 *
 * Auth: Vercel OIDC — no API key needed. Requires the project to have
 *   OIDC Federation enabled (Project → Settings → OIDC Federation in the
 *   Vercel dashboard). For local runs: `vercel link && vercel env pull`
 *   then run this script normally.
 *
 * Run:
 *   npx tsx scripts/import-from-skillssh.ts
 */

import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getVercelOidcToken } from "@vercel/oidc";

loadEnv({ path: ".env.local" });

// ---------- config ----------

const API_BASE = "https://skills.sh/api/v1";
const PER_PAGE = 500;   // API max per page
// No page cap — paginate until hasMore: false. The leaderboard only returns
// skills with at least one install, so we naturally get the full installed catalog.
const REQUEST_GAP_MS = 150;
const USER_AGENT = "claudinho-importer/0.1 (+claudinho.xyz)";
const CURATED_PATH = resolve(process.cwd(), "scripts/curated-repos.txt");

// ---------- types ----------

type SkillV1 = {
  id: string;            // e.g. "vercel-labs/agent-skills/next-js-development"
  slug: string;
  name?: string;
  source: string;        // e.g. "vercel-labs/agent-skills"
  installs: number;
  sourceType?: "github" | "well-known";
  installUrl?: string | null;
  url?: string;
  isDuplicate?: boolean;
};

type LeaderboardResponse = {
  data: SkillV1[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    hasMore: boolean;
  };
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

// ---------- main ----------

async function main() {
  const token = await getVercelOidcToken();

  // Pull all three leaderboard views; merge by id, taking max installs.
  // trending + hot surface repos with high velocity that rank low in all-time.
  const all = await fetchAllSkillsAllViews(token);
  console.log(`[skillssh] ${all.length} unique skills across all views`);

  // First-party repos from the curated endpoint — companies that teach their
  // own product. These get indexed regardless of leaderboard rank.
  const firstPartyRepos = await fetchCuratedRepos(token);
  console.log(`[skillssh] ${firstPartyRepos.size} first-party repos from /curated`);

  // Filter: github only, not duplicate.
  const valid = all.filter((s) => (s.sourceType ?? "github") === "github" && !s.isDuplicate);

  // Group by owner/repo — sum installs across skills in that repo.
  const byRepo = new Map<string, { installs: number; skills: number; firstParty: boolean }>();

  for (const s of valid) {
    const key = s.source;
    const entry = byRepo.get(key) ?? { installs: 0, skills: 0, firstParty: firstPartyRepos.has(key.toLowerCase()) };
    entry.installs += s.installs;
    entry.skills += 1;
    byRepo.set(key, entry);
  }

  // Also include first-party repos that didn't appear in the leaderboard at all
  // (new publishers, well-known sources, repos with no tracked installs yet).
  for (const repo of firstPartyRepos) {
    const normalized = repo.toLowerCase();
    // Find the canonical-case key already in the map.
    const existing = [...byRepo.keys()].find(k => k.toLowerCase() === normalized);
    if (!existing) {
      byRepo.set(repo, { installs: 0, skills: 0, firstParty: true });
    } else {
      byRepo.get(existing)!.firstParty = true;
    }
  }

  console.log(`[skillssh] ${byRepo.size} distinct repos (leaderboard + first-party)`);

  // Read existing curated list.
  const existing = readExistingRepos(CURATED_PATH);
  console.log(`[skillssh] curated-repos.txt currently has ${existing.size} repos`);

  // New repos only. First-party repos sort before others; within each group,
  // sort by installs desc.
  const newRepos = [...byRepo.entries()]
    .filter(([repo]) => !existing.has(repo.toLowerCase()))
    .sort((a, b) => {
      if (a[1].firstParty !== b[1].firstParty) return a[1].firstParty ? -1 : 1;
      return b[1].installs - a[1].installs;
    });

  const newFirstParty = newRepos.filter(([, v]) => v.firstParty).length;
  console.log(`[skillssh] ${newRepos.length} new repos to append (${newFirstParty} first-party)`);

  if (newRepos.length === 0) {
    console.log("[skillssh] nothing to add — curated list is already comprehensive.");
    return;
  }

  const append = renderAppendBlock(newRepos);
  writeFileSync(CURATED_PATH, readFileSync(CURATED_PATH, "utf8") + append);

  console.log(`[skillssh] appended ${newRepos.length} entries to ${CURATED_PATH}`);
  console.log(`[skillssh] top 10 by installs:`);
  for (const [repo, info] of newRepos.slice(0, 10)) {
    const tag = info.firstParty ? " [first-party]" : "";
    const n = info.installs.toLocaleString("en-US");
    console.log(`  ${n.padStart(12)}  ${repo}  (${info.skills} skill${info.skills === 1 ? "" : "s"})${tag}`);
  }

  console.log(`\n[skillssh] done. Next: npx tsx scripts/index-curated.ts`);
}

// ---------- fetch ----------

/**
 * Pull all three leaderboard views and merge by skill `id`, keeping the max
 * installs seen across views. This catches repos that rank high in trending
 * or hot but are buried in the all-time list.
 */
async function fetchAllSkillsAllViews(token: string): Promise<SkillV1[]> {
  const byId = new Map<string, SkillV1>();
  for (const view of ["all-time", "trending", "hot"] as const) {
    const skills = await fetchLeaderboard(token, view);
    for (const s of skills) {
      const existing = byId.get(s.id);
      if (!existing || s.installs > existing.installs) {
        byId.set(s.id, s);
      }
    }
    console.log(`[skillssh] after ${view}: ${byId.size} unique skills`);
  }
  return Array.from(byId.values());
}

async function fetchLeaderboard(token: string, view: "all-time" | "trending" | "hot"): Promise<SkillV1[]> {
  const out: SkillV1[] = [];
  for (let page = 0; ; page++) {
    const url = `${API_BASE}/skills?view=${view}&per_page=${PER_PAGE}&page=${page}`;
    const res = await fetch(url, { headers: buildHeaders(token) });
    if (res.status === 401) {
      throw new Error(
        "skills.sh returned 401. Make sure OIDC Federation is enabled in your Vercel project " +
          "(Project → Settings → OIDC Federation) and you've run `vercel env pull` locally.",
      );
    }
    if (res.status === 429) {
      const retry = res.headers.get("Retry-After") ?? "60";
      console.warn(`[skillssh] rate limited — waiting ${retry}s`);
      await sleep(parseInt(retry, 10) * 1000);
      page--;
      continue;
    }
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
    const body = (await res.json()) as LeaderboardResponse;
    out.push(...body.data);
    if (!body.pagination.hasMore) break;
    await sleep(REQUEST_GAP_MS);
  }
  return out;
}

/**
 * Returns the set of `owner/repo` strings (lowercased) that skills.sh has
 * identified as first-party — publishers teaching their own product.
 * These are indexed unconditionally regardless of install count.
 */
async function fetchCuratedRepos(token: string): Promise<Set<string>> {
  const url = `${API_BASE}/skills/curated`;
  const res = await fetch(url, { headers: buildHeaders(token) });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  const body = (await res.json()) as CuratedResponse;
  const repos = new Set<string>();
  for (const owner of body.data) {
    for (const skill of owner.skills) {
      if ((skill.sourceType ?? "github") === "github" && !skill.isDuplicate) {
        repos.add(skill.source.toLowerCase());
      }
    }
  }
  return repos;
}

function buildHeaders(token: string): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ---------- curated-repos.txt helpers ----------

function readExistingRepos(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  const raw = readFileSync(path, "utf8");
  const out = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // Match shape `owner/repo`; ignore anything after whitespace (so existing
    // inline comments don't trip the check).
    const m = trimmed.match(/^([A-Za-z0-9][A-Za-z0-9\-_.]*\/[A-Za-z0-9][A-Za-z0-9\-_.]*)/);
    if (m) out.add(m[1].toLowerCase());
  }
  return out;
}

function renderAppendBlock(newRepos: [string, { installs: number; skills: number; firstParty: boolean }][]): string {
  const now = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push("");
  lines.push(`# === skills.sh import (${now}) ===`);
  lines.push(`# Auto-appended by scripts/import-from-skillssh.ts.`);
  lines.push(`# install counts = skills.sh totals at import time; first-party = from /curated endpoint.`);
  lines.push(`# These are candidates — index-curated.ts will verify and flag empties.`);
  lines.push("");
  for (const [repo, info] of newRepos) {
    const installs = info.installs.toLocaleString("en-US");
    const skills = info.skills === 1 ? "1 skill" : `${info.skills} skills`;
    const tag = info.firstParty ? " · first-party" : "";
    lines.push(`${repo}  # ${installs} installs · ${skills}${tag}`);
  }
  return lines.join("\n") + "\n";
}

// ---------- utils ----------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- go ----------

main().catch((err) => {
  console.error("[skillssh] fatal:", err);
  process.exit(1);
});
