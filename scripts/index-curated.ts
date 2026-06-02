/**
 * scripts/index-curated.ts
 *
 * Claudinho — GitHub indexer, second pass (curated monorepos)
 *
 * Why this exists:
 *   The first pass (`index-skills.ts`) uses GitHub Code Search for
 *   `path:SKILL.md`. Code Search has well-known coverage gaps — newer
 *   repos, large monorepos, and recently-pushed files often aren't
 *   indexed. The first run missed `anthropics/skills` entirely.
 *
 *   This pass walks a hard-coded list of known good monorepos using the
 *   Git Trees API. One API call per repo returns the full tree; we filter
 *   for SKILL.md files and process them with the same upsert logic.
 *
 * To add a new monorepo: append it to CURATED_REPOS below.
 *
 * Run:
 *   npx tsx scripts/index-curated.ts
 */

import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";
import matter from "gray-matter";

loadEnv({ path: ".env.local" });

// ---------- curated list ----------

/**
 * Hard-coded list of monorepos that contain Anthropic-style SKILL.md files
 * organised as `path/to/{skill-name}/SKILL.md`.
 *
 * Each entry is just `owner/repo`. Branch is auto-detected (defaults to the
 * repo's default branch). Add new ones over time.
 */
/**
 * Source of truth for the curated list is `scripts/curated-repos.txt`.
 * To add a repo: append a line to that file. Comments start with `#`.
 * Blank lines are ignored. Anything that doesn't match `owner/repo` is skipped.
 *
 * Historical notes (publishers we deliberately don't include):
 *   - ComposioHQ/awesome-claude-skills — 842 rows on first index, ~800 of which
 *     were auto-generated `connect-apps/*` MCP recipes; dropped wholesale
 *     (2026-05-29).
 *   - K-Dense-AI/claude-scientific-skills — claims 125+, would dominate.
 *   - raintree-technology/claude-starter — claims 40, similar risk.
 */
const CURATED_REPOS: string[] = loadCuratedRepos();

function loadCuratedRepos(): string[] {
  const path = resolve(process.cwd(), "scripts/curated-repos.txt");
  const raw = readFileSync(path, "utf8");
  const out: string[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    // Strip trailing inline comments (e.g. `owner/repo  # 12,345 installs`).
    const noComment = rawLine.replace(/\s+#.*$/, "");
    const trimmed = noComment.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9\-_.]*\/[A-Za-z0-9][A-Za-z0-9\-_.]*$/.test(trimmed)) {
      console.warn(`[curated] skipping malformed line: "${rawLine}"`);
      continue;
    }
    out.push(trimmed);
  }
  // Dedupe while preserving order.
  return Array.from(new Set(out));
}

// ---------- flags ----------

const _argv = process.argv.slice(2);
const _onlyIdx = _argv.indexOf("--only");
const ONLY_SLUGS: string[] | null = _onlyIdx >= 0
  ? (_argv[_onlyIdx + 1] ?? "").split(",").map(s => s.trim()).filter(Boolean)
  : null;
const FORCE = _argv.includes("--force"); // bypass size cap (use with --only on known skill repos)

// ---------- config ----------

const USER_AGENT = "claudinho-indexer/0.1 (+claudinho.app)";
// Repos larger than this skip the tree walk and get logged as oversized.
// Massive monorepos like facebook/react or pytorch/pytorch hit truncation
// before we'd find anything useful anyway, and walking them is wasteful.
// Tweak if a legit skill monorepo ever crosses this threshold.
const MAX_REPO_SIZE_KB = 50_000; // 50 MB

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

type SkillFile = {
  owner: string;
  repo: string;
  path: string;         // e.g. "skills/pdf/SKILL.md"
  repoHtmlUrl: string;  // https://github.com/anthropics/skills
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
  lastModifiedUpstreamAt: string | null;
  defaultBranch: string;
  htmlUrl: string;
  sizeKb: number;
};

// ---------- main ----------

