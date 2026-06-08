/**
 * scripts/audit-coverage.ts
 *
 * Comprehensive audit-coverage analysis and fix script.
 *
 * Step 1 — Current state snapshot
 * Step 2 — Analyse remaining nulls by repo
 * Step 3 — Fix siblings of linked skills (infer skillssh_id from confirmed pattern)
 * Step 4 — Remaining nulls with no linked siblings
 * Step 5 — Summary
 *
 * Run: npx tsx scripts/audit-coverage.ts
 * Dry-run (no writes): npx tsx scripts/audit-coverage.ts --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// ─── types ────────────────────────────────────────────────────────────────────

type SkillRow = {
  id: string;
  slug: string;
  skill_name: string | null;
  source_url: string | null;
  skillssh_id: string | null;
};

type RepoStats = {
  source_url: string;
  total: number;
  unlinked: number;
  linked: number;
  /** Example skillssh_id from a linked sibling (null if no linked siblings) */
  sibling_id: string | null;
  /** The common prefix (owner/repo) derived from the sibling */
  id_prefix: string | null;
  /** Unlinked skill rows for this repo */
  unlinked_skills: SkillRow[];
  /** Total install count across ALL skills in this repo */
  total_installs: number;
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function hr(char = "─", width = 80): string {
  return char.repeat(width);
}

function pct(num: number, denom: number): string {
  if (denom === 0) return "0%";
  return `${Math.round((num / denom) * 100)}%`;
}

