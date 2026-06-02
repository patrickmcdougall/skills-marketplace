import { config } from "dotenv";
config({ path: ".env.local" });
import { packageSkill } from "./lib/package-skill";

packageSkill({
  id: "31c3a952-9f46-4fb9-b23f-7f4d73888e52",
  slug: "mastra-ai-skills-mastra",
  source_url: "https://github.com/mastra-ai/skills",
  skill_path: null,
}).then(r => console.log(JSON.stringify(r, null, 2))).catch(console.error);
