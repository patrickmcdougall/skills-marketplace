-- Add install-bundle columns to skill_listing and install_count to skill_signal.
--
-- Written by the install-path feature. Applied manually via Supabase SQL editor
-- (Dashboard → SQL) or `psql "$DATABASE_URL" -f <this file>`.
-- Idempotent: safe to run more than once.

alter table public.skill_listing
  add column if not exists distribution_mode  text default 'standard',      -- 'standard' | 'source-only'
  add column if not exists bundle_url         text,                          -- public URL of the hosted .skill
  add column if not exists bundle_status      text default 'pending',        -- 'pending' | 'ready' | 'failed' | 'source-only'
  add column if not exists bundle_source_ref  text,                          -- commit SHA the bundle was built from
  add column if not exists bundle_packaged_at timestamptz,
  add column if not exists skill_path         text;                          -- path to skill dir inside repo (null = root)

-- Our own install tracking — separate from install_count_estimate which mirrors skills.sh.
alter table public.skill_signal
  add column if not exists install_count int default 0;

create index if not exists skill_listing_bundle_status_idx on public.skill_listing (bundle_status);
