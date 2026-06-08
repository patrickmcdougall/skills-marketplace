/**
 * Cron: refresh GitHub profile data for all creator handles.
 *
 * Runs weekly (Sunday 2am UTC). Re-fetches any profile older than 6 days so
 * the full catalog refreshes every week. New handles (never fetched) are always
 * included. Stops at BUDGET_MS (240s) to stay within the 300s hard limit —
 * picks up where it left off on the next run.
 *
 * At 120ms per GitHub API call and CONCURRENCY=3, ~600 profiles fit per run.
 * The full catalog (~1,200 handles) completes in two weekly runs.
 *
 * Env vars:
 *   GITHUB_TOKEN         — GitHub personal access token (read-only public data)
 *   PROFILES_PER_RUN     — max profiles to fetch per run (default 600)
 */

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Octokit } from "@octokit/rest";

// ---------- auth ----------

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ---------- types ----------

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

// ---------- route ----------

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return Response.json({ error: "GITHUB_TOKEN not set" }, { status: 500 });
  }

  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;
  const BUDGET_MS = 240_000;
  const perRun = parseInt(process.env.PROFILES_PER_RUN ?? "600", 10);
  const STALE_DAYS = 6;

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const gh = new Octokit({ auth: token, userAgent: "claudinho-profiles/0.1" });

  // 1. Collect all distinct handles from skill_listing.
  const allHandles = await collectHandles(db);

  // 2. Filter to stale (older than STALE_DAYS) or never fetched.
  const toFetch = await filterStale(db, allHandles, STALE_DAYS);
  const queue = toFetch.slice(0, perRun);

  console.log(`[cron/sync-publisher-profiles] ${allHandles.length} total handles, ${toFetch.length} stale, processing ${queue.length}`);

  let ok = 0, failed = 0, skipped = 0;

  for (const handle of queue) {
    if (elapsed() > BUDGET_MS) { skipped = queue.length - ok - failed; break; }
    try {
      const profile = await fetchGitHubUser(gh, handle);
      await upsertProfile(db, profile);
      ok++;
    } catch {
      failed++;
    }
    // 120ms between calls — well within 5000 req/hr GitHub limit.
    await sleep(120);
  }

  const remaining = Math.max(0, toFetch.length - ok - failed);

  return Response.json({
    ok: true,
    elapsedMs: elapsed(),
    totalHandles: allHandles.length,
    processed: ok + failed,
    profilesOk: ok,
    profilesFailed: failed,
    skipped,
    remaining,
  });
}

// ---------- db ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function collectHandles(db: any): Promise<string[]> {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function filterStale(db: any, handles: string[], days: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await db
    .from("publisher_profile")
    .select("handle, fetched_at")
    .in("handle", handles);
  const fresh = new Set(
    ((data ?? []) as { handle: string; fetched_at: string }[])
      .filter(r => r.fetched_at > cutoff)
      .map(r => r.handle)
  );
  return handles.filter(h => !fresh.has(h));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertProfile(db: any, profile: Profile) {
  const { error } = await db
    .from("publisher_profile")
    .upsert({ ...profile, fetched_at: new Date().toISOString() }, { onConflict: "handle" });
  if (error) throw new Error(error.message);
}

// ---------- github ----------

async function fetchGitHubUser(gh: Octokit, handle: string): Promise<Profile> {
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

// ---------- utils ----------

function ownerFromUrl(url: string): string {
  try { return new URL(url).pathname.split("/").filter(Boolean)[0] ?? ""; }
  catch { return ""; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
