-- All app access uses the service-role key (which bypasses RLS), so enabling
-- RLS with no policies simply blocks direct anon/authenticated API access.
-- skill_listing and skill_signal are included even though the dashboard may
-- already have RLS on them — enabling RLS twice is a no-op, and the repo
-- should prove the full lockdown (skill_listing.bundle_url feeds the trusted
-- .skill download in /i/[slug], so anon write access there would be a
-- supply-chain hole).
alter table public.publisher_profile enable row level security;
alter table public.repo_info enable row level security;
alter table public.skill_audit enable row level security;
alter table public.skill_listing enable row level security;
alter table public.skill_signal enable row level security;
