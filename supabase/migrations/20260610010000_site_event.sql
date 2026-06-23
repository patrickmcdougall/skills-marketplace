-- Funnel events + lightweight feedback, written only via /api/event (service role).
-- Idempotent: this migration was first applied manually via the SQL Editor, so a
-- later `supabase db push` must be able to re-run it as a no-op.
create table if not exists public.site_event (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event text not null,
  skill_slug text,
  detail text
);

create index if not exists site_event_event_idx on public.site_event (event, created_at desc);
create index if not exists site_event_slug_idx on public.site_event (skill_slug);

alter table public.site_event enable row level security;
