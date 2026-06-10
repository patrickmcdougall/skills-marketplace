-- All app access uses the service-role key (which bypasses RLS), so enabling
-- RLS with no policies simply blocks direct anon/authenticated API access.
alter table public.publisher_profile enable row level security;
alter table public.repo_info enable row level security;
alter table public.skill_audit enable row level security;
