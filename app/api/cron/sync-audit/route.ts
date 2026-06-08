/**
 * Cron: fetch security audit results from skills.sh for all matched skills.
 *
 * Called weekly by Vercel Cron. Protected by CRON_SECRET.
 * Processes skills in stale-first order (oldest fetched_at first), with a
 * per-run cap so the route stays within function timeout limits.
 *
 * Mirrors scripts/sync-audit-data.ts — that script is for manual runs.
 */

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getVercelOidcToken } from "@vercel/oidc";

// ---------- auth ----------

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ---------- types ----------

type SkillWithId = { id: string; skillssh_id: string };

type AuditEntry = {
  provider: string;
  slug: string;
  status: string;
  summary: string | null;
  riskLevel: string | null;
  categories?: string[];
  auditedAt: string | null;
};

type AuditResponse = { audits: AuditEntry[] };

// ---------- config ----------

const API_BASE = "https://skills.sh/api/v1";
// AUDIT_PER_RUN_LIMIT: set to 1500 in Vercel env for initial bootstrap
// (fills the full 300s window at ~200ms/skill). Default 250 for weekly maintenance.
const PER_RUN_LIMIT = parseInt(process.env.AUDIT_PER_RUN_LIMIT ?? "250", 10);
const GAP_MS = 200;
const UA = "claudinho-cron/1.0 (+claudinho.xyz)";

// ---------- route ----------

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = await getVercelOidcToken();
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const headers = buildHeaders(token);

  // Pick the stalest skills first (null fetched_at = never fetched, highest priority).
  const skills = await loadStalestSkills(db, PER_RUN_LIMIT);
  console.log(`[cron/sync-audit] processing ${skills.length} skills`);

  let fetched = 0, notAudited = 0, failed = 0, totalEntries = 0;

  for (const skill of skills) {
    try {
      const result = await fetchAudit(headers, skill.skillssh_id);
      if (result === null) { notAudited++; continue; }
      await upsertAudits(db, skill.id, result.audits);
      totalEntries += result.audits.length;
      fetched++;
    } catch (err) {
      failed++;
      console.warn(`[cron/sync-audit] failed ${skill.skillssh_id}: ${(err as Error).message}`);
    }
    await sleep(GAP_MS);
  }

  return Response.json({ ok: true, processed: skills.length, fetched, notAudited, failed, totalEntries });
}

// ---------- fetch ----------

async function fetchAudit(headers: Record<string, string>, skillsshId: string): Promise<AuditResponse | null> {
  const res = await fetch(`${API_BASE}/skills/audit/${skillsshId}`, { headers });
  if (res.status === 404) return null;
  if (res.status === 429) {
    const retry = parseInt(res.headers.get("Retry-After") ?? "60", 10);
    await sleep(retry * 1000);
    return fetchAudit(headers, skillsshId);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as AuditResponse;
}

function buildHeaders(token: string): Record<string, string> {
  return { "User-Agent": UA, accept: "application/json", Authorization: `Bearer ${token}` };
}

// ---------- db ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadStalestSkills(db: any, limit: number): Promise<SkillWithId[]> {
  // Join skill_listing with the most recent audit fetch time per skill.
  // Skills with no audit rows sort first (null fetched_at).
  const { data, error } = await db
    .from("skill_listing")
    .select(`
      id,
      skillssh_id,
      skill_audit ( fetched_at )
    `)
    .not("skillssh_id", "is", null)
    .eq("status", "indexed")
    .limit(limit * 4);  // oversample — we'll re-sort client-side

  if (error) throw new Error(`skill_listing: ${error.message}`);

  type Row = { id: string; skillssh_id: string; skill_audit: { fetched_at: string }[] };

  return (data as unknown as Row[])
    .map((row) => {
      const latest = row.skill_audit
        .map((a) => a.fetched_at)
        .sort()
        .pop() ?? null;
      return { id: row.id, skillssh_id: row.skillssh_id, latestFetch: latest };
    })
    .sort((a, b) => {
      if (!a.latestFetch && !b.latestFetch) return 0;
      if (!a.latestFetch) return -1;
      if (!b.latestFetch) return 1;
      return a.latestFetch < b.latestFetch ? -1 : 1;
    })
    .slice(0, limit)
    .map(({ id, skillssh_id }) => ({ id, skillssh_id }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertAudits(db: any, skillId: string, audits: AuditEntry[]) {
  const now = new Date().toISOString();
  const rows = audits.map((a) => ({
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
  if (error) throw new Error(`upsert skill_audit: ${error.message}`);
}

// ---------- utils ----------

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
