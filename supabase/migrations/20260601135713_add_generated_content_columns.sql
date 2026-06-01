-- Add AI-generated card-content + classification columns to skill_listing.
--
-- These are written by scripts/generate-content.ts. They are SEPARATE from the
-- raw `name` / `description` columns, which are never overwritten — the card
-- prefers the generated fields and falls back to raw when absent.
--
-- The repo has no migration runner; apply this in the Supabase SQL editor
-- (Dashboard → SQL) or via `psql "$DATABASE_URL" -f <this file>`.
-- Idempotent: safe to run more than once.

alter table public.skill_listing
  add column if not exists display_title          text,
  add column if not exists display_description    text,
  add column if not exists best_for               text,
  add column if not exists shelf                  text,
  add column if not exists sub_shelf              text,
  add column if not exists tags                   text[],
  add column if not exists content_confidence     numeric,
  add column if not exists content_status         text default 'pending',  -- 'pending' | 'ok' | 'review'
  add column if not exists content_generated_at   timestamptz,
  add column if not exists content_input_hash     text;                     -- hash of name+description for incremental re-runs

-- Browse reads shelf/sub_shelf counts and filters by status; index the hot paths.
create index if not exists skill_listing_shelf_idx        on public.skill_listing (shelf);
create index if not exists skill_listing_content_status_idx on public.skill_listing (content_status);
