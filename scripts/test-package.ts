import { config } from "dotenv";
config({ path: ".env.local" });
import { packageSkill } from "./lib/package-skill";

async function main() {
  const result = await packageSkill({
    id: "test",
    slug: "anthropics-skills-pdf",
    source_url: "https://github.com/anthropics/skills",
    skill_path: "skills/pdf",
  });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(console.error);
