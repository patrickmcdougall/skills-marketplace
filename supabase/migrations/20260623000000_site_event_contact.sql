-- Optional contact field for site_feedback events (visitor leaves an email so
-- we can follow up). Nullable; only the 'site_feedback' event populates it.
-- Idempotent — safe to re-run via `supabase db push`.
alter table public.site_event add column if not exists contact text;
