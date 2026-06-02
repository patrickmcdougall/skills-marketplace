-- Add location column to publisher_profile.
-- Apply in the Supabase SQL editor. Idempotent.

alter table public.publisher_profile
  add column if not exists location text;
