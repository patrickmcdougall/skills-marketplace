/**
 * scripts/generate-content.ts
 *
 * Claudinho — generate human-readable card copy + classify every skill.
 *
 * The catalog stores each skill's RAW SKILL.md `name` (a slug) and
 * `description` (agent trigger language). Neither reads well on a card. This
 * script sends raw metadata to Claude with structured output (tool use),
 * validates the result against a closed taxonomy, and writes the result into
 * SEPARATE generated columns — it never touches `skill_name`/`description_excerpt`.
 *
 * Run:
 *   npx tsx scripts/generate-content.ts --dry-run --limit 20
 *   npx tsx scripts/generate-content.ts                 # full incremental run
 *   npx tsx scripts/generate-content.ts --ids slug1,slug2
 *
 * Required env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 *
 * Requires the generated columns from
 *   supabase/migrations/20260601135713_add_generated_content_columns.sql
 * (only for writes — --dry-run works without them).
 */

import { config as loadEnv } from "dotenv";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

loadEnv({ path: ".env.local" });

// ---------- config ----------

const MODEL = "claude-haiku-4-5-20251001"; // swap here; few-shot carries quality
const MAX_TOKENS = 700;
const BATCH = 50;
const CONCURRENCY = 5;
const CHECKPOINT_FILE = ".content-gen-checkpoint.json";

// ---------- env ----------

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}. Add it to .env.local and re-run.`);
    process.exit(1);
  }
  return v;
}
const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = required("ANTHROPIC_API_KEY");

// ---------- flags ----------

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const LIMIT = flagValue("--limit") ? parseInt(flagValue("--limit")!, 10) : undefined;
const ONLY_IDS = flagValue("--ids")?.split(",").map((s) => s.trim()).filter(Boolean);
function flagValue(name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

// ---------- clients ----------

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ---------- taxonomy (closed — validate in code) ----------

const SHELVES: Record<string, string[]> = {
  product: ["discovery", "specification", "communication", "training-enablement"],
  engineering: ["planning-thinking", "code-review", "debugging-investigation", "pipelines-data", "workflow-sprint-structure", "skill-authoring"],
  design: ["critique-review", "craft-polish", "accessibility", "systems-handoff"],
  marketing: ["seo-content", "positioning-messaging", "landing-pages", "campaigns-launches", "swipe-inspiration"],
  sales: ["outreach-prospecting", "discovery-qualification", "demo-followup", "pipeline-deal-management"],
  "customer-success": ["ticket-triage", "retention-churn-save", "onboarding", "health-insights"],
  operations: ["vendor-procurement", "compliance-security", "process-automation", "people-team-ops"],
  finance: ["runway-forecasting", "investor-relations", "bookkeeping-reconciliation", "reporting-dashboards"],
};
const TAG_FAMILIES: Record<string, string[]> = {
  Audience: ["for-founders", "for-pms", "for-engineers", "for-designers", "for-marketers", "for-ops"],
  Workflow: ["discovery", "planning", "execution", "review", "delivery"],
  Shape: ["atomic", "bundle", "meta"],
  Setup: ["no-setup", "light-setup", "needs-integration"],
  Input: ["from-text", "from-csv", "from-file", "from-url", "from-repo"],
};
const ALL_TAGS = new Set(Object.values(TAG_FAMILIES).flat());

// ---------- prompt ----------

const SYSTEM = `You write marketplace catalog copy for Claudinho, a directory that helps NON-TECHNICAL founders
and operators discover Claude skills. Your reader skims a card for 5 seconds and decides whether
to try the skill. They don't know what a "SKILL.md" is and don't care.

You are given a skill's RAW metadata — its name (often a slug) and description (written as trigger
language for an AI agent). Translate it into human-readable card copy and classify it.

Return ONLY the JSON object via the tool. RULES:
- display_title: ≤50 chars. Lead with a verb. Name the OUTCOME, not the mechanism. Never reuse the
  slug. Never include the publisher or the word "skill". Write it like a sentence fragment.
