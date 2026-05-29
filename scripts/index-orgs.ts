/**
 * scripts/index-orgs.ts
 *
 * Claudinho — GitHub indexer, third pass (whole orgs)
 *
 * What this adds beyond index-curated.ts:
 *   index-curated.ts walks a hard-coded list of `owner/repo` entries. This
 *   pass walks every public, non-archived, non-fork repo under a given org
 *   and looks for SKILL.md files anywhere in the tree. Useful when you
 *   suspect an org publishes skills but don't know in which specific repo.
 *
 *   Repo metadata is cached per repo so we don't refetch when an org repo
 *   has multiple SKILL.md files.
 *
 * To add a new org: append to ORGS below.
 *
 * Run:
 *   npx tsx scripts/index-orgs.ts
 *
 * Cost: ~1 tree fetch per non-archived non-fork repo. Cloudflare has ~1.5k
 * repos so this takes a few minutes; expect most to yield zero matches.
 */

import { config as loadEnv } from "dotenv";
import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";
import matter from "gray-matter";

loadEnv({ path: ".env.local" });

// ---------- orgs ----------

const ORGS: string[] = [
  "anthropics",
  "vercel-labs",
  "cloudflare",
];

// ---------- config ----------

const USER_AGENT = "claudinho-indexer/0.1 (+claudinho.app)";
const PROGRESS_EVERY = 25; // log progress every N repos

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

type OrgRepo = {
  owner: string;
  repo: string;
  defaultBranch: string;
  htmlUrl: string;
  stars: number;
  forks: number;
  licenseSpdx: string | null;
  topics: string[];
  lastModifiedUpstreamAt: string | null;
};

type SkillFile = {
  owner: string;
  repo: string;
  path: string;
  repoHtmlUrl: string;
};

type Frontmatter = {
  name?: string;
  description?: string;
  license?: string;
  version?: string;
};

// ---------- main ----------

async function main() {
  console.log(`[orgs] start — ${ORGS.length} orgs in queue`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  let reposScanned = 0;
  let reposWithSkills = 0;

  for (const org of ORGS) {
    console.log(`\n[orgs] === ${org} ===`);

    let repos: OrgRepo[];
    try {
      repos = await listOrgRepos(org);
    } catch (err) {
      failed++;
      console.warn(`[orgs] FAILED to list ${org} repos — ${(err as Error).message}`);
      continue;
    }
    console.log(`[orgs] ${org} — ${repos.length} non-archived non-fork repos`);

    for (let i = 0; i < repos.length; i++) {
      const r = repos[i];
      reposScanned++;
      if ((i + 1) % PROGRESS_EVERY === 0) {
        console.log(`[orgs] ${org} — progress ${i + 1}/${repos.length}`);
      }

      let skillFiles: SkillFile[];
      try {
        skillFiles = await listSkillFiles(r);
      } catch (err) {
        // Most likely: empty repo, deleted between list and tree fetch, or rate limit.
        // Log and move on — one bad repo shouldn't kill the run.
        const msg = (err as Error).message;
        if (!msg.includes("Git Repository is empty")) {
          console.warn(`[orgs] tree FAIL ${r.owner}/${r.repo}: ${msg}`);
        }
        continue;
      }
      if (skillFiles.length === 0) continue;

      reposWithSkills++;
      console.log(`[orgs] ✦ ${r.owner}/${r.repo} — ${skillFiles.length} SKILL.md`);

      for (const f of skillFiles) {
        try {
          const result = await processSkillFile(f, r);
          if (result === "inserted") inserted++;
          else if (result === "skipped") skipped++;
        } catch (err) {
          failed++;
          console.warn(`[orgs] upsert FAIL ${f.path} — ${(err as Error).message}`);
        }
      }
    }
  }

  console.log(
    `\n[orgs] done — scanned=${reposScanned} reposWithSkills=${reposWithSkills} inserted=${inserted} skipped=${skipped} failed=${failed}`,
  );
}

// ---------- org listing ----------

async function listOrgRepos(org: string): Promise<OrgRepo[]> {
  const out: OrgRepo[] = [];
  let page = 1;
  while (true) {
    const res = await gh.rest.repos.listForOrg({
      org,
      type: "public",
      per_page: 100,
      page,
    });
    if (res.data.length === 0) break;
    for (const r of res.data) {
      if (r.archived) continue;
      if (r.fork) continue;
      out.push({
        owner: r.owner.login,
        repo: r.name,
        defaultBranch: r.default_branch ?? "main",
        htmlUrl: r.html_url,
        stars: r.stargazers_count ?? 0,
        forks: r.forks_count ?? 0,
        licenseSpdx: r.license?.spdx_id ?? null,
        topics: r.topics ?? [],
        lastModifiedUpstreamAt: r.pushed_at ?? r.updated_at ?? null,
      });
    }
    if (res.data.length < 100) break;
    page++;
  }
  return out;
}

// ---------- tree walk ----------

async function listSkillFiles(r: OrgRepo): Promise<SkillFile[]> {
  const res = await gh.rest.git.getTree({
    owner: r.owner,
    repo: r.repo,
    tree_sha: r.defaultBranch,
    recursive: "1",
  });
  if (res.data.truncated) {
    console.warn(`[orgs] WARNING: tree truncated for ${r.owner}/${r.repo} — some SKILL.md may be missed`);
  }
  const out: SkillFile[] = [];
  for (const entry of res.data.tree) {
    if (entry.type !== "blob" || !entry.path) continue;
    if (entry.path === "SKILL.md" || entry.path.endsWith("/SKILL.md")) {
      out.push({
        owner: r.owner,
        repo: r.repo,
        path: entry.path,
        repoHtmlUrl: r.htmlUrl,
      });
    }
  }
  return out;
}

// ---------- per-file processing ----------

async function processSkillFile(
  f: SkillFile,
  meta: OrgRepo,
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

  console.log(`[orgs]   ✓ ${slug}`);
  return "inserted";
}

// ---------- github helpers ----------

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

// ---------- license resolution ----------

function resolveSpdx(fmLicense: string | undefined, repoSpdx: string | null): string | null {
  if (fmLicense && /^[A-Za-z0-9][A-Za-z0-9.\-+]{0,40}$/.test(fmLicense) && !fmLicense.includes(" ")) {
    return fmLicense;
  }
  return repoSpdx;
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

// ---------- utils ----------

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

// ---------- go ----------

main().catch((err) => {
  console.error("[orgs] fatal:", err);
  process.exit(1);
});
