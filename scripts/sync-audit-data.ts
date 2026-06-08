/**
 * scripts/sync-audit-data.ts
 *
 * Claudinho — fetch security audit results from skills.sh and store them in
 * the skill_audit table.
 *
 * Requires skillssh_id to be populated first. Run sync-install-counts.ts
 * before this script — it bootstraps skillssh_id on first match.
 *
 * Providers audited by skills.sh:
 *   Gen Agent Trust Hub, Socket, Snyk, Runlayer, ZeroLeaks
 *
 * Audits are generated automatically after a skill's first install (with
 * possible delay). 404 = not yet audited — silently skipped.
 *
 * Flags:
 *   --stale N   Only re-fetch audits fetched more than N days ago (default: all)
 *   --limit N   Stop after N skills (useful for initial bootstrap)
 *
 * Run:
 *   npx tsx scripts/sync-audit-data.ts
 *   npx tsx scripts/sync-audit-data.ts --stale 7
 *   npx tsx scripts/sync-audit-data.ts --limit 200
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Auth: Vercel OIDC — `vercel link && vercel env pull` for local runs.
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getVercelOidcToken } from "@vercel/oidc";

loadEnv({ path: ".env.local" });

// ---------- flags ----------

const argv = process.argv.slice(2);

const STALE_DAYS: number | null = (() => {
  const i = argv.indexOf("--stale");
  return i >= 0 ? parseInt(argv[i + 1] ?? "7", 10) : null;
})();

const LIMIT: number | null = (() => {
  const i = argv.indexOf("--limit");
  return i >= 0 ? parseInt(argv[i + 1] ?? "200", 10) : null;
})();

// ---------- config ----------

const API_BASE = "https://skills.sh/api/v1";
const REQUEST_GAP_MS = 200;  // audit endpoint is per-skill; be a touch more conservative
const USER_AGENT = "claudinho-audit/0.1 (+claudinho.xyz)";

// ---------- env ----------

function required(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing env: ${name}`); process.exit(1); }
  return v;
}

const db = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

// ---------- types ----------

type SkillWithId = {
  id: string;          // our DB uuid
  skillssh_id: string; // "owner/repo/slug"
};

type AuditEntry = {
  provider: string;
  slug: string;           // provider_slug
  status: string;         // 'pass' | 'warn' | 'fail'
  summary: string | null;
  riskLevel: string | null;
  categories?: string[];
  auditedAt: string | null;
};

type AuditResponse = {
  id: string;
  source: string;
  slug: string;
  audits: AuditEntry[];
};

// ---------- main ----------

async function main() {
  const token = await getVercelOidcToken();

  const skills = await loadSkillsWithId();
  console.log(`[audit] ${skills.length} skills have skillssh_id set`);

  // Apply --stale filter: skip skills whose audit was fetched recently.
  const queue = STALE_DAYS != null ? await filterStale(skills, STALE_DAYS) : skills;
  const limited = LIMIT != null ? queue.slice(0, LIMIT) : queue;

  console.log(`[audit] ${limited.length} to fetch${STALE_DAYS != null ? ` (stale >${STALE_DAYS}d)` : ""}${LIMIT != null ? ` (limit ${LIMIT})` : ""}`);

  let fetched = 0;
  let notAudited = 0;
  let failed = 0;
  let totalAuditEntries = 0;

  for (const skill of limited) {
    try {
      const result = await fetchAudit(token, skill.skillssh_id);
      if (result === null) {
        notAudited++;
        continue;
      }
      await upsertAuditRows(skill.id, result.audits);
      totalAuditEntries += result.audits.length;
      fetched++;
      if (fetched % 50 === 0) {
        console.log(`[audit] progress: ${fetched}/${limited.length} fetched, ${notAudited} not audited yet`);
      }
    } catch (err) {
      failed++;
      console.warn(`[audit] FAILED ${skill.skillssh_id}: ${(err as Error).message}`);
    }
    await sleep(REQUEST_GAP_MS);
  }

  console.log(`[audit] done — fetched=${fetched} not_audited_yet=${notAudited} failed=${failed} audit_entries=${totalAuditEntries}`);
}

// ---------- fetch ----------

async function fetchAudit(token: string, skillsshId: string): Promise<AuditResponse | null> {
  // skillsshId is "owner/repo/slug" → maps directly to /audit/owner/repo/slug
  const url = `${API_BASE}/skills/audit/${skillsshId}`;
  const res = await fetch(url, { headers: buildHeaders(token) });

  if (res.status === 404) return null;  // not yet audited — normal for new skills
  if (res.status === 401) throw new Error("401 Unauthorized — check OIDC Federation setting");
  if (res.status === 429) {
    const retry = res.headers.get("Retry-After") ?? "60";
    console.warn(`[audit] rate limited — waiting ${retry}s`);
    await sleep(parseInt(retry, 10) * 1000);
    return fetchAudit(token, skillsshId);  // retry
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

  return (await res.json()) as AuditResponse;
}

function buildHeaders(token: string): Record<string, string> {
  return { "User-Agent": USER_AGENT, accept: "application/json", Authorization: `Bearer ${token}` };
}

// ---------- supabase ----------

async function loadSkillsWithId(): Promise<SkillWithId[]> {
  const out: SkillWithId[] = [];
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await db
      .from("skill_listing")
      .select("id, skillssh_id")
      .not("skillssh_id", "is", null)
      .eq("status", "indexed")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`skill_listing read failed: ${error.message}`);
    if (!data?.length) break;
    for (const row of data as SkillWithId[]) out.push(row);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function filterStale(skills: SkillWithId[], days: number): Promise<SkillWithId[]> {
  if (skills.length === 0) return [];
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const ids = skills.map(s => s.id);

  // Find skill_ids that have a recent audit entry (any provider).
  const freshIds = new Set<string>();
  const PAGE = 1000;
  for (let i = 0; i < ids.length; i += PAGE) {
    const { data } = await db
      .from("skill_audit")
      .select("skill_id")
      .in("skill_id", ids.slice(i, i + PAGE))
      .gt("fetched_at", cutoff);
    for (const row of (data ?? []) as { skill_id: string }[]) freshIds.add(row.skill_id);
  }

  return skills.filter(s => !freshIds.has(s.id));
}

async function upsertAuditRows(skillId: string, audits: AuditEntry[]): Promise<void> {
  const now = new Date().toISOString();
  const rows = audits.map(a => ({
    skill_id: skillId,
    provider: a.provider,
    provider_slug: a.slug,
    status: a.status,
    summary: a.summary ?? null,
    risk_level: a.riskLevel ?? null,
    categories: a.categories ?? null,
    audited_at: a.auditedAt ?? null,
    fetched_at: now,
  }));
  const { error } = await db
    .from("skill_audit")
    .upsert(rows, { onConflict: "skill_id,provider_slug" });
  if (error) throw new Error(`upsert skill_audit failed: ${error.message}`);
}

// ---------- utils ----------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- go ----------

main().catch((err) => { console.error("[audit] fatal:", err); process.exit(1); });
