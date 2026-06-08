import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Repos confirmed to use skills/<name>/SKILL.md structure
// Maps source_url substring → path prefix to prepend
const SKILLS_PREFIX_REPOS: Record<string, string> = {
  "juliusbrussee/caveman": "skills/",
  "vercel-labs/agent-browser": "skills/",
};

// Repos where skill_path should be null (CLI finds from root)
const ROOT_REPOS = [
  "pbakaus/impeccable",
];

async function main() {
  // 1. Fix juliusbrussee-caveman-compress: skill_name=compress but folder=caveman-compress
  const { error: e1 } = await db.from("skill_listing")
    .update({ skill_path: "skills/caveman-compress" })
    .eq("slug", "juliusbrussee-caveman-compress");
  console.log(e1 ? `ERROR compress: ${e1.message}` : "Fixed juliusbrussee-caveman-compress → skills/caveman-compress");

  // 2. Broader check: find skills where skill_path was set by our backfill (= skill_name)
  // but the skill_name contains a prefix that suggests it belongs to a skills/ subdirectory
  // by checking repos we've confirmed use that structure
  for (const [repoSubstr, prefix] of Object.entries(SKILLS_PREFIX_REPOS)) {
    const { data } = await db.from("skill_listing")
      .select("slug, skill_name, skill_path")
      .ilike("source_url", `%${repoSubstr}%`);

    const wrong = (data ?? []).filter(s =>
      s.skill_path && !s.skill_path.startsWith(prefix) && s.skill_path !== null
    );
    if (wrong.length) {
      console.log(`\nStill wrong paths in ${repoSubstr}:`);
      wrong.forEach(s => console.log(`  ${s.slug}: ${s.skill_path} → should be ${prefix}${s.skill_name}`));
    } else {
      console.log(`\n${repoSubstr}: all paths correct ✓`);
    }
  }

  // 3. Verify top 20 most-installed skills have non-null skillssh_id and reasonable skill_path
  const { data: top } = await db.from("skill_listing")
    .select("slug, skill_name, skill_path, skillssh_id, source_url, skill_signal(install_count_estimate)")
    .not("skillssh_id", "is", null)
    .order("skill_signal(install_count_estimate)", { ascending: false })
    .limit(20);

  console.log("\n--- Top 20 by installs ---");
  for (const s of top ?? []) {
    const installs = (s.skill_signal as unknown as { install_count_estimate: number } | null)?.install_count_estimate ?? 0;
    const repoOwner = s.source_url.replace("https://github.com/", "");
    const expectedId = `${repoOwner}/${s.skill_name}`;
    const idOk = s.skillssh_id === expectedId ? "✓" : `⚠ id=${s.skillssh_id}`;
    console.log(`${String(installs).padStart(8)} ${s.slug} path=${s.skill_path ?? "null"} ${idOk}`);
  }
}

main().catch(console.error);
