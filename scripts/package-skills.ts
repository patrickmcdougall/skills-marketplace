/**
 * scripts/package-skills.ts
 *
 * Batch-package skills into .skill bundles and upload to Supabase Storage.
 *
 * Usage:
 *   npx tsx scripts/package-skills.ts --all              # all skills with pending/failed bundles
 *   npx tsx scripts/package-skills.ts --limit 20         # top 20 by install count
 *   npx tsx scripts/package-skills.ts --ids slug1,slug2  # specific slugs
 *   npx tsx scripts/package-skills.ts --all --dry-run    # print what would be packaged
 *
 * Required env (in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GITHUB_TOKEN  (strongly recommended to avoid rate limits)
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { packageSkill } from "./lib/package-skill";

// ─── env ──────────────────────────────────────────────────────────────────────

const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");

function required(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing env: ${name}`); process.exit(1); }
  return v;
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string): string | null => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] ?? null : null;
};

const DRY_RUN = flag("--dry-run");
const IDS = opt("--ids")?.split(",").map((s) => s.trim()) ?? null;
const LIMIT = opt("--limit") ? parseInt(opt("--limit")!, 10) : null;
const ALL = flag("--all");

if (!ALL && !IDS && !LIMIT) {
  console.error("Usage: --all | --ids slug1,slug2 | --limit N  (add --dry-run to preview)");
  process.exit(1);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  type Row = { id: string; slug: string; source_url: string; skill_path: string | null; bundle_status: string | null };

  let query = db
    .from("skill_listing")
    .select("id, slug, source_url, skill_path, bundle_status")
    .eq("status", "indexed");

  if (IDS) {
    query = query.in("slug", IDS);
  } else if (!ALL) {
    // default: only pending/failed
    query = query.in("bundle_status", ["pending", "failed", null]);
  }

  if (LIMIT) {
    // Order by install count descending via join
    query = query.limit(LIMIT);
  }

  const { data, error } = await query;
  if (error) { console.error("DB error:", error.message); process.exit(1); }
  if (!data?.length) { console.log("Nothing to package."); return; }

  const rows = data as Row[];
  console.log(`[pkg] ${DRY_RUN ? "[DRY RUN] " : ""}packaging ${rows.length} skills…`);

  let ok = 0, sourceOnly = 0, failed = 0;
  for (const row of rows) {
    process.stdout.write(`  ${row.slug} … `);
    if (DRY_RUN) { console.log("(dry run)"); continue; }

    try {
      const result = await packageSkill({
        id: row.id,
        slug: row.slug,
        source_url: row.source_url,
        skill_path: row.skill_path,
      });

      if ("sourceOnly" in result) {
        await db.from("skill_listing").update({
          bundle_status: "source-only",
          distribution_mode: "source-only",
        }).eq("id", row.id);
        console.log("source-only");
        sourceOnly++;
      } else if ("failed" in result) {
        await db.from("skill_listing").update({
          bundle_status: "failed",
        }).eq("id", row.id);
        console.log(`FAILED — ${result.reason}`);
        failed++;
      } else {
        await db.from("skill_listing").update({
          bundle_url: result.bundleUrl,
          bundle_source_ref: result.sourceRef,
          bundle_status: "ready",
          bundle_packaged_at: new Date().toISOString(),
        }).eq("id", row.id);
        console.log(`ready → ${result.bundleUrl}`);
        ok++;
      }
    } catch (e) {
      console.log(`ERROR — ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }

    // Polite pacing to avoid hammering GitHub API
    await sleep(300);
  }

  console.log(`\n[pkg] done — ${ok} ready, ${sourceOnly} source-only, ${failed} failed`);
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

main().catch((e) => { console.error(e); process.exit(1); });
