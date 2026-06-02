/**
 * scripts/sync-repo-info.ts
 *
 * Fetch GitHub repo metadata (name, description, stars) for every distinct
 * skills repo in skill_listing, then upsert into repo_info.
 *
 * Run:
 *   npx tsx scripts/sync-repo-info.ts              # all repos
 *   npx tsx scripts/sync-repo-info.ts --only obra/superpowers,garrytan/gstack
 *   npx tsx scripts/sync-repo-info.ts --stale 7    # refresh >7 days old
 *
 * Required env: GITHUB_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config as loadEnv } from "dotenv";
import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

const argv = process.argv.slice(2);
const ONLY: string[] | null = (() => {
  const i = argv.indexOf("--only");
  return i >= 0 ? (argv[i + 1] ?? "").split(",").map(s => s.trim()).filter(Boolean) : null;
})();
const STALE_DAYS: number | null = (() => {
  const i = argv.indexOf("--stale");
  return i >= 0 ? parseInt(argv[i + 1] ?? "7", 10) : null;
})();

function required(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing env: ${name}`); process.exit(1); }
  return v;
}

const gh = new Octokit({ auth: required("GITHUB_TOKEN"), userAgent: "claudinho-repo-info/0.1" });
const db = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

async function main() {
  const repoPaths = await collectRepoPaths();
  const queue = ONLY ? repoPaths.filter(r => ONLY.includes(r)) : repoPaths;
  const toFetch = STALE_DAYS != null ? await filterStale(queue, STALE_DAYS) : queue;

  if (ONLY) console.log(`[repo-info] --only: ${ONLY.join(", ")}`);
  console.log(`[repo-info] ${queue.length} repos total, ${toFetch.length} to fetch`);

  let ok = 0, failed = 0;
  for (const repoPath of toFetch) {
    const [owner, repo] = repoPath.split("/");
    try {
      const { data } = await gh.rest.repos.get({ owner, repo });
      await db.from("repo_info").upsert({
        repo_path: repoPath,
        name: data.name,
        description: data.description ?? null,
        stars: data.stargazers_count,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "repo_path" });
      console.log(`[repo-info] ✓ ${repoPath} — ${data.stargazers_count.toLocaleString()} ★ — ${data.description?.slice(0, 60) ?? "(no description)"}`);
      ok++;
    } catch (err) {
      console.warn(`[repo-info] ✗ ${repoPath} — ${(err as Error).message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`\n[repo-info] done — ok=${ok} failed=${failed}`);
}

async function collectRepoPaths(): Promise<string[]> {
  const seen = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await db.from("skill_listing").select("source_url").eq("status", "indexed").range(from, from + 999);
    if (error || !data?.length) break;
    for (const row of data as { source_url: string }[]) {
      try {
        const parts = new URL(row.source_url).pathname.split("/").filter(Boolean);
        if (parts.length >= 2) seen.add(`${parts[0]}/${parts[1]}`);
      } catch {}
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  return [...seen].sort();
}

async function filterStale(paths: string[], days: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await db.from("repo_info").select("repo_path, fetched_at").in("repo_path", paths);
  const fresh = new Set((data ?? []).filter((r: { fetched_at: string }) => r.fetched_at > cutoff).map((r: { repo_path: string }) => r.repo_path));
  return paths.filter(p => !fresh.has(p));
}

main().catch(err => { console.error(err); process.exit(1); });