async function main() {
  const queue = ONLY_SLUGS ? CURATED_REPOS.filter(r => ONLY_SLUGS.includes(r)) : CURATED_REPOS;
  if (ONLY_SLUGS) console.log(`[curated] --only filter: ${ONLY_SLUGS.join(", ")}`);
  console.log(`[curated] start — ${queue.length} repos in queue`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  // Per-repo screening report — written to disk at the end so Patrick can
  // prune curated-repos.txt without re-reading the whole log.
  const empty: string[] = [];      // 0 SKILL.md files found
  const oversized: string[] = [];  // skipped — over MAX_REPO_SIZE_KB
  const errored: string[] = [];    // tree/meta fetch failed
  const productive: { repo: string; skills: number }[] = []; // ≥1 inserted

  for (const slug of queue) {
    const [owner, repo] = slug.split("/");
    if (!owner || !repo) {
      console.warn(`[curated] skipping malformed entry: "${slug}"`);
      continue;
    }

    console.log(`\n[curated] === ${owner}/${repo} ===`);

    let meta: RepoMeta;
    try {
      meta = await fetchRepoMeta(owner, repo);
    } catch (err) {
      failed++;
      errored.push(`${slug}  (meta fetch failed: ${(err as Error).message})`);
      console.warn(`[curated] FAILED to fetch repo meta — ${(err as Error).message}`);
      continue;
    }

    // Screen 1 — repo size. Massive monorepos (react, pytorch) hit tree
    // truncation and rarely have SKILL.md anyway.
    if (meta.sizeKb > MAX_REPO_SIZE_KB && !FORCE) {
      oversized.push(`${slug}  (${(meta.sizeKb / 1000).toFixed(1)} MB — over ${MAX_REPO_SIZE_KB / 1000} MB cap)`);
      console.log(`[curated] SKIP — repo too large (${(meta.sizeKb / 1000).toFixed(1)} MB) — use --force to override`);
      continue;
    }

    let skillFiles: SkillFile[];
    try {
      skillFiles = await listSkillFiles(owner, repo, meta.defaultBranch, meta.htmlUrl);
    } catch (err) {
      failed++;
      errored.push(`${slug}  (tree fetch failed: ${(err as Error).message})`);
      console.warn(`[curated] FAILED to list tree — ${(err as Error).message}`);
      continue;
    }

    // Screen 2 — explicit zero-result handling.
    if (skillFiles.length === 0) {
      empty.push(slug);
      console.log(`[curated] no SKILL.md found — skipping`);
      continue;
    }

    console.log(`[curated] found ${skillFiles.length} SKILL.md files`);

    let repoInserted = 0;
    for (const f of skillFiles) {
      try {
        const result = await processSkillFile(f, meta);
        if (result === "inserted") {
          inserted++;
          repoInserted++;
        } else if (result === "skipped") {
          skipped++;
        }
      } catch (err) {
        failed++;
        console.warn(`[curated] FAILED ${f.path} — ${(err as Error).message}`);
      }
    }
    if (repoInserted > 0) {
      productive.push({ repo: slug, skills: repoInserted });
    } else {
      // Found SKILL.md but every one was a false positive (invalid frontmatter).
      empty.push(`${slug}  (had ${skillFiles.length} SKILL.md, all invalid frontmatter)`);
    }
  }

  console.log(`\n[curated] done — inserted=${inserted} skipped=${skipped} failed=${failed}`);
  console.log(`[curated] productive: ${productive.length} repos · empty: ${empty.length} · oversized: ${oversized.length} · errored: ${errored.length}`);

  writeReport(productive, empty, oversized, errored);
  console.log(`[curated] report written to scripts/curated-repos-report.txt`);
}

function writeReport(
  productive: { repo: string; skills: number }[],
  empty: string[],
  oversized: string[],
  errored: string[],
) {
  const lines: string[] = [];
  lines.push("# Claudinho — curated indexer report");
  lines.push(`# Generated ${new Date().toISOString()}`);
  lines.push("");

  lines.push(`## Productive (${productive.length}) — keep`);
  for (const p of productive.sort((a, b) => b.skills - a.skills)) {
    lines.push(`  ${p.skills.toString().padStart(4)}  ${p.repo}`);
  }
  lines.push("");

  lines.push(`## Empty (${empty.length}) — consider pruning from curated-repos.txt`);
  for (const e of empty) lines.push(`  ${e}`);
  lines.push("");

  lines.push(`## Oversized (${oversized.length}) — too large to scan, skipped`);
  for (const o of oversized) lines.push(`  ${o}`);
  lines.push("");

  lines.push(`## Errored (${errored.length}) — repo may be private/deleted/renamed`);
  for (const e of errored) lines.push(`  ${e}`);
  lines.push("");

  writeFileSync(resolve(process.cwd(), "scripts/curated-repos-report.txt"), lines.join("\n"));
}

// ---------- tree walk ----------

async function listSkillFiles(
  owner: string,
  repo: string,
  branch: string,
  repoHtmlUrl: string,
): Promise<SkillFile[]> {
  const res = await gh.rest.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: "1",
  });
  if (res.data.truncated) {
    // Trees API truncates beyond ~100k entries. Unlikely for skill monorepos,
    // but log it so we know to revisit if it ever happens.
    console.warn(`[curated] WARNING: tree truncated for ${owner}/${repo}`);
  }
  const out: SkillFile[] = [];
  for (const entry of res.data.tree) {
    if (entry.type !== "blob" || !entry.path) continue;
    if (entry.path === "SKILL.md" || entry.path.endsWith("/SKILL.md")) {
      out.push({
        owner,
        repo,
        path: entry.path,
        repoHtmlUrl,
      });
    }
  }
  return out;
}

