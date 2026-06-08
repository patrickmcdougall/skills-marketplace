@AGENTS.md

# Claudinho — Skills Marketplace

A public web marketplace for Claude skills. **Not an Anthropic product — Patrick's independent project.**

- **Name:** Claudinho. Tagline: "pick your lineup of skills."
- **Canonical user:** Alex Vilhena — sales-leaning, non-technical founder (Malga, a Brazilian payments co). He doesn't search for skills; someone he trusts sends him a link. He picks 3–5 skills to Slack to his team. He is the evaluator, not the end user.
- **Core framing:** Lead with workflow potential, not concept explanation. No "what is a skill?" callouts. People learn what skills are by seeing what they do.
- **Competitor:** skills.sh (by Vercel) — 8000+ skills, 420k+ installs, shaped for developers. Our wedge: outcome-framed cards + non-technical install path (browse AND install without a terminal).

Deep context lives in `~/Documents/Claude/Projects/Skills marketplace/` — read `claudinho-session-briefing.md` for the full fast-ramp, `value-props-and-features.md` for current strategy.

---

## Design system (LOCKED — do not drift)

- **Type:** Geist everywhere. JetBrains Mono only for counts, slugs, install commands, tag chips, version pins. No serif. No display italics.
- **Color:** Orange `#F25C1F` primary on cream `#efece4`. Verified green `#2e8a4f` — verification chips only, never as general accent. Ink `#1A1A18`.
- **Shape:** Actions are square (2px radius). Labels/chips are pill (999px). Never swap.
- **Cards:** skill cards use outcome title + byline + install count + stars. Publisher cards are GitHub-profile-shaped (avatar / name / handle / stat strip / skills).
- **No editor's picks badge** — dropped. Community signal (installs, stars) does the trust work.
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
- **Motion:** drift = 60s linear infinite, hover lift = 200ms ease-out, no decorative animation elsewhere.

---

## Tech stack

- Next.js (App Router) + Vercel
- Supabase — two tables: `skill_listing` (one row per skill), `skill_signal` (stars, forks, install count)
- Tailwind + shadcn/ui
- Scripts in `scripts/` — indexing pipeline, content rewrite, install count sync

---

## Current state

### Working
- Routes: `/` (landing), `/skills` (browse), `/skills/[slug]` (detail), `/creators`, `/creators/[handle]`, `/i/[slug]` (install counter + packager)
- 929+ skills pre-packaged as `.skill` files in Supabase Storage; on-demand packaging for the rest
- Browse wired to Supabase (`getBrowseSkills()` in `lib/db.ts`) — not mock data
- AI content pipeline live: `display_title`, `display_description`, `best_for`, `shelf`, `sub_shelf`, `tags` generated for skills with `content_status = 'ok'`
- skills.sh API integrated — catalog sync (`sync-catalog`), install count sync (`sync-signals`), audit data (`sync-audit`)
- Install counter + bot filtering at `/i/[slug]` — increments `skill_signal.install_count`
- Publisher/creator profiles — real data from GitHub API via `sync-publisher-profiles`
- OG images — exist for `/`, `/creators/[handle]`, `/skills/[slug]`
- "Copy for Slack" button on skill detail pages (`CopyForSlack.tsx`)
- Mobile nav hamburger drawer, active states, focus management

### Still rough / known gaps
- **SecuritySection permissions** — fake pills hidden pending real permission model
- **Shelf filter** — depends on `shelf` field being populated; coverage may be partial
- **Install counts** — real-time accuracy limited by read-modify-write at scale (fine at current traffic)

---

## Key decisions (don't re-litigate)

- No editor's picks badge — dropped
- No Figma — design in prose, Claude Code builds
- No database reviews/ratings at launch
- No full-text search at launch — filter + sort does the work at this scale
- No accounts/sign-in at launch
- Publisher trust comes from GitHub signal (followers, stars), not Claudinho-issued badges
- Anthropic accounts for ~58% of the catalog — this is fine
- The non-technical install path (`.skill` drag-into-Cowork) is **launch-critical**, not V1.1 — it's the half of the wedge that differentiates from skills.sh
- Primary install action should be `.skill` download / drag-into-Cowork. Copy CLI command is secondary.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