- display_description: 100–200 chars. What it does for the user + ONE distinguishing detail. Strip
  ALL trigger language — no "use this when", "trigger when", "whenever the user". No marketing
  adjectives ("powerful", "seamless"). Concrete and specific.
- bestFor: ~80 chars. A fragment naming the person or moment this is for. Don't start with "Best for".
- shelf / subShelf: exactly one each from the allowed enum; subShelf must be valid for the shelf.
  Force the closest fit.
- tags: 2–5 from the allowed families. Include an Audience tag and a Setup-level tag when inferable.
- confidence: honest 0–1 in the shelf/subShelf choice.
- Never invent facts the raw metadata doesn't support. A dull-but-true title beats an exciting-but-wrong one.`;

const TOOL: Anthropic.Tool = {
  name: "emit_card_content",
  description: "Emit the human-readable card copy and classification for one skill.",
  input_schema: {
    type: "object",
    required: ["display_title", "display_description", "bestFor", "shelf", "subShelf", "tags", "confidence"],
    properties: {
      display_title: { type: "string", maxLength: 50 },
      display_description: { type: "string", minLength: 90, maxLength: 200 },
      bestFor: { type: "string", maxLength: 95 },
      shelf: { enum: Object.keys(SHELVES) },
      subShelf: { type: "string" },
      tags: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
  },
};

type CardContent = {
  display_title: string;
  display_description: string;
  bestFor: string;
  shelf: string;
  subShelf: string;
  tags: string[];
  confidence: number;
};

// few-shot examples — included as tool-use turns to set the voice bar.
const FEWSHOT: { in: string; out: CardContent }[] = [
  {
    in: `name:pptx desc:"Use this skill any time a .pptx file is involved — creating slide decks, pitch decks, presentations; reading/extracting text; editing; templates, layouts, speaker notes."`,
    out: {
      display_title: "Turn a doc into a presentable slide deck",
      display_description: "Reads a memo, notes, or research summary and builds an editable .pptx with sectioned slides, speaker notes, and a flow that holds together.",
      bestFor: "Turning a written argument into a deck without losing the argument.",
      shelf: "product", subShelf: "communication",
      tags: ["atomic", "no-setup", "from-file", "from-text"], confidence: 0.85,
    },
  },
  {
    in: `name:skill-creator desc:"Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, optimize, run evals."`,
    out: {
      display_title: "Turn a rough idea into a publishable skill",
      display_description: "Takes a half-formed \"I keep doing X manually\" and produces a structured SKILL.md with the frontmatter, triggers, and body conventions Claude expects.",
      bestFor: "Authoring or fixing a SKILL.md when you'd rather not memorize the spec.",
      shelf: "engineering", subShelf: "skill-authoring",
      tags: ["meta", "for-engineers", "no-setup", "from-text"], confidence: 0.9,
    },
  },
  {
    in: `name:seo-audit desc:"Crawl a site and audit SEO; cross-reference search console; find underperforming pages."`,
    out: {
      display_title: "Find pages on your site leaking traffic",
      display_description: "Crawls your site, cross-references search-console data, and surfaces the few pages with the biggest gap between intent and rank — with a specific fix for each.",
      bestFor: "Marketers and founders whose site ranks but doesn't convert the right intent.",
      shelf: "marketing", subShelf: "seo-content",
      tags: ["atomic", "for-marketers", "for-founders", "needs-integration", "from-url"], confidence: 0.92,
    },
  },
];

// Build the cached message prefix (few-shot) once. cache_control on the last
// block lets the API reuse system + tools + few-shot across all ~2.2k calls.
function fewshotMessages(): Anthropic.MessageParam[] {
  const msgs: Anthropic.MessageParam[] = [];
  FEWSHOT.forEach((ex, i) => {
    msgs.push({ role: "user", content: ex.in });
    msgs.push({ role: "assistant", content: [{ type: "tool_use", id: `fs_${i}`, name: "emit_card_content", input: ex.out }] });
    const isLast = i === FEWSHOT.length - 1;
    msgs.push({
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: `fs_${i}`,
        content: "ok",
        ...(isLast ? { cache_control: { type: "ephemeral" as const } } : {}),
      }],
    });
  });
  return msgs;
}
const FEWSHOT_MSGS = fewshotMessages();

