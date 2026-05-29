/**
 * scripts/import-from-skillssh.ts
 *
 * Claudinho — pulls the skills.sh leaderboard and appends new repos to
 * scripts/curated-repos.txt with install counts as comments.
 *
 * Why skills.sh:
 *   - It's the production-scale registry. ~8,000+ skills with install
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
 *     match step. Worth doing — follow-up.
 *   - Use the /curated endpoint to tag first-party publishers. Worth doing
 *     when skill_listing gains an is_first_party column.
 *   - Pull audit results. Worth doing when skill_listing gains a verified
 *     status column.
 *
 * Run:
 *   npx tsx scripts/import-from-skillssh.ts
 */

import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

loadEnv({ path: ".env.local" });

// ---------- config ----------

const API_BASE = "https://skills.sh/api/v1";
const PER_PAGE = 500;                  // API max
const MAX_PAGES = 30;                  // 30 * 500 = 15,000 — generous ceiling
// Auth: 60 req/min unauthenticated, 600 req/min with API key.
// Get a key by emailing skills-api@vercel.com (per https://skills.sh/docs/api).
// Without a key we sleep 1.1s between calls; with a key we go faster.
const SKILLSSH_API_KEY = process.env.SKILLSSH_API_KEY;
const REQUEST_GAP_MS = SKILLSSH_API_KEY ? 150 : 1100;
const USER_AGENT = "claudinho-importer/0.1 (+claudinho.app)";
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

// ---------- main ----------

async function main() {
  const all = await loadSkills();
  console.log(`[skillssh] loaded ${all.length} skills total`);

  // Filter: github only, not duplicate. (The snapshot from scrape-skillssh.ts
  // doesn't set sourceType because all scraped paths are github-style — we
  // default to "github" when missing.)
  const valid = all.filter((s) => (s.sourceType ?? "github") === "github" && !s.isDuplicate);
  console.log(`[skillssh] ${valid.length} valid (github + non-duplicate)`);

  // Group by owner/repo and sum installs.
  const byRepo = new Map<string, { installs: number; skills: number }>();
  for (const s of valid) {
    const entry = byRepo.get(s.source) ?? { installs: 0, skills: 0 };
    entry.installs += s.installs;
    entry.skills += 1;
    byRepo.set(s.source, entry);
  }
  console.log(`[skillssh] grouped into ${byRepo.size} distinct repos`);

  // Read existing curated list.
  const existing = readExistingRepos(CURATED_PATH);
  console.log(`[skillssh] curated-repos.txt currently has ${existing.size} repos`);

  // What's new?
  const newRepos = [...byRepo.entries()]
    .filter(([repo]) => !existing.has(repo.toLowerCase()))
    .sort((a, b) => b[1].installs - a[1].installs);

  console.log(`[skillssh] ${newRepos.length} new repos to append`);

  if (newRepos.length === 0) {
    console.log("[skillssh] nothing to add — curated list is already comprehensive.");
    return;
  }

  // Append to curated-repos.txt.
  const append = renderAppendBlock(newRepos);
  writeFileSync(CURATED_PATH, readFileSync(CURATED_PATH, "utf8") + append);

  console.log(`[skillssh] appended ${newRepos.length} entries to ${CURATED_PATH}`);
  console.log(`[skillssh] top 10 by installs:`);
  for (const [repo, info] of newRepos.slice(0, 10)) {
    console.log(`  ${info.installs.toString().padStart(8).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}  ${repo}  (${info.skills} skill${info.skills === 1 ? "" : "s"})`);
  }

  console.log(`\n[skillssh] done. Next: npx tsx scripts/index-curated.ts`);
}

// ---------- data source ----------

/**
 * Prefer the live skills.sh API if we have an API key. Otherwise read the
 * snapshot produced by scripts/scrape-skillssh.ts.
 */
async function loadSkills(): Promise<SkillV1[]> {
  if (SKILLSSH_API_KEY) {
    console.log("[skillssh] using live API (SKILLSSH_API_KEY set)");
    return await fetchAllSkills();
  }
  const snapshotPath = resolve(process.cwd(), "scripts/skillssh-snapshot.json");
  if (!existsSync(snapshotPath)) {
    throw new Error(
      "No SKILLSSH_API_KEY in .env.local and no scripts/skillssh-snapshot.json on disk. " +
        "Run `npx tsx scripts/scrape-skillssh.ts` first, or get a key from skills-api@vercel.com.",
    );
  }
  console.log("[skillssh] using snapshot from scripts/skillssh-snapshot.json");
  const raw = readFileSync(snapshotPath, "utf8");
  const snap = JSON.parse(raw) as { skills: SkillV1[] };
  return snap.skills;
}

// ---------- fetch ----------

async function fetchAllSkills(): Promise<SkillV1[]> {
  const out: SkillV1[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${API_BASE}/skills?view=all-time&per_page=${PER_PAGE}&page=${page}`;
    const res = await fetch(url, { headers: buildHeaders() });
    if (res.status === 401) {
      throw new Error(
        "skills.sh returned 401 Unauthorized. Their docs say public endpoints don't need auth, " +
          "but this one does. Email skills-api@vercel.com for an API key, then add SKILLSSH_API_KEY=... to .env.local and retry.",
      );
    }
    if (!res.ok) {
      throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as LeaderboardResponse;
    out.push(...body.data);
    console.log(`[skillssh] page ${page}: +${body.data.length} (running total ${out.length}/${body.pagination.total})`);
    if (!body.pagination.hasMore) break;
    await sleep(REQUEST_GAP_MS);
  }
  return out;
}

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": USER_AGENT,
    accept: "application/json",
  };
  if (SKILLSSH_API_KEY) h["Authorization"] = `Bearer ${SKILLSSH_API_KEY}`;
  return h;
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

function renderAppendBlock(newRepos: [string, { installs: number; skills: number }][]): string {
  const now = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push("");
  lines.push(`# === skills.sh import (${now}) ===`);
  lines.push(`# Auto-appended by scripts/import-from-skillssh.ts.`);
  lines.push(`# Numbers in comments are install totals from skills.sh at import time.`);
  lines.push(`# These are candidates — index-curated.ts will verify each one and the report`);
  lines.push(`# will flag any that came up empty.`);
  lines.push("");
  for (const [repo, info] of newRepos) {
    const installs = info.installs.toLocaleString("en-US");
    const skills = info.skills === 1 ? "1 skill" : `${info.skills} skills`;
    lines.push(`${repo}  # ${installs} installs · ${skills}`);
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
