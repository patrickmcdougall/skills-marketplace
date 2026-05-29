/**
 * scripts/index-skills.ts
 *
 * Claudinho — GitHub indexer (v0.1)
 *
 * What it does:
 *  1. Code-searches GitHub for `path:SKILL.md` (the Anthropic skill convention).
 *  2. For each hit, fetches the SKILL.md, parses YAML frontmatter, and pulls
 *     repo metadata (stars, forks, license, last commit, topics).
 *  3. Upserts a row into `skill_listing` and a row into `skill_signal`.
 *
 * Run locally:
 *   npx tsx scripts/index-skills.ts
 *
 * Required env (in .env.local):
 *   GITHUB_TOKEN                   — PAT with public_repo (read-only is fine).
 *   NEXT_PUBLIC_SUPABASE_URL       — Supabase project URL.
 *   SUPABASE_SERVICE_ROLE_KEY      — service-role key (NOT the anon key; we
 *                                    need write access and bypass of RLS).
 *
 * Target for this first run: ~150 rows in `skill_listing`.
 */

import { config as loadEnv } from "dotenv";
import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";
import matter from "gray-matter";

// Load .env.local explicitly — Next.js auto-loads it but a plain tsx run does not.
loadEnv({ path: ".env.local" });

// ---------- config ----------

const USER_AGENT = "claudinho-indexer/0.1 (+claudinho.app)";
// Stars + recency filter so we don't drown in zero-attention repos. Tune
// thresholds when broadening; the trade-off is recall vs. signal.
const SEARCH_QUERY = "path:SKILL.md stars:>3 pushed:>2025-01-01";
const PER_PAGE = 100;          // GitHub max
const MAX_PAGES = 2;           // 2 pages * 100 = 200 candidates
const SEARCH_COOLDOWN_MS = 7000; // GitHub code search: 30 req/min — be polite

// ---------- env ----------

