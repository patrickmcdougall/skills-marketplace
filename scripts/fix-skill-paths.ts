import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Find skills with null skill_path that have a subfolder structure
  // We can infer skill_path from slug: "garrytan-gstack-autoplan" → owner=garrytan, repo=gstack, skill=autoplan
  // If the skill name != repo name, it's likely in a subdirectory

  // Paginate through all null skill_path rows (Supabase caps at 1000/page)
  const skills = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await db
      .from("skill_listing")
      .select("id, slug, source_url, skill_name, skill_path")
      .is("skill_path", null)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    skills.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  if (skills.length === 0) { console.log("No skills found"); return; }

  console.log(`Found ${skills.length} skills with null skill_path`);

  let updated = 0;
  for (const s of skills) {
    // Extract repo name from source_url: https://github.com/owner/repo
    const parts = s.source_url?.split("/").filter(Boolean) ?? [];
    const repoName = parts[parts.length - 1]?.toLowerCase();
    const skillName = s.skill_name?.toLowerCase();

    // If skill_name != repo name, it's likely in a subfolder named after the skill
    if (repoName && skillName && skillName !== repoName) {
      const { error } = await db
        .from("skill_listing")
        .update({ skill_path: s.skill_name })
        .eq("id", s.id);

      if (!error) {
        console.log(`Updated ${s.slug}: skill_path = ${s.skill_name}`);
        updated++;
      } else {
        console.error(`Error updating ${s.slug}:`, error.message);
      }
    }
  }

  console.log(`Done. Updated ${updated} skills.`);
}

main().catch(console.error);
