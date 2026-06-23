-- Visitor feedback — one open question + optional contact.
-- Written server-side via /api/feedback using the service-role key.
-- Idempotent.

create table if not exists public.skill_feedback (
  id          uuid primary key default gen_random_uuid(),
  message     text not null,
  contact     text,                 -- optional email / handle
  pathname    text,                 -- page the visitor was on
  referrer    text,                 -- where they came from, if any
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists skill_feedback_created_at_idx
  on public.skill_feedback (created_at desc);
