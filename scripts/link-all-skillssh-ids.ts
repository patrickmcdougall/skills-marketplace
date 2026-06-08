/**
 * Infer skillssh_id for all skills that have null skillssh_id.
 * Pattern: skills.sh uses "owner/repo/skill_name" as the ID.
 * sync-audit handles 404s gracefully, so false positives are safe.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Paginate through all skills with null skillssh_id
  const skills: { id: string; slug: string; skill_name: string; source_url: string }[] = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await db
      .from("skill_listing")
      .select("id, slug, skill_name, source_url")
      .is("skillssh_id", null)
      .ilike("source_url", "https://github.com/%")
      .not("skill_name", "is", null)
      .range(from, from + PAGE - 1);

    if (error) { console.error("Query error:", error.message); break; }
    if (!data || data.length === 0) break;
    skills.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`Found ${skills.length} unlinked skills`);

  let updated = 0, failed = 0;

  // Batch updates
  const BATCH = 100;
  for (let i = 0; i < skills.length; i += BATCH) {
    const batch = skills.slice(i, i + BATCH);
    await Promise.all(batch.map(async (s) => {
      const owner = s.source_url.replace("https://github.com/", "");
      const skillsshId = `${owner}/${s.skill_name}`;
      const skillsshUrl = `https://www.skills.sh/${skillsshId}`;

      const { error } = await db
        .from("skill_listing")
        .update({ skillssh_id: skillsshId, skillssh_url: skillsshUrl })
        .eq("id", s.id);

      if (error) { console.error(`Error ${s.slug}:`, error.message); failed++; }
      else updated++;
    }));

    if (i % 1000 === 0 && i > 0) console.log(`Progress: ${i}/${skills.length}`);
  }

  console.log(`Done. Updated ${updated}, failed ${failed}.`);
}

main().catch(console.error);
