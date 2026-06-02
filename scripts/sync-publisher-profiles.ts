/**
 * scripts/sync-publisher-profiles.ts
 *
 * Fetch GitHub profile data (name, bio, company, blog, twitter) for every
 * distinct publisher handle found in skill_listing, then upsert into the
 * publisher_profile table.
 *
 * Run:
 *   npx tsx scripts/sync-publisher-profiles.ts             # all handles
 *   npx tsx scripts/sync-publisher-profiles.ts --only obra,garrytan
 *   npx tsx scripts/sync-publisher-profiles.ts --stale 7   # re-fetch >7 days old
 *
 * Required env (.env.local):
 *   GITHUB_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config as loadEnv } from "dotenv";
import { Octokit } from "@octokit/rest";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

// ---------- flags ----------

const argv = process.argv.slice(2);
const ONLY_HANDLES: string[] | null = (() => {
  const i = argv.indexOf("--only");
  return i >= 0 ? (argv[i + 1] ?? "").split(",").map(s => s.trim()).filter(Boolean) : null;
})();
const STALE_DAYS: number | null = (() => {
  const i = argv.indexOf("--stale");
  return i >= 0 ? parseInt(argv[i + 1] ?? "7", 10) : null;
})();

// ---------- env ----------

function required(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing env: ${name}`); process.exit(1); }
  return v;
}
const GITHUB_TOKEN = required("GITHUB_TOKEN");
const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");

// ---------- clients ----------

const gh = new Octokit({ auth: GITHUB_TOKEN, userAgent: "claudinho-profiles/0.1" });
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ---------- main ----------

async function main() {
  // 1. Collect all distinct handles from skill_listing.
  const handles = await collectHandles();
  const queue = ONLY_HANDLES
    ? handles.filter(h => ONLY_HANDLES.includes(h))
    : handles;

  if (ONLY_HANDLES) console.log(`[profiles] --only: ${ONLY_HANDLES.join(", ")}`);
  console.log(`[profiles] ${queue.length} handles to sync`);

  // 2. If --stale, skip handles fetched recently.
  const toFetch = STALE_DAYS != null ? await filterStale(queue, STALE_DAYS) : queue;
  console.log(`[profiles] ${toFetch.length} handles need fetching`);

  let ok = 0, failed = 0;
  for (const handle of toFetch) {
    try {
      const profile = await fetchGitHubUser(handle);
      await upsert(profile);
      console.log(`[profiles] ✓ ${handle}${profile.display_name ? ` (${profile.display_name})` : ""}`);
      ok++;
    } catch (err) {
      console.warn(`[profiles] ✗ ${handle} — ${(err as Error).message}`);
      failed++;
    }
    // GitHub REST API: 5000 req/hr authenticated — no need to throttle heavily.
    await sleep(120);
  }

  console.log(`\n[profiles] done — ok=${ok} failed=${failed}`);
}

// ---------- helpers ----------

async function collectHandles(): Promise<string[]> {
  const seen = new Set<string>();
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await db
      .from("skill_listing")
      .select("source_url")
      .eq("status", "indexed")
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    for (const row of data as { source_url: string }[]) {
      const handle = ownerFromUrl(row.source_url);
      if (handle) seen.add(handle.toLowerCase());
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return [...seen].sort();
}

async function filterStale(handles: string[], days: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await db
    .from("publisher_profile")
    .select("handle, fetched_at")
    .in("handle", handles);
  const fresh = new Set(
    (data ?? [])
      .filter((r: { handle: string; fetched_at: string }) => r.fetched_at > cutoff)
      .map((r: { handle: string }) => r.handle)
  );
  return handles.filter(h => !fresh.has(h));
}

type Profile = {
  handle: string;
  display_name: string | null;
  bio: string | null;
  company: string | null;
  blog: string | null;
  twitter_username: string | null;
  avatar_url: string | null;
  gh_followers: number | null;
  location: string | null;
};

async function fetchGitHubUser(handle: string): Promise<Profile> {
  const { data } = await gh.rest.users.getByUsername({ username: handle });
  return {
    handle: handle.toLowerCase(),
    display_name: data.name ?? null,
    bio: data.bio ?? null,
    company: data.company ? data.company.replace(/^@/, "").trim() : null,
    blog: data.blog ?? null,
    twitter_username: data.twitter_username ?? null,
    avatar_url: data.avatar_url ?? null,
    gh_followers: data.followers ?? null,
    location: data.location ?? null,
  };
}

async function upsert(profile: Profile) {
  const { error } = await db
    .from("publisher_profile")
    .upsert({ ...profile, fetched_at: new Date().toISOString() }, { onConflict: "handle" });
  if (error) throw new Error(error.message);
}

function ownerFromUrl(url: string): string {
  try { return new URL(url).pathname.split("/").filter(Boolean)[0] ?? ""; }
  catch { return ""; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => { console.error(err); process.exit(1); });
