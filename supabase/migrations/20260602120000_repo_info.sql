-- Repo-level metadata for skills repos (name, description, stars).
-- Populated by scripts/sync-repo-info.ts. Idempotent.

create table if not exists public.repo_info (
  repo_path    text primary key,   -- e.g. "obra/superpowers"
  name         text,               -- e.g. "superpowers"
  description  text,
  stars        integer,
  fetched_at   timestamptz not null default now()
);