/** Paginate through a Supabase query and return all rows */
async function fetchAll<T>(
  builder: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const all: T[] = [];
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await builder(from, from + PAGE - 1);
    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) {
    console.log("[audit-coverage] DRY RUN — no writes will be made\n");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Current state snapshot
  // ══════════════════════════════════════════════════════════════════════════
  console.log(hr("═"));
  console.log("STEP 1 — Current State Snapshot");
  console.log(hr("═"));

  // 1a. Total skills
  const { count: totalCount } = await db
    .from("skill_listing")
    .select("id", { count: "exact", head: true });

  // 1b. Skills with skillssh_id set
  const { count: withIdCount } = await db
    .from("skill_listing")
    .select("id", { count: "exact", head: true })
    .not("skillssh_id", "is", null);

  // 1c. Skills with skillssh_id null
  const { count: nullIdCount } = await db
    .from("skill_listing")
    .select("id", { count: "exact", head: true })
    .is("skillssh_id", null);

  // 1d. Skills with at least 1 audit row
  // We do this by getting distinct skill_ids from skill_audit
  const auditedSkillIds = new Set<string>();
  {
    let from = 0;
    const PAGE = 1000;
    for (;;) {
      const { data, error } = await db
        .from("skill_audit")
        .select("skill_id")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`skill_audit read error: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const row of data as { skill_id: string }[]) auditedSkillIds.add(row.skill_id);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }
  const auditedCount = auditedSkillIds.size;

  // 1e. Skills with skillssh_id set but ZERO audit rows
  const skillsWithId = await fetchAll<{ id: string; skillssh_id: string }>(
    (from, to) =>
      db
        .from("skill_listing")
        .select("id, skillssh_id")
        .not("skillssh_id", "is", null)
        .range(from, to)
  );
  const linkedButUnaudited = skillsWithId.filter((s) => !auditedSkillIds.has(s.id)).length;

  const total = totalCount ?? 0;
  const withId = withIdCount ?? 0;
  const nullId = nullIdCount ?? 0;

  console.log(`\nTotal skills in skill_listing:       ${total.toLocaleString()}`);
  console.log(`  With skillssh_id set:              ${withId.toLocaleString()} (${pct(withId, total)})`);
  console.log(`  With skillssh_id NULL:             ${nullId.toLocaleString()} (${pct(nullId, total)})`);
  console.log(`\nAudit coverage:`);
  console.log(`  Skills with ≥1 audit row:          ${auditedCount.toLocaleString()} (${pct(auditedCount, total)})`);
  console.log(`  Skills with no audit rows:         ${(total - auditedCount).toLocaleString()}`);
  console.log(`\nLinked but not yet audited:`);
  console.log(`  Have skillssh_id, ZERO audits:     ${linkedButUnaudited.toLocaleString()} (will be fixed by next cron run)`);

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Analyse the remaining nulls
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + hr("═"));
  console.log("STEP 2 — Analyse Remaining Nulls (grouped by repo)");
  console.log(hr("═"));

  // Load ALL skills (need both linked and unlinked to cross-reference)
  console.log("\nLoading all skills...");
  const allSkills = await fetchAll<SkillRow>((from, to) =>
    db
      .from("skill_listing")
      .select("id, slug, skill_name, source_url, skillssh_id")
      .range(from, to)
  );
  console.log(`Loaded ${allSkills.length.toLocaleString()} skills.`);

  // Load install counts (from skill_signal, keyed by skill_id)
  const installMap = new Map<string, number>();
  {
    const signalData = await fetchAll<{ skill_id: string; install_count_estimate: number | null }>(
      (from, to) =>
        db
          .from("skill_signal")
          .select("skill_id, install_count_estimate")
          .range(from, to)
    );
    for (const row of signalData) {
      if (row.install_count_estimate != null) installMap.set(row.skill_id, row.install_count_estimate);
    }
  }

  // Group by source_url
  const repoMap = new Map<string, RepoStats>();

  for (const skill of allSkills) {
    const repoUrl = skill.source_url ?? "__unknown__";
    if (!repoMap.has(repoUrl)) {
      repoMap.set(repoUrl, {
        source_url: repoUrl,
        total: 0,
        unlinked: 0,
        linked: 0,
        sibling_id: null,
        id_prefix: null,
        unlinked_skills: [],
        total_installs: 0,
      });
    }
    const repo = repoMap.get(repoUrl)!;
    repo.total++;
    repo.total_installs += installMap.get(skill.id) ?? 0;

    if (skill.skillssh_id) {
      repo.linked++;
      if (!repo.sibling_id) {
        repo.sibling_id = skill.skillssh_id;
        // Derive prefix: everything before the last "/"
        const parts = skill.skillssh_id.split("/");
        repo.id_prefix = parts.length >= 2 ? parts.slice(0, -1).join("/") : null;
      }
    } else {
      repo.unlinked++;
      repo.unlinked_skills.push(skill);
    }
  }

  // Filter repos that have unlinked skills
  const reposWithUnlinked = [...repoMap.values()].filter((r) => r.unlinked > 0);
  const reposWithSiblings = reposWithUnlinked.filter((r) => r.sibling_id !== null);
  const reposNoSiblings = reposWithUnlinked.filter((r) => r.sibling_id === null);

  console.log(`\nRepos with at least one unlinked skill: ${reposWithUnlinked.length.toLocaleString()}`);
  console.log(`  Repos with a linked sibling (fixable): ${reposWithSiblings.length.toLocaleString()}`);
  console.log(`  Repos with NO linked sibling (manual):  ${reposNoSiblings.length.toLocaleString()}`);

  // Top 20 repos with unlinked skills
  const top20Unlinked = reposWithUnlinked
    .sort((a, b) => b.unlinked - a.unlinked)
    .slice(0, 20);

  console.log("\n" + hr("─"));
  console.log("Top 20 Repos With Unlinked Skills");
  console.log(hr("─"));
  console.log(
    `${"Repo URL".padEnd(55)} ${"Unlinked".padStart(8)} ${"Sibling?".padStart(10)}  Example ID`
  );
  console.log(hr("─"));

  for (const repo of top20Unlinked) {
    const hasSibling = repo.sibling_id !== null;
    const example = hasSibling ? repo.sibling_id!.slice(0, 40) : "(none)";
    console.log(
      `${repo.source_url.slice(0, 54).padEnd(55)} ${String(repo.unlinked).padStart(8)} ${(hasSibling ? "YES" : "no").padStart(10)}  ${example}`
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Fix siblings of linked skills
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + hr("═"));
  console.log("STEP 3 — Fix Siblings of Linked Skills");
  console.log(hr("═"));

  // Build the list of candidate (skill_id, inferred_skillssh_id) pairs
  type Fix = { id: string; slug: string; skillssh_id: string; skillssh_url: string };
  type DupeRow = { id: string; slug: string; inferredId: string; conflictSlug: string };

  const candidates: Fix[] = [];

  for (const repo of reposWithSiblings) {
    if (!repo.id_prefix) continue;
    for (const skill of repo.unlinked_skills) {
      if (!skill.skill_name) continue;
      const inferredId = `${repo.id_prefix}/${skill.skill_name}`;
      const inferredUrl = `https://www.skills.sh/${inferredId}`;
      candidates.push({ id: skill.id, slug: skill.slug, skillssh_id: inferredId, skillssh_url: inferredUrl });
    }
  }

  console.log(`\nCandidate inferences from sibling patterns: ${candidates.length.toLocaleString()}`);

  // Pre-flight: check each inferred ID for uniqueness conflicts
  // Build a lookup of all existing skillssh_id values → row slug
  console.log("Checking for uniqueness conflicts...");
  const existingIdToSlug = new Map<string, string>();
  for (const s of allSkills) {
    if (s.skillssh_id) existingIdToSlug.set(s.skillssh_id, s.slug);
  }

  const cleanFixes: Fix[] = [];
  const dupeFixes: DupeRow[] = [];

  for (const c of candidates) {
    const conflictSlug = existingIdToSlug.get(c.skillssh_id);
    if (conflictSlug) {
      // The inferred ID is already owned by another (presumably canonical) row
      dupeFixes.push({ id: c.id, slug: c.slug, inferredId: c.skillssh_id, conflictSlug });
    } else {
      cleanFixes.push(c);
    }
  }

  console.log(`  Clean (no conflict):     ${cleanFixes.length.toLocaleString()} — will be updated`);
  console.log(`  Conflict (ID taken):     ${dupeFixes.length.toLocaleString()} — these are duplicate rows`);

  // Show sample of clean fixes
  if (cleanFixes.length > 0) {
    const sampleClean = cleanFixes.slice(0, 10);
    console.log("\nSample clean fixes:");
    for (const f of sampleClean) {
      console.log(`  ${f.slug.padEnd(50)} → ${f.skillssh_id}`);
    }
    if (cleanFixes.length > 10) console.log(`  ... and ${cleanFixes.length - 10} more`);
  }

  // Show sample of duplicates
  if (dupeFixes.length > 0) {
    const sampleDupe = dupeFixes.slice(0, 10);
    console.log(`\nSample duplicate rows (${dupeFixes.length} total):`);
    console.log(`  (These rows have null skillssh_id because the ID already belongs to a canonical row.`);
    console.log(`   They should be deleted or merged, not re-linked.)`);
    for (const d of sampleDupe) {
      console.log(`  ${d.slug.padEnd(55)} → ID "${d.inferredId}" owned by: ${d.conflictSlug}`);
    }
    if (dupeFixes.length > 10) console.log(`  ... and ${dupeFixes.length - 10} more`);
  }

  let fixedCount = 0;
  let fixFailCount = 0;

  if (!DRY_RUN && cleanFixes.length > 0) {
    console.log("\nApplying clean fixes...");
    const BATCH = 100;
    for (let i = 0; i < cleanFixes.length; i += BATCH) {
      const batch = cleanFixes.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (f) => {
          const { error } = await db
            .from("skill_listing")
            .update({ skillssh_id: f.skillssh_id, skillssh_url: f.skillssh_url })
            .eq("id", f.id);
          if (error) {
            console.error(`  ERROR updating ${f.slug}: ${error.message}`);
            fixFailCount++;
          } else {
            fixedCount++;
          }
        })
      );
      if ((i + BATCH) % 500 === 0 && i + BATCH < cleanFixes.length) {
        console.log(`  Progress: ${i + BATCH}/${cleanFixes.length}`);
      }
    }
    console.log(`\nFixed: ${fixedCount.toLocaleString()}, Failed: ${fixFailCount.toLocaleString()}`);
  } else if (DRY_RUN && cleanFixes.length > 0) {
    console.log("\n[dry-run] Would apply clean fixes — skipping writes.");
    fixedCount = cleanFixes.length;
  } else if (cleanFixes.length === 0) {
    console.log("\nNo clean fixes to apply.");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4 — Remaining nulls with no linked siblings
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + hr("═"));
  console.log("STEP 4 — Remaining Nulls With No Linked Siblings (Manual Investigation)");
  console.log(hr("═"));

  // Sort no-sibling repos by total install count descending
  const noSiblingTop20 = reposNoSiblings
    .sort((a, b) => b.total_installs - a.total_installs)
    .slice(0, 20);

  const totalUnlinkedNoSibling = reposNoSiblings.reduce((sum, r) => sum + r.unlinked, 0);
  console.log(
    `\nRepos with no linked siblings: ${reposNoSiblings.length.toLocaleString()} (${totalUnlinkedNoSibling.toLocaleString()} unlinked skills)`
  );
  console.log("\nTop 20 by total install count:");
  console.log(hr("─"));
  console.log(
    `${"Repo URL".padEnd(55)} ${"Skills".padStart(7)} ${"Unlinked".padStart(9)} ${"Installs".padStart(10)}  Multi?`
  );
  console.log(hr("─"));

  for (const repo of noSiblingTop20) {
    const multi = repo.total > 1 ? "yes" : "no";
    console.log(
      `${repo.source_url.slice(0, 54).padEnd(55)} ${String(repo.total).padStart(7)} ${String(repo.unlinked).padStart(9)} ${repo.total_installs.toLocaleString().padStart(10)}  ${multi}`
    );
  }

  // Also list the skill names for the top few repos to help manual investigation
  const TOP_DETAIL = 5;
  console.log(`\nSkill details for top ${TOP_DETAIL} no-sibling repos:`);
  for (const repo of noSiblingTop20.slice(0, TOP_DETAIL)) {
    console.log(`\n  ${repo.source_url}`);
    for (const skill of repo.unlinked_skills.slice(0, 8)) {
      const installs = installMap.get(skill.id) ?? 0;
      console.log(
        `    slug=${skill.slug.padEnd(40)} name=${(skill.skill_name ?? "(null)").padEnd(30)} installs=${installs.toLocaleString()}`
      );
    }
    if (repo.unlinked_skills.length > 8) {
      console.log(`    ... and ${repo.unlinked_skills.length - 8} more`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 5 — Summary
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + hr("═"));
  console.log("STEP 5 — Summary");
  console.log(hr("═"));

  const afterWithId = withId + fixedCount;
  const afterNullId = nullId - fixedCount;

  console.log(`\nskillssh_id coverage:`);
  console.log(`  Before:  ${withId.toLocaleString()} / ${total.toLocaleString()} (${pct(withId, total)})`);
  console.log(`  After:   ${afterWithId.toLocaleString()} / ${total.toLocaleString()} (${pct(afterWithId, total)})`);
  console.log(`  Gain:    +${fixedCount.toLocaleString()} skills`);

  console.log(`\nAudit eligibility:`);
  console.log(`  Previously audited:        ${auditedCount.toLocaleString()} skills`);
  console.log(`  Newly eligible (linked):   +${fixedCount.toLocaleString()} skills`);
  console.log(`  Already linked, unaudited: ${linkedButUnaudited.toLocaleString()} (cron will pick these up)`);
  console.log(
    `  Est. total after cron:     ~${(auditedCount + linkedButUnaudited + fixedCount).toLocaleString()} skills`
  );

  console.log(`\nRemaining nulls (${afterNullId.toLocaleString()} total):`);
  console.log(`  Duplicate rows (need cleanup):      ${dupeFixes.length.toLocaleString()} (no audit needed — same skill already indexed)`);
  console.log(`  No linked siblings (manual lookup): ${totalUnlinkedNoSibling.toLocaleString()} across ${reposNoSiblings.length.toLocaleString()} repos`);

  // Repos that look unusual / need manual review
  const highInstallNoSibling = noSiblingTop20.filter((r) => r.total_installs > 1000);
  if (highInstallNoSibling.length > 0) {
    console.log("\nHigh-priority repos for manual investigation (>1k installs, no linked sibling):");
    for (const repo of highInstallNoSibling) {
      console.log(
        `  ${repo.source_url} — ${repo.unlinked} unlinked skills, ${repo.total_installs.toLocaleString()} total installs`
      );
    }
  }

  // Skills with skill_name that looks like a display name (not a slug)
  const badNameFixes = cleanFixes.filter((f) => {
    const namePart = f.skillssh_id.split("/").pop() ?? "";
    return /[A-Z ]/.test(namePart) || namePart.length > 50;
  });
  if (badNameFixes.length > 0) {
    console.log(
      `\nWARNING: ${badNameFixes.length} inferred IDs may have bad skill names (spaces/caps/long) — verify these:`
    );
    for (const f of badNameFixes.slice(0, 10)) {
      console.log(`  ${f.slug} → ${f.skillssh_id}`);
    }
    if (badNameFixes.length > 10) console.log(`  ... and ${badNameFixes.length - 10} more`);
  }

  // Report duplicate rows that need cleanup
  if (dupeFixes.length > 0) {
    console.log(`\nACTION NEEDED — ${dupeFixes.length} duplicate rows with null skillssh_id:`);
    console.log(`  These rows could not be linked because their inferred ID is already owned by`);
    console.log(`  a canonical row. They are likely stale duplicate index entries.`);
    console.log(`  Run a deduplication pass or delete them with:`);
    console.log(`    DELETE FROM skill_listing WHERE id IN (<dup-ids>)`);
    console.log(`  (after confirming the canonical rows have the correct data)`);
  }

  console.log("\n" + hr("═"));
  console.log(DRY_RUN ? "Dry run complete — no changes written." : "Done.");
  console.log(hr("═") + "\n");
}

main().catch((err) => {
  console.error("[audit-coverage] fatal:", err);
  process.exit(1);
});
