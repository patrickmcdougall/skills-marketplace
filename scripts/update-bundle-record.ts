import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

db.from("skill_listing").update({
  bundle_url: "https://uuczxcibewfqinjwgwpm.supabase.co/storage/v1/object/public/bundles/livekit-agent-skills-livekit-agents.skill",
  bundle_source_ref: "d86b6458a8f80bb41c67ef29a04b45849e9ad38d",
  bundle_status: "ready",
  bundle_packaged_at: new Date().toISOString(),
}).eq("slug", "livekit-agent-skills-livekit-agents")
  .then(({ error }) => {
    if (error) { console.error(error.message); process.exit(1); }
    else console.log("updated");
  });
