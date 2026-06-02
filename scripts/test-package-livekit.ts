import { config } from "dotenv";
config({ path: ".env.local" });
import { packageSkill } from "./lib/package-skill";

packageSkill({
  id: "312b87ad-930c-4379-83d8-a2b87d952c0c",
  slug: "livekit-agent-skills-livekit-agents",
  source_url: "https://github.com/livekit/agent-skills",
  skill_path: null,
}).then(r => console.log(JSON.stringify(r, null, 2))).catch(console.error);
