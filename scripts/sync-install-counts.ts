/**
 * scripts/sync-install-counts.ts
 *
 * Claudinho — refresh install counts from skills.sh into our skill_signal table.
 *
 * Why this is separate from import-from-skillssh.ts:
 *   The importer adds new repos to curated-repos.txt with installs as
 *   comments. Those comment numbers go stale and nothing on the website
 *   reads them. This script writes the *current* install count into the
 *   skill_signal.install_count_estimate column for every skill we have
 *   that skills.sh also tracks. The website's "most installed" sort reads
 *   from that column.
 *
 *   Run this on a schedule (weekly is plenty — skills.sh updates daily but
 *   the deltas matter slowly). For now, on demand.
 *
 * What it does:
 *   1. Pulls the full skills.sh leaderboard via /api/v1/skills.
 *   2. For each entry, computes the slug we would have stored
 *      (`${owner}-${repo}-${slug}`, normalised the same way the indexer
 *      slugs).
 *   3. Looks up that slug in our skill_listing table.
 *   4. If matched, upserts skill_signal with the fresh install count
 *      (preserving stars/forks from the indexer).
 *
 * What it does NOT do:
 *   - Touch rows in skill_listing. Only skill_signal.install_count_estimate
 *     and fetched_at.
 *   - Reset install_count_estimate to 0 for skills.sh entries we can't
 *     match — there could be legitimate reasons (slug drift, frontmatter
 *     name vs. dir name mismatch). We log unmatched but don't act.
 *
 * Run:
 *   npx tsx scripts/sync-install-counts.ts
 *
 * Required env (in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SKILLSSH_API_KEY  (optional — request from skills-api@vercel.com if
 *                      the unauthenticated path stays 401-locked)
 */

import { config as loadEnv } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

// ---------- config ----------

const API_BASE = "https://skills.sh/api/v1";
const PER_PAGE = 500;
const MAX_PAGES = 30;
const SKILLSSH_API_KEY = process.env.SKILLSSH_API_KEY;
const REQUEST_GAP_MS = SKILLSSH_API_KEY ? 150 : 1100;
const USER_AGENT = "claudinho-sync/0.1 (+claudinho.app)";

// ---------- env ----------

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

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- types ----------

type SkillV1 = {
  id: string;
  slug: string;
  name?: string;
  source: string;
  installs: number;
  sourceType?: "github" | "well-known";
  isDuplicate?: boolean;
};

type LeaderboardResponse = {
  data: SkillV1[];
  pagination: { page: number; perPage: number; total: number; hasMore: boolean };
};

type OurSkill = { id: string; slug: string };

// ---------- main ----------

async function main() {
  const fromSkillssh = await loadSkills();
  console.log(`[sync] loaded ${fromSkillssh.length} skills from skills.sh`);

  console.log("[sync] loading our skill_listing slugs…");
  const ours = await loadOurSkills();
  console.log(`[sync] we have ${ours.size} skills in skill_listing`);

  // Walk skills.sh entries, match by computed slug, update skill_signal.
  let matched = 0;
  let unmatched = 0;
  const unmatchedExamples: string[] = [];
  const updates: { skill_id: string; installs: number }[] = [];

  for (const s of fromSkillssh) {
    if ((s.sourceType ?? "github") !== "github" || s.isDuplicate) continue;
    const candidateSlug = makeOurSlug(s);
    const ourId = ours.get(candidateSlug);
    if (!ourId) {
      unmatched++;
      if (unmatchedExamples.length < 10) {
        unmatchedExamples.push(`${candidateSlug} (skills.sh id: ${s.id})`);
      }
      continue;
    }
    matched++;
    updates.push({ skill_id: ourId, installs: s.installs });
  }

  console.log(`[sync] matched ${matched} / ${fromSkillssh.length} skills.sh entries to our catalog`);
  if (unmatched > 0) {
    console.log(`[sync] ${unmatched} unmatched (probably frontmatter name vs. dir name drift). First 10:`);
    for (const ex of unmatchedExamples) console.log(`  - ${ex}`);
  }

  if (updates.length === 0) {
    console.log("[sync] nothing to write. exiting.");
    return;
  }

  console.log(`[sync] writing ${updates.length} install_count_estimate updates…`);
  const now = new Date().toISOString();

  // Supabase has no native bulk UPDATE, but it has UPSERT. We don't want to
  // wipe stars/forks, so we do per-row UPDATE in batches.
  const BATCH = 200;
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    await Promise.all(
      batch.map((u) =>
        db
          .from("skill_signal")
          .update({ install_count_estimate: u.installs, fetched_at: now })
          .eq("skill_id", u.skill_id),
      ),
    );
    written += batch.length;
    console.log(`[sync] wrote ${written}/${updates.length}`);
  }

  console.log(`[sync] done — wrote install counts for ${written} skills.`);
}

