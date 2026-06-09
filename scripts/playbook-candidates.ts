import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: process.env.PLAYBOOK_ENV || ".env.local" });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Row = {
  slug: string;
  skill_name: string;
  source_url: string;
  display_title: string | null;
  display_description: string | null;
  best_for: string | null;
  shelf: string | null;
  sub_shelf: string | null;
  tags: string[] | null;
  skill_signal: { install_count_estimate: number; install_count: number; stars: number } | null;
};

function installs(r: Row) {
  return (r.skill_signal?.install_count_estimate ?? 0) + (r.skill_signal?.install_count ?? 0);
}

async function fetchAll(): Promise<Row[]> {
  const out: Row[] = [];
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await db
      .from("skill_listing")
      .select(
        "slug, skill_name, source_url, display_title, display_description, best_for, shelf, sub_shelf, tags, skill_signal(install_count_estimate, install_count, stars)"
      )
      .eq("status", "indexed")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...(data as unknown as Row[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

function show(label: string, rows: Row[]) {
  console.log(`\n========== ${label} (${rows.length}) ==========`);
  rows
    .sort((a, b) => installs(b) - installs(a))
    .slice(0, 12)
    .forEach((r) => {
      const owner = (() => { try { return new URL(r.source_url).pathname.split("/").filter(Boolean)[0]; } catch { return "?"; } })();
      console.log(
        `  [${installs(r).toString().padStart(5)}↓ ${String(r.skill_signal?.stars ?? 0).padStart(4)}★] ${owner}/${r.slug}`
      );
      console.log(`        shelf=${r.shelf}/${r.sub_shelf}  title="${r.display_title ?? r.skill_name}"`);
      if (r.best_for) console.log(`        best_for: ${r.best_for}`);
    });
}

async function main() {
  const all = await fetchAll();
  console.log(`Total indexed: ${all.length}`);

  // Distribution of shelves
  const shelfCount = new Map<string, number>();
  for (const r of all) {
    const k = `${r.shelf}/${r.sub_shelf}`;
    shelfCount.set(k, (shelfCount.get(k) ?? 0) + 1);
  }
  console.log("\n--- shelf/sub_shelf coverage (top 30) ---");
  [...shelfCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([k, n]) => console.log(`  ${n.toString().padStart(4)}  ${k}`));

  const text = (r: Row) => `${r.skill_name} ${r.display_title ?? ""} ${r.display_description ?? ""} ${r.best_for ?? ""} ${(r.tags ?? []).join(" ")}`.toLowerCase();

  // Case 01 — Operations / expenses / process-automation
  show("CASE 01 — expenses/finance-ops (keyword)", all.filter(r => /expense|bookkeep|receipt|invoice|reconcil|categor.*transaction|statement/.test(text(r))));
  show("CASE 01 — process-automation sub_shelf", all.filter(r => r.sub_shelf === "process-automation"));

  // Case 02 — Product / call notes -> deck / communication
  show("CASE 02 — deck/slides (keyword)", all.filter(r => /slide|deck|presentation|powerpoint|pptx|keynote/.test(text(r))));
  show("CASE 02 — communication sub_shelf", all.filter(r => r.sub_shelf === "communication"));

  // Case 03 — Product / question -> research brief / research
  show("CASE 03 — research brief (keyword)", all.filter(r => /research|deep.?research|sourc|cit(e|ation)|brief|literature/.test(text(r))));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
