import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await db.storage.createBucket("bundles", { public: true });
  if (error && !error.message.includes("already exists")) {
    console.error("Bucket error:", error.message); process.exit(1);
  } else {
    console.log("Bucket ready:", error?.message ?? "created");
  }
}
main();