const SYSTEM_BLOCKS: Anthropic.TextBlockParam[] = [
  { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
];

// ---------- model call ----------

const TRIGGER_RE = /use this|trigger when|whenever the user|this skill/i;

async function callModel(name: string, desc: string): Promise<CardContent | null> {
  const userTurn: Anthropic.MessageParam = {
    role: "user",
    content: `name:${name} desc:"${(desc ?? "").replace(/"/g, "'")}"`,
  };
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_BLOCKS,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "emit_card_content" },
    messages: [...FEWSHOT_MSGS, userTurn],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return null;
  return block.input as CardContent;
}

// ---------- validation ----------

type Verdict = { status: "ok" | "review" | "pending"; issues: string[] };

function validate(c: CardContent): Verdict {
  const issues: string[] = [];
  let soft = false;

  if (!c.display_title || c.display_title.length > 50) issues.push(`title len ${c.display_title?.length}`);
  const dlen = c.display_description?.length ?? 0;
  if (dlen < 90 || dlen > 200) { issues.push(`desc len ${dlen}`); soft = true; }
  if (!c.bestFor || c.bestFor.length > 95) { issues.push(`bestFor len ${c.bestFor?.length}`); soft = true; }

  const shelfList = SHELVES[c.shelf];
  if (!shelfList) issues.push(`bad shelf ${c.shelf}`);
  else if (!shelfList.includes(c.subShelf)) issues.push(`subShelf ${c.subShelf} not in ${c.shelf}`);

  if (!Array.isArray(c.tags) || c.tags.length < 2 || c.tags.length > 5) { issues.push("tags count"); soft = true; }
  else {
    const bad = c.tags.filter((t) => !ALL_TAGS.has(t));
    if (bad.length) { issues.push(`bad tags ${bad.join(",")}`); soft = true; }
  }
  if (typeof c.confidence !== "number" || c.confidence < 0 || c.confidence > 1) issues.push("confidence range");

  // hard structural failures (taxonomy/title) => caller retries / pending
  const hard = issues.some((i) => i.startsWith("title") || i.startsWith("bad shelf") || i.startsWith("subShelf") || i.startsWith("confidence"));
  if (hard) return { status: "pending", issues };
  if (c.confidence < 0.6 || soft) return { status: "review", issues };
  return { status: "ok", issues };
}

// ---------- per-skill pipeline ----------

type Row = { id: string; slug: string; name: string; desc: string; hash: string };
type Result = {
  row: Row;
  content: CardContent | null;
  status: "ok" | "review" | "pending";
  issues: string[];
};

async function processRow(row: Row): Promise<Result> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let c: CardContent | null;
    try {
      c = await callModel(row.name, row.desc);
    } catch (e) {
      if (attempt === 1) return { row, content: null, status: "pending", issues: [`api: ${String(e).slice(0, 80)}`] };
      continue;
    }
    if (!c) {
      if (attempt === 1) return { row, content: null, status: "pending", issues: ["no tool_use"] };
      continue;
    }
    const triggers = TRIGGER_RE.test(c.display_description);
    const verdict = validate(c);
    // trigger-language => retry once; hard pending => retry once
    if ((triggers || verdict.status === "pending") && attempt === 0) continue;
    const issues = triggers ? [...verdict.issues, "trigger-language"] : verdict.issues;
    const status = triggers && verdict.status === "ok" ? "review" : verdict.status;
    return { row, content: c, status, issues };
  }
  return { row, content: null, status: "pending", issues: ["exhausted"] };
}

// ---------- concurrency ----------

async function mapPool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// ---------- data ----------

function hashInput(name: string, desc: string): string {
  return createHash("sha256").update(`${name}\n${desc ?? ""}`).digest("hex").slice(0, 32);
}

