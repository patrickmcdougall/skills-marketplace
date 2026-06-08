/**
 * Cron: generate human-readable card copy for un-enriched skills.
 *
 * Picks up skills where content_status IS NULL or 'pending', calls Claude Haiku
 * with structured output to produce display_title, display_description, best_for,
 * shelf/sub_shelf, and tags, then writes the results back.
 *
 * Runs daily at 5am UTC — two hours after sync-catalog adds new skills.
 * ENRICH_PER_RUN env var controls how many skills to process per run (default 200).
 * At CONCURRENCY=3 and ~2s per Haiku call, 200 skills ≈ 135s — fits in 300s.
 */

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// ---------- auth ----------

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ---------- taxonomy ----------

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

const SYSTEM_TEXT = `You write marketplace catalog copy for Claudinho, a directory that helps NON-TECHNICAL founders
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
- Never invent facts the raw metadata doesn't support.`;

const TAXONOMY_TEXT = [
  "ALLOWED VALUES — choose shelf + subShelf from exactly this map (force the closest fit, never invent a new one):",
  ...Object.entries(SHELVES).map(([s, subs]) => `  ${s}: ${subs.join(", ")}`),
  "",
  "tags — choose 2–5 from exactly these families (include an Audience tag and a Setup tag when inferable):",
  ...Object.entries(TAG_FAMILIES).map(([f, t]) => `  ${f}: ${t.join(", ")}`),
].join("\n");

const SYSTEM_BLOCKS: Anthropic.TextBlockParam[] = [
  { type: "text", text: `${SYSTEM_TEXT}\n\n${TAXONOMY_TEXT}`, cache_control: { type: "ephemeral" } },
];

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
      tags: { type: "array", minItems: 2, maxItems: 5, items: { type: "string", enum: [...ALL_TAGS] } },
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

// Few-shot examples — cache_control on the last result block so the API reuses
// system + tools + few-shot across all calls in this run.
const FEWSHOT_MSGS: Anthropic.MessageParam[] = (() => {
  const examples: { in: string; out: CardContent }[] = [
    {
      in: `name:pptx desc:"Use this skill any time a .pptx file is involved — creating slide decks, pitch decks, presentations; reading/extracting text; editing; templates, layouts, speaker notes."`,
      out: { display_title: "Turn a doc into a presentable slide deck", display_description: "Reads a memo, notes, or research summary and builds an editable .pptx with sectioned slides, speaker notes, and a flow that holds together.", bestFor: "Turning a written argument into a deck without losing the argument.", shelf: "product", subShelf: "communication", tags: ["atomic", "no-setup", "from-file", "from-text"], confidence: 0.85 },
    },
    {
      in: `name:skill-creator desc:"Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, optimize, run evals."`,
      out: { display_title: "Turn a rough idea into a publishable skill", display_description: "Takes a half-formed \"I keep doing X manually\" and produces a structured SKILL.md with the frontmatter, triggers, and body conventions Claude expects.", bestFor: "Authoring or fixing a SKILL.md when you'd rather not memorize the spec.", shelf: "engineering", subShelf: "skill-authoring", tags: ["meta", "for-engineers", "no-setup", "from-text"], confidence: 0.9 },
    },
    {
      in: `name:seo-audit desc:"Crawl a site and audit SEO; cross-reference search console; find underperforming pages."`,
      out: { display_title: "Find pages on your site leaking traffic", display_description: "Crawls your site, cross-references search-console data, and surfaces the few pages with the biggest gap between intent and rank — with a specific fix for each.", bestFor: "Marketers and founders whose site ranks but doesn't convert the right intent.", shelf: "marketing", subShelf: "seo-content", tags: ["atomic", "for-marketers", "for-founders", "needs-integration", "from-url"], confidence: 0.92 },
    },
  ];
  const msgs: Anthropic.MessageParam[] = [];
  examples.forEach((ex, i) => {
    msgs.push({ role: "user", content: ex.in });
    msgs.push({ role: "assistant", content: [{ type: "tool_use", id: `fs_${i}`, name: "emit_card_content", input: ex.out }] });
    const isLast = i === examples.length - 1;
    msgs.push({ role: "user", content: [{ type: "tool_result", tool_use_id: `fs_${i}`, content: "ok", ...(isLast ? { cache_control: { type: "ephemeral" as const } } : {}) }] });
  });
  return msgs;
})();

// ---------- types ----------

type SkillRow = { id: string; slug: string; skill_name: string; description_excerpt: string; content_input_hash: string | null };