const GITHUB_TOKEN = required("GITHUB_TOKEN");
const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}. Add it to .env.local and re-run.`);
    process.exit(1);
  }
  return v;
}

// ---------- clients ----------

const gh = new Octokit({
  auth: GITHUB_TOKEN,
  userAgent: USER_AGENT,
});

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- types ----------

type Candidate = {
  owner: string;
  repo: string;
  path: string;        // e.g. "skills/pdf/SKILL.md" or "SKILL.md"
  htmlUrl: string;     // SKILL.md html_url
  repoHtmlUrl: string; // repo html_url
};

type Frontmatter = {
  name?: string;
  description?: string;
  license?: string;
  version?: string;
};

type RepoMeta = {
  stars: number;
  forks: number;
  licenseSpdx: string | null;
  topics: string[];
  lastModifiedUpstreamAt: string | null; // ISO
};

// ---------- main ----------

async function main() {
  console.log(`[indexer] start — query="${SEARCH_QUERY}", per_page=${PER_PAGE}, max_pages=${MAX_PAGES}`);

  const candidates = await searchCandidates();
  console.log(`[indexer] found ${candidates.length} candidates`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const c of candidates) {
    try {
      const result = await processCandidate(c);
      if (result === "inserted") inserted++;
      else if (result === "skipped") skipped++;
    } catch (err) {
      failed++;
      console.warn(`[indexer] FAILED ${c.owner}/${c.repo}:${c.path} — ${(err as Error).message}`);
    }
  }

  console.log(`[indexer] done — inserted=${inserted} skipped=${skipped} failed=${failed}`);
}

// ---------- search ----------

async function searchCandidates(): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await gh.rest.search.code({
      q: SEARCH_QUERY,
      per_page: PER_PAGE,
      page,
    });
    for (const item of res.data.items) {
      out.push({
        owner: item.repository.owner.login,
        repo: item.repository.name,
        path: item.path,
        htmlUrl: item.html_url,
        repoHtmlUrl: item.repository.html_url,
      });
    }
    if (res.data.items.length < PER_PAGE) break; // no more pages
    await sleep(SEARCH_COOLDOWN_MS);
  }
  // Code search can return the same repo multiple times across pages; dedupe by (owner, repo, path).
  return dedupe(out, (c) => `${c.owner}/${c.repo}:${c.path}`);
}

// ---------- per-candidate ----------

async function processCandidate(c: Candidate): Promise<"inserted" | "skipped"> {
  // 1. Read SKILL.md content.
  const content = await fetchSkillMd(c);
  if (!content) return "skipped";

  // 2. Parse frontmatter.
  const fm = parseFrontmatter(content);
  if (!fm.name || !fm.description) {
    // Not a valid Anthropic-style skill manifest. Skip false positives.
    return "skipped";
  }

  // 3. Fetch repo metadata.
  const meta = await fetchRepoMeta(c.owner, c.repo);

  // 4. Build the row.
  const slug = makeSlug(c, fm);
  const listingRow = {
    slug,
    source_type: "github",
    source_url: c.repoHtmlUrl,
    skill_name: fm.name,
    description_excerpt: truncate(fm.description, 280),
    license_spdx: resolveSpdx(fm.license, meta.licenseSpdx),
    topics: meta.topics,
    category: null as string | null, // categorisation happens later, by hand or model
    last_indexed_at: new Date().toISOString(),
    last_modified_upstream_at: meta.lastModifiedUpstreamAt,
    status: "indexed",
  };

  // 5. Upsert listing.
  const { data: listing, error: listingErr } = await db
    .from("skill_listing")
    .upsert(listingRow, { onConflict: "slug" })
    .select("id")
    .single();

  if (listingErr || !listing) {
    throw new Error(`upsert skill_listing failed: ${listingErr?.message ?? "no row returned"}`);
  }

  // 6. Upsert signal.
  const signalRow = {
    skill_id: listing.id,
    stars: meta.stars,
    forks: meta.forks,
    install_count_estimate: 0,
    fetched_at: new Date().toISOString(),
  };
  const { error: signalErr } = await db
    .from("skill_signal")
    .upsert(signalRow, { onConflict: "skill_id" });

  if (signalErr) {
    throw new Error(`upsert skill_signal failed: ${signalErr.message}`);
  }

  console.log(`[indexer] ✓ ${slug}  ⭐ ${meta.stars}`);
  return "inserted";
}

// ---------- github helpers ----------

async function fetchSkillMd(c: Candidate): Promise<string | null> {
  try {
    const res = await gh.rest.repos.getContent({
      owner: c.owner,
      repo: c.repo,
      path: c.path,
      headers: { accept: "application/vnd.github.raw" },
    });
    // When using the raw media type Octokit returns the string body in res.data.
    if (typeof res.data === "string") return res.data;
    // Fallback: base64-encoded JSON shape.
    const anyData = res.data as { content?: string; encoding?: string };
    if (anyData.content && anyData.encoding === "base64") {
      return Buffer.from(anyData.content, "base64").toString("utf8");
    }
    return null;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

async function fetchRepoMeta(owner: string, repo: string): Promise<RepoMeta> {
  const res = await gh.rest.repos.get({ owner, repo });
  const r = res.data;
  return {
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    licenseSpdx: r.license?.spdx_id ?? null,
    topics: r.topics ?? [],
    lastModifiedUpstreamAt: r.pushed_at ?? r.updated_at ?? null,
  };
}

// ---------- parsing ----------

function parseFrontmatter(md: string): Frontmatter {
  try {
    const parsed = matter(md);
    const data = parsed.data as Frontmatter;
    return {
      name: typeof data.name === "string" ? data.name.trim() : undefined,
      description: typeof data.description === "string" ? data.description.trim() : undefined,
      license: typeof data.license === "string" ? data.license.trim() : undefined,
      version: typeof data.version === "string" ? data.version.trim() : undefined,
    };
  } catch {
    return {};
  }
}

// ---------- slug ----------

/**
 * Slug rules:
 *  - lowercase, kebab-case
 *  - prefix with owner + repo to avoid cross-publisher collisions
 *    (two publishers can both ship a skill named "pdf")
 *  - include the frontmatter name when present; fall back to the directory
 *    of the SKILL.md file (handles monorepos like vercel-labs/skills where
 *    every subdir has its own SKILL.md).
 */
function makeSlug(c: Candidate, fm: Frontmatter): string {
  const parts = c.path.split("/");
  const dir = parts.length > 1 ? parts[parts.length - 2] : "";
  const tail = fm.name ?? dir ?? "skill";
  const raw = `${c.owner}-${c.repo}-${tail}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// ---------- license resolution ----------

/**
 * Many SKILL.md authors use the `license:` frontmatter field as free text
 * ("Complete terms in LICENSE.txt", "Proprietary…") rather than as an SPDX
 * identifier. Only accept frontmatter values that look SPDX-shaped; otherwise
 * fall back to the repo-level SPDX (which GitHub's API computes for us).
 */
function resolveSpdx(fmLicense: string | undefined, repoSpdx: string | null): string | null {
  if (fmLicense && /^[A-Za-z0-9][A-Za-z0-9.\-+]{0,40}$/.test(fmLicense) && !fmLicense.includes(" ")) {
    return fmLicense;
  }
  return repoSpdx;
}

// ---------- utils ----------

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function dedupe<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- go ----------

main().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
