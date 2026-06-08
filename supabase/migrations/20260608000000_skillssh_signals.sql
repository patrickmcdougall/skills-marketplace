-- skills.sh identity, trending signals, and audit data.
--
-- Apply in the Supabase SQL editor (Dashboard → SQL) or via:
--   psql "$DATABASE_URL" -f supabase/migrations/20260608000000_skillssh_signals.sql
-- Idempotent: safe to re-run.

-- ── skill_listing: skills.sh identity ────────────────────────────────────────

alter table public.skill_listing
  -- Stable ID from skills.sh: "owner/repo/slug" (e.g. "vercel-labs/skills/find-skills").
  -- Set by sync-catalog at index time. Used as the primary key for all per-skill
  -- API calls (audit, detail, hash check).
  add column if not exists skillssh_id    text unique,

  -- Direct URL on skills.sh (e.g. "https://skills.sh/vercel-labs/skills/find-skills").
  add column if not exists skillssh_url   text,

  -- Content hash from the skills.sh detail endpoint. Used to detect SKILL.md changes
  -- so we only re-fetch detail when content actually changes.
  add column if not exists skillssh_hash  text,

  -- True when the publisher is recognised as first-party by the /curated endpoint
  -- (i.e. a company teaching how to use their own product).
  add column if not exists is_first_party boolean not null default false;

create index if not exists skill_listing_skillssh_id_idx    on public.skill_listing (skillssh_id);
create index if not exists skill_listing_is_first_party_idx on public.skill_listing (is_first_party);

-- Ensure skill_signal has a unique constraint on skill_id (required for upsert
-- in sync-catalog when inserting brand-new skills from skills.sh).
create unique index if not exists skill_signal_skill_id_key on public.skill_signal (skill_id);

-- ── skill_signal: trending / velocity signals ─────────────────────────────────

alter table public.skill_signal
  -- From skills.sh hot view: installs during the same clock-hour yesterday.
  add column if not exists installs_yesterday  int,

  -- From skills.sh hot view: change vs yesterday (can be negative).
  add column if not exists trending_velocity   int,

  -- Zero-based position in skills.sh trending view at last sync.
  add column if not exists trending_rank       int,

  -- Zero-based position in skills.sh hot view at last sync.
  add column if not exists hot_rank            int;

-- ── skill_audit: security audit results ──────────────────────────────────────

create table if not exists public.skill_audit (
  id            uuid        primary key default gen_random_uuid(),
  skill_id      uuid        not null references public.skill_listing(id) on delete cascade,

  -- Provider identity
  provider      text        not null,  -- "Gen Agent Trust Hub", "Socket", "Snyk", "Runlayer", "ZeroLeaks"
  provider_slug text        not null,  -- "agent-trust-hub", "socket", "snyk", "runlayer", "zeroleaks"

  -- Audit result
  status        text        not null,  -- 'pass' | 'warn' | 'fail'
  summary       text,                  -- one-line finding from the provider
  risk_level    text,                  -- 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  categories    text[],                -- Agent Trust Hub only: detected risk categories

  -- Timestamps
  audited_at    timestamptz,           -- when the provider ran the audit
  fetched_at    timestamptz not null default now(),  -- when we last fetched this row

  unique (skill_id, provider_slug)
);

create index if not exists skill_audit_skill_id_idx  on public.skill_audit (skill_id);
create index if not exists skill_audit_risk_level_idx on public.skill_audit (risk_level);
create index if not exists skill_audit_status_idx     on public.skill_audit (status);