// ---------- route ----------

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Strip any invisible/non-ASCII characters that break HTTP header encoding.
  // These sneak in when copy-pasting API keys into env var UIs.
  const apiKey = process.env.ANTHROPIC_API_KEY?.replace(/[^\x20-\x7E]/g, "").trim();
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;
  const BUDGET_MS = 250_000;

  const perRun = parseInt(process.env.ENRICH_PER_RUN ?? "200", 10);
  const concurrency = 3;

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const anthropic = new Anthropic({ apiKey });

  // Load un-enriched skills, prioritising the most recently indexed (newest skills.sh additions).
  const rows = await loadPending(db, perRun);
  console.log(`[cron/generate-content] ${rows.length} skills to enrich`);

  let ok = 0, review = 0, pending = 0;
  const sampleIssues: string[] = [];

  for (let i = 0; i < rows.length; i += concurrency) {
    if (elapsed() > BUDGET_MS) break;
    const batch = rows.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((r) => processRow(anthropic, r)));
    await Promise.all(results.map((r) => writeBack(db, r)));
    for (const r of results) {
      if (r.status === "ok") ok++;
      else if (r.status === "review") review++;
      else {
        pending++;
        if (sampleIssues.length < 3) sampleIssues.push(`${r.row.slug}: ${r.issues.join(", ")}`);
      }
    }
  }

  const remaining = await countPending(db);

  return Response.json({
    ok: true,
    elapsedMs: elapsed(),
    processed: ok + review + pending,
    statusOk: ok,
    statusReview: review,
    statusPending: pending,
    remaining,
    sampleIssues,
  });
}

// ---------- model ----------

const TRIGGER_RE = /use this|trigger when|whenever the user|this skill/i;

async function callModel(anthropic: Anthropic, name: string, desc: string): Promise<CardContent | null> {
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
    system: SYSTEM_BLOCKS,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "emit_card_content" },
    messages: [...FEWSHOT_MSGS, { role: "user", content: `name:${name} desc:"${(desc ?? "").replace(/"/g, "'")}"` }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") return null;
  return block.input as CardContent;
}

function validate(c: CardContent): { issues: string[]; shelfInvalid: boolean } {
  const issues: string[] = [];
  if (!c.display_title || c.display_title.length > 52) issues.push(`title-len:${c.display_title?.length}`);
  const dlen = c.display_description?.length ?? 0;
  if (dlen < 90 || dlen > 205) issues.push(`desc-len:${dlen}`);
  if (!c.bestFor || c.bestFor.length > 105) issues.push(`bestFor-len:${c.bestFor?.length}`);
  let shelfInvalid = false;
  const shelfList = SHELVES[c.shelf];
  if (!shelfList) { issues.push(`bad-shelf:${c.shelf}`); shelfInvalid = true; }
  else if (!shelfList.includes(c.subShelf)) issues.push(`bad-subShelf:${c.subShelf}`);
  if (!Array.isArray(c.tags) || c.tags.length < 2 || c.tags.length > 5) issues.push("tags-count");
  else { const bad = c.tags.filter((t) => !ALL_TAGS.has(t)); if (bad.length) issues.push(`bad-tags:${bad.join(",")}`); }
  return { issues, shelfInvalid };
}

type ProcessResult = {
  row: SkillRow;
  content: CardContent | null;
  status: "ok" | "review" | "pending";
  issues: string[];
};

async function processRow(anthropic: Anthropic, row: SkillRow): Promise<ProcessResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let c: CardContent | null;
    try {
      c = await callModel(anthropic, row.skill_name, row.description_excerpt);
    } catch (e) {
      if (attempt === 1) return { row, content: null, status: "pending", issues: [`api:${String(e).slice(0, 60)}`] };
      continue;
    }
    if (!c) {
      if (attempt === 1) return { row, content: null, status: "pending", issues: ["no-tool-use"] };
      continue;
    }
    const hasTrigger = TRIGGER_RE.test(c.display_description);
    const { issues, shelfInvalid } = validate(c);
    if (attempt === 0 && (hasTrigger || shelfInvalid)) continue;
    const allIssues = hasTrigger ? [...issues, "trigger-language"] : issues;
    const clean = allIssues.length === 0 && c.confidence >= 0.6;
    return { row, content: c, status: clean ? "ok" : "review", issues: allIssues };
  }
  return { row, content: null, status: "pending", issues: ["exhausted"] };
}

// ---------- db ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadPending(db: any, limit: number): Promise<SkillRow[]> {
  const { data, error } = await db
    .from("skill_listing")
    .select("id, slug, skill_name, description_excerpt, content_input_hash")
    .eq("status", "indexed")
    .or("content_status.is.null,content_status.eq.pending")
    .order("last_indexed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`skill_listing: ${error.message}`);
  return (data ?? []) as SkillRow[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countPending(db: any): Promise<number> {
  const { count, error } = await db
    .from("skill_listing")
    .select("id", { count: "exact", head: true })
    .eq("status", "indexed")
    .or("content_status.is.null,content_status.eq.pending");
  if (error) return -1;
  return count ?? 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeBack(db: any, r: ProcessResult) {
  if (!r.content) {
    await db.from("skill_listing").update({ content_status: "pending" }).eq("id", r.row.id);
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
  }).eq("id", r.row.id);
}