// ---------- per-file processing ----------

async function processSkillFile(
  f: SkillFile,
  meta: RepoMeta,
): Promise<"inserted" | "skipped"> {
  const content = await fetchSkillMd(f);
  if (!content) return "skipped";

  const fm = parseFrontmatter(content);
  if (!fm.name || !fm.description) return "skipped";

  const slug = makeSlug(f, fm);

  const listingRow = {
    slug,
    source_type: "github",
    source_url: f.repoHtmlUrl,
    skill_name: fm.name,
    description_excerpt: truncate(fm.description, 280),
    license_spdx: resolveSpdx(fm.license, meta.licenseSpdx),
    topics: meta.topics,
    category: null as string | null,
    last_indexed_at: new Date().toISOString(),
    last_modified_upstream_at: meta.lastModifiedUpstreamAt,
    status: "indexed",
  };

  const { data: listing, error: listingErr } = await db
    .from("skill_listing")
    .upsert(listingRow, { onConflict: "slug" })
    .select("id")
    .single();

  if (listingErr || !listing) {
    throw new Error(`upsert skill_listing failed: ${listingErr?.message ?? "no row returned"}`);
  }

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

  console.log(`[curated] ✓ ${slug}  ⭐ ${meta.stars}`);
  return "inserted";
}

// ---------- github helpers ----------

async function fetchRepoMeta(owner: string, repo: string): Promise<RepoMeta> {
  const res = await gh.rest.repos.get({ owner, repo });
  const r = res.data;
  return {
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    licenseSpdx: r.license?.spdx_id ?? null,
    topics: r.topics ?? [],
    lastModifiedUpstreamAt: r.pushed_at ?? r.updated_at ?? null,
    defaultBranch: r.default_branch,
    htmlUrl: r.html_url,
    sizeKb: r.size ?? 0,
  };
}

async function fetchSkillMd(f: SkillFile): Promise<string | null> {
  try {
    const res = await gh.rest.repos.getContent({
      owner: f.owner,
      repo: f.repo,
      path: f.path,
      headers: { accept: "application/vnd.github.raw" },
    });
    if (typeof res.data === "string") return res.data;
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

function makeSlug(f: SkillFile, fm: Frontmatter): string {
  const parts = f.path.split("/");
  const dir = parts.length > 1 ? parts[parts.length - 2] : "";
  const tail = fm.name ?? dir ?? "skill";
  const raw = `${f.owner}-${f.repo}-${tail}`;
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
 * fall back to the repo-level SPDX.
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

// ---------- go ----------

main().catch((err) => {
  console.error("[curated] fatal:", err);
  process.exit(1);
});
