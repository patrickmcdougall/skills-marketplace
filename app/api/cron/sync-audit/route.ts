/**
 * Cron: fetch security audit results for all indexed skills.
 *
 * Called daily by Vercel Cron. Protected by CRON_SECRET.
 * Processes skills in stale-first order (never-fetched first) using parallel
 * batches. At CONCURRENCY=5 and ~200ms per API call, a single 300s run
 * handles ~5 000 skills — enough to cover the full catalog in one pass.
 *
 * Env vars (optional):
 *   AUDIT_CONCURRENCY   parallel slots per batch  (default 5)
 *   AUDIT_PER_RUN_LIMIT max skills per run        (default 5000)
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
const CONCURRENCY = parseInt(process.env.AUDIT_CONCURRENCY ?? "5", 10);
const PER_RUN_LIMIT = parseInt(process.env.AUDIT_PER_RUN_LIMIT ?? "5000", 10);
// Small pause between batches so we don't burst the audit API.
const BATCH_GAP_MS = 50;
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

  const skills = await loadStalestSkills(db, PER_RUN_LIMIT);
  console.log(`[cron/sync-audit] processing ${skills.length} skills (concurrency=${CONCURRENCY})`);

  let fetched = 0, notAudited = 0, failed = 0, totalEntries = 0;

  for (let i = 0; i < skills.length; i += CONCURRENCY) {
    const batch = skills.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (skill) => {
        const result = await fetchAudit(headers, skill.skillssh_id);
        if (result === null) return { notAudited: true as const };
        await upsertAudits(db, skill.id, result.audits);
        return { entries: result.audits.length };
      })
    );
    for (const r of results) {
      if (r.status === "rejected") {
        failed++;
        console.warn(`[cron/sync-audit] error: ${r.reason}`);
      } else if ("notAudited" in r.value) {
        notAudited++;
      } else {
        fetched++;
        totalEntries += r.value.entries;
      }
    }
    if (i + CONCURRENCY < skills.length) await sleep(BATCH_GAP_MS);
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
  // Oversample so the client-side stale-first sort has enough candidates,
  // but cap at 10 000 to keep the query fast regardless of limit size.
  const fetchLimit = Math.min(limit * 2, 10_000);
  const { data, error } = await db
    .from("skill_listing")
    .select(`id, skillssh_id, skill_audit ( fetched_at )`)
    .not("skillssh_id", "is", null)
    .eq("status", "indexed")
    .limit(fetchLimit);

  if (error) throw new Error(`skill_listing: ${error.message}`);

  type Row = { id: string; skillssh_id: string; skill_audit: { fetched_at: string }[] };

  return (data as unknown as Row[])
    .map((row) => {
      const latest = row.skill_audit.map((a) => a.fetched_at).sort().pop() ?? null;
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