async function loadRows(): Promise<Row[]> {
  const out: Row[] = [];
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    let q = db
      .from("skill_listing")
      .select("id, slug, skill_name, description_excerpt, content_input_hash, content_status")
      .eq("status", "indexed")
      .range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) throw new Error(`skill_listing read: ${error.message}`);
    if (!data?.length) break;
    for (const r of data as any[]) {
      const name = r.skill_name ?? "";
      const desc = r.description_excerpt ?? "";
      const hash = hashInput(name, desc);
      // incremental: skip rows already generated for this exact input
      const fresh = r.content_input_hash === hash && r.content_status === "ok";
      if (!fresh) out.push({ id: r.id, slug: r.slug, name, desc, hash });
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

function loadCheckpoint(): Set<string> {
  if (!existsSync(CHECKPOINT_FILE)) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(CHECKPOINT_FILE, "utf8")) as string[]);
  } catch {
    return new Set();
  }
}
function saveCheckpoint(done: Set<string>) {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify([...done]));
}

async function writeBack(r: Result) {
  if (!r.content) {
    // hard failure — leave content_status pending, just stamp the hash so we
    // don't reprocess unchanged input forever (still logged).
    await db.from("skill_listing").update({
      content_status: "pending",
      content_input_hash: r.row.hash,
    }).eq("id", r.row.id);
    return;
  }
  const c = r.content;
  await db.from("skill_listing").update({
    display_title: c.display_title,
    display_description: c.display_description,
    best_for: c.bestFor,
    shelf: c.shelf,
    sub_shelf: c.subShelf,
    tags: c.tags,
    content_confidence: c.confidence,
    content_status: r.status,
    content_generated_at: new Date().toISOString(),
    content_input_hash: r.row.hash,
  }).eq("id", r.row.id);
}

// ---------- main ----------

async function main() {
  console.log(`[gen] model=${MODEL} dry-run=${DRY_RUN} limit=${LIMIT ?? "∞"} ids=${ONLY_IDS?.length ?? "—"}`);

  let rows = await loadRows();
  if (ONLY_IDS) rows = rows.filter((r) => ONLY_IDS.includes(r.slug) || ONLY_IDS.includes(r.id));
  const done = DRY_RUN ? new Set<string>() : loadCheckpoint();
  rows = rows.filter((r) => !done.has(r.id));
  if (LIMIT) rows = rows.slice(0, LIMIT);

  console.log(`[gen] ${rows.length} skills to process`);
  if (rows.length === 0) return;

  const counts = { ok: 0, review: 0, pending: 0 };
  const shelfDist: Record<string, number> = {};
  const dryTable: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const results = await mapPool(batch, CONCURRENCY, processRow);
    for (const r of results) {
      counts[r.status]++;
      if (r.content) shelfDist[r.content.shelf] = (shelfDist[r.content.shelf] ?? 0) + 1;
      if (DRY_RUN) {
        const c = r.content;
        dryTable.push(
          `${r.row.name.slice(0, 22).padEnd(22)} → ${(c?.display_title ?? "—").slice(0, 44).padEnd(44)} | ${(c ? `${c.shelf}/${c.subShelf}` : "—").padEnd(34)} | ${c?.confidence ?? "—"} ${r.issues.length ? "[" + r.issues.join(";") + "]" : ""}`
        );
      } else {
        await writeBack(r);
        done.add(r.row.id);
      }
    }
    if (!DRY_RUN) saveCheckpoint(done);
    console.log(`[gen] ${Math.min(i + BATCH, rows.length)}/${rows.length}  ok=${counts.ok} review=${counts.review} pending=${counts.pending}`);
  }

  if (DRY_RUN) {
    console.log("\nname → display_title | shelf/sub | confidence");
    console.log("─".repeat(120));
    dryTable.forEach((l) => console.log(l));
  }
  console.log(`\n[gen] done. ok=${counts.ok} review=${counts.review} pending=${counts.pending}`);
  console.log("[gen] shelf distribution:", JSON.stringify(shelfDist, null, 0));
}

main().catch((err) => {
  console.error("[gen] fatal:", err);
  process.exit(1);
});