// ---------- data source ----------

async function loadSkills(): Promise<SkillV1[]> {
  if (SKILLSSH_API_KEY) {
    console.log("[sync] using live API (SKILLSSH_API_KEY set)");
    return await fetchAllSkills();
  }
  const snapshotPath = resolve(process.cwd(), "scripts/skillssh-snapshot.json");
  if (!existsSync(snapshotPath)) {
    throw new Error(
      "No SKILLSSH_API_KEY in .env.local and no scripts/skillssh-snapshot.json on disk. " +
        "Run `npx tsx scripts/scrape-skillssh.ts` first, or get a key from skills-api@vercel.com.",
    );
  }
  console.log("[sync] using snapshot from scripts/skillssh-snapshot.json");
  const raw = readFileSync(snapshotPath, "utf8");
  const snap = JSON.parse(raw) as { skills: SkillV1[] };
  return snap.skills;
}

// ---------- skills.sh ----------

async function fetchAllSkills(): Promise<SkillV1[]> {
  const out: SkillV1[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${API_BASE}/skills?view=all-time&per_page=${PER_PAGE}&page=${page}`;
    const res = await fetch(url, { headers: buildHeaders() });
    if (res.status === 401) {
      throw new Error(
        "skills.sh returned 401 Unauthorized. Their docs say public endpoints don't need auth, " +
          "but in practice this one does. Email skills-api@vercel.com for an API key, then add SKILLSSH_API_KEY=... to .env.local and retry.",
      );
    }
    if (!res.ok) {
      throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as LeaderboardResponse;
    out.push(...body.data);
    console.log(`[sync] page ${page}: +${body.data.length} (running total ${out.length}/${body.pagination.total})`);
    if (!body.pagination.hasMore) break;
    await sleep(REQUEST_GAP_MS);
  }
  return out;
}

function buildHeaders(): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": USER_AGENT, accept: "application/json" };
  if (SKILLSSH_API_KEY) h["Authorization"] = `Bearer ${SKILLSSH_API_KEY}`;
  return h;
}

// ---------- supabase ----------

async function loadOurSkills(): Promise<Map<string, string>> {
  // Paginate — Supabase caps at 1000 per request by default.
  const out = new Map<string, string>();
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await db
      .from("skill_listing")
      .select("id, slug")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`skill_listing read failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data as OurSkill[]) out.set(row.slug, row.id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

// ---------- slug ----------

/**
 * Build the slug we would have stored, given a skills.sh entry.
 *
 * Mirrors the makeSlug() logic in index-curated.ts / index-orgs.ts:
 *   slug = `${owner}-${repo}-${name||dir}`, lowercased, non-alphanumeric
 *   replaced with `-`, dashes collapsed.
 *
 * skills.sh's `source` is `owner/repo` and `slug` is the skill identifier
 * (matches the frontmatter `name` or the SKILL.md directory name in the
 * common case). So owner/repo/slug → owner-repo-slug.
 */
function makeOurSlug(s: SkillV1): string {
  const raw = `${s.source.replace("/", "-")}-${s.slug}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// ---------- utils ----------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- go ----------

main().catch((err) => {
  console.error("[sync] fatal:", err);
  process.exit(1);
});
