/**
 * scripts/audit-top-skills.ts
 *
 * Audits data quality for the top 150 skills by install_count_estimate.
 * Checks for:
 *   a. skillssh_id is null
 *   b. skillssh_id was likely incorrectly inferred (skill_name has spaces/special chars or is >40 chars)
 *   c. skill_path looks wrong (contains spaces or mixed case)
 *   d. skill_path is null but other skills from same repo exist (likely a subskill)
 *   e. Install command broken — skill_path uses display name with spaces/caps
 *   f. skillssh_url is null
 *
 * Run: npx tsx scripts/audit-top-skills.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type SkillRow = {
  id: string;
  slug: string;
  skill_name: string | null;
  source_url: string | null;
  skill_path: string | null;
  skillssh_id: string | null;
  skillssh_url: string | null;
  install_count_estimate: number | null;
};

type IssueReport = {
  slug: string;
  install_count: number | null;
  issues: string[];
  suggested_fixes: string[];
};

// ── helpers ────────────────────────────────────────────────────────────────

function hasSpacesOrSpecialChars(s: string): boolean {
  // A slug/path should be lowercase alphanumeric + hyphens/underscores only
  return /[^a-z0-9\-_]/.test(s);
}

function hasMixedCaseOrSpaces(s: string): boolean {
  return /[A-Z ]/.test(s);
}

function buildInstallCommand(skill: SkillRow): string {
  if (!skill.source_url) return "(no source_url)";
  if (skill.skill_path) {
    return `npx skills add ${skill.source_url}/tree/main/${skill.skill_path}`;
  }
  return `npx skills add ${skill.source_url}`;
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("[audit] Fetching top 150 skills by install_count_estimate...\n");

  // Join skill_listing with skill_signal to get install counts
  const { data: rawSkills, error } = await db
    .from("skill_listing")
    .select(`
      id,
      slug,
      skill_name,
      source_url,
      skill_path,
      skillssh_id,
      skillssh_url,
      skill_signal (
        install_count_estimate
      )
    `)
    .order("skill_signal(install_count_estimate)", { ascending: false })
    .limit(150);

  if (error) {
    console.error("[audit] Failed to fetch skills:", error.message);
    process.exit(1);
  }

  if (!rawSkills || rawSkills.length === 0) {
    console.log("[audit] No skills found.");
    return;
  }

  // Flatten the nested signal
  const skills: SkillRow[] = rawSkills.map((r: any) => ({
    id: r.id,
    slug: r.slug,
    skill_name: r.skill_name,
    source_url: r.source_url,
    skill_path: r.skill_path,
    skillssh_id: r.skillssh_id,
    skillssh_url: r.skillssh_url,
    install_count_estimate: r.skill_signal?.[0]?.install_count_estimate ?? r.skill_signal?.install_count_estimate ?? null,
  }));

  // Sort descending by install count (in case the order didn't carry through the join)
  skills.sort((a, b) => (b.install_count_estimate ?? 0) - (a.install_count_estimate ?? 0));

  console.log(`[audit] Got ${skills.length} skills. Top install count: ${skills[0]?.install_count_estimate ?? "unknown"}\n`);

  // Build a map of source_url → count of skills in catalog (to detect multi-skill repos)
  // We need to query all skills for the repos that appear in our top 150
  const sourceUrls = [...new Set(skills.map(s => s.source_url).filter(Boolean))] as string[];

  const repoSkillCounts = new Map<string, number>(); // source_url → count of skills with that source_url
  if (sourceUrls.length > 0) {
    // Query in batches since Supabase has limits on 'in' filter size
    const BATCH = 50;
    for (let i = 0; i < sourceUrls.length; i += BATCH) {
      const batch = sourceUrls.slice(i, i + BATCH);
      const { data: repoData, error: repoErr } = await db
        .from("skill_listing")
        .select("source_url")
        .in("source_url", batch);

      if (!repoErr && repoData) {
        for (const row of repoData as { source_url: string }[]) {
          if (row.source_url) {
            repoSkillCounts.set(row.source_url, (repoSkillCounts.get(row.source_url) ?? 0) + 1);
          }
        }
      }
    }
  }

  // ── Run checks ─────────────────────────────────────────────────────────

  const reports: IssueReport[] = [];

  for (const skill of skills) {
    const issues: string[] = [];
    const fixes: string[] = [];

    // a. skillssh_id is null
    if (!skill.skillssh_id) {
      issues.push("(a) skillssh_id is null — skill not linked to skills.sh");
      const owner = skill.source_url?.replace("https://github.com/", "") ?? "?";
      fixes.push(`Set skillssh_id = "${owner}/${skill.skill_name}" (inferred)`);
    }

    // b. skillssh_id was likely incorrectly inferred
    if (skill.skillssh_id && skill.skill_name) {
      const namePart = skill.skillssh_id.split("/").pop() ?? "";
      if (hasSpacesOrSpecialChars(skill.skill_name) || skill.skill_name.length > 40) {
        issues.push(
          `(b) skillssh_id likely wrong — skill_name "${skill.skill_name}" has spaces/special chars or is >40 chars (display name, not slug)`
        );
        fixes.push(
          `Verify actual skills.sh slug for this skill; skill_name "${skill.skill_name}" looks like a display name not a slug`
        );
      } else if (namePart !== skill.skill_name && hasSpacesOrSpecialChars(namePart)) {
        issues.push(
          `(b) skillssh_id suffix "${namePart}" has spaces/special chars — likely incorrectly inferred`
        );
        fixes.push(`Manually verify skills.sh ID for ${skill.slug}`);
      }
    }

    // c. skill_path looks wrong (spaces or mixed case)
    if (skill.skill_path && hasMixedCaseOrSpaces(skill.skill_path)) {
      issues.push(
        `(c) skill_path "${skill.skill_path}" has mixed case or spaces — folder names should be lowercase-kebab`
      );
      const suggested = skill.skill_path.toLowerCase().replace(/\s+/g, "-");
      fixes.push(`Change skill_path from "${skill.skill_path}" to "${suggested}" (or verify actual folder name on GitHub)`);
    }

    // d. skill_path is null but same repo has multiple skills in catalog
    if (!skill.skill_path && skill.source_url) {
      const count = repoSkillCounts.get(skill.source_url) ?? 0;
      if (count > 1) {
        issues.push(
          `(d) skill_path is null but repo "${skill.source_url}" has ${count} skills in catalog — this is likely a subskill missing its path`
        );
        fixes.push(`Set skill_path = "${skill.skill_name}" (inferred from skill_name)`);
      }
    }

    // e. Install command broken — skill_path uses display name (spaces/caps)
    if (skill.skill_path && hasMixedCaseOrSpaces(skill.skill_path)) {
      const cmd = buildInstallCommand(skill);
      issues.push(
        `(e) Install command broken — skill_path "${skill.skill_path}" has spaces/caps making URL invalid: ${cmd}`
      );
      const fixedPath = skill.skill_path.toLowerCase().replace(/\s+/g, "-");
      fixes.push(
        `Fix skill_path to "${fixedPath}" so install command becomes: npx skills add ${skill.source_url}/tree/main/${fixedPath}`
      );
    } else if (!skill.skill_path && skill.source_url) {
      // Check if this might be a subskill where null path leads to wrong repo-level install
      const count = repoSkillCounts.get(skill.source_url) ?? 0;
      if (count > 1) {
        const cmd = buildInstallCommand(skill);
        issues.push(
          `(e) Install command may be wrong — null skill_path means command targets entire repo, but this is one of ${count} skills from "${skill.source_url}": ${cmd}`
        );
        fixes.push(`Set skill_path = "${skill.skill_name}" to get correct install URL`);
      }
    }

    // f. skillssh_url is null
    if (!skill.skillssh_url) {
      issues.push("(f) skillssh_url is null");
      if (skill.skillssh_id) {
        fixes.push(`Set skillssh_url = "https://www.skills.sh/${skill.skillssh_id}"`);
      } else {
        fixes.push("Set skillssh_id first, then derive skillssh_url");
      }
    }

    if (issues.length > 0) {
      reports.push({
        slug: skill.slug,
        install_count: skill.install_count_estimate,
        issues,
        suggested_fixes: fixes,
      });
    }
  }

  // ── Print report ────────────────────────────────────────────────────────

  console.log("═".repeat(80));
  console.log(`AUDIT REPORT — Top ${skills.length} Skills by Install Count`);
  console.log("═".repeat(80));
  console.log();

  if (reports.length === 0) {
    console.log("No issues found! All top skills look clean.");
  } else {
    console.log(`Found issues in ${reports.length} of ${skills.length} skills:\n`);
    for (const r of reports) {
      console.log(`Skill: ${r.slug}`);
      console.log(`  Install count: ${r.install_count?.toLocaleString() ?? "unknown"}`);
      console.log(`  Issues:`);
      for (const issue of r.issues) {
        console.log(`    • ${issue}`);
      }
      console.log(`  Suggested fixes:`);
      for (const fix of r.suggested_fixes) {
        console.log(`    → ${fix}`);
      }
      console.log();
    }
  }

  // ── Summary: skillssh_id coverage for top 100 ──────────────────────────

  console.log("═".repeat(80));
  console.log("SKILLSSH_ID COVERAGE — Top 100 Skills");
  console.log("═".repeat(80));

  const top100 = skills.slice(0, 100);
  const withId = top100.filter(s => s.skillssh_id !== null);
  const withoutId = top100.filter(s => s.skillssh_id === null);

  console.log(`\nTotal top 100: ${top100.length}`);
  console.log(`  With skillssh_id:    ${withId.length} (${Math.round(withId.length / top100.length * 100)}%)`);
  console.log(`  Without skillssh_id: ${withoutId.length} (${Math.round(withoutId.length / top100.length * 100)}%)`);

  if (withoutId.length > 0) {
    console.log("\nSkills missing skillssh_id (top 100):");
    for (const s of withoutId) {
      console.log(`  - ${s.slug} (installs: ${s.install_count_estimate?.toLocaleString() ?? "unknown"})`);
    }
  }

  // ── Issue type breakdown ────────────────────────────────────────────────

  console.log("\n" + "─".repeat(80));
  console.log("ISSUE BREAKDOWN");
  console.log("─".repeat(80));

  const issueCounts = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };
  for (const r of reports) {
    for (const issue of r.issues) {
      if (issue.startsWith("(a)")) issueCounts.a++;
      if (issue.startsWith("(b)")) issueCounts.b++;
      if (issue.startsWith("(c)")) issueCounts.c++;
      if (issue.startsWith("(d)")) issueCounts.d++;
      if (issue.startsWith("(e)")) issueCounts.e++;
      if (issue.startsWith("(f)")) issueCounts.f++;
    }
  }

  console.log(`  (a) skillssh_id null:                   ${issueCounts.a}`);
  console.log(`  (b) skillssh_id likely wrong (display name):  ${issueCounts.b}`);
  console.log(`  (c) skill_path has spaces/mixed case:   ${issueCounts.c}`);
  console.log(`  (d) skill_path null on multi-skill repo: ${issueCounts.d}`);
  console.log(`  (e) Install command likely broken:      ${issueCounts.e}`);
  console.log(`  (f) skillssh_url null:                  ${issueCounts.f}`);

  console.log("\n[audit] Done.");
}

main().catch((err) => {
  console.error("[audit] fatal:", err);
  process.exit(1);
});
