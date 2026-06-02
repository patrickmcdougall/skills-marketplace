-- GitHub profile data for skill publishers.
--
-- Populated by scripts/sync-publisher-profiles.ts (GitHub Users API).
-- Apply in the Supabase SQL editor or via psql.
-- Idempotent: safe to re-run.

create table if not exists public.publisher_profile (
  handle              text primary key,            -- GitHub username (lowercase)
  display_name        text,                         -- "Garry Tan" (null = same as handle)
  bio                 text,                         -- GitHub bio
  company             text,                         -- GitHub company field
  blog                text,                         -- website / blog URL
  twitter_username    text,
  avatar_url          text,
  gh_followers        integer,
  fetched_at          timestamptz not null default now()
);

-- Fast lookup by handle (already PK, but explicit for clarity).
create index if not exists publisher_profile_handle_idx on public.publisher_profile (handle);
