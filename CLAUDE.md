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
- 4 routes live: `/` (landing), `/browse`, `/skills/[slug]`, `/publishers/[slug]`
- ~2200+ skills indexed in Supabase
- Stars data populated
- Mobile pass done

### Broken / missing
- **Shelf categorization broken** — all shelves show 0. `shelf/subShelf` fields empty in DB. LLM classification script not built yet.
- **Card content insufficient** — skill names are technical. Raw SKILL.md descriptions are trigger-language, not user-friendly.
- **Install counts all zero** — skills.sh scraper failing with 401 (missing `SKILLSSH_API_KEY`).
- **Browse not wired to Supabase** — browse page still runs on mock data (`lib/data.ts`).
- **No working install button** — no .skill file hosting, no redirect counter (`/i/[slug]`).
- **Publisher profiles are shells** — routes exist, no real content.
- **No OG/Twitter cards** — links preview as bare URLs.
- **No "copy Slack message" button.**

---

## Launch blockers (priority order)

1. **skills.sh API key** → email skills-api@vercel.com → fixes catalog growth + historical install counts
2. **AI content script** → one script run generates `display_title`, `display_description`, `bestFor`, `shelf`/`subShelf`/`tags` for all 2000+ skills
3. **Wire browse to Supabase** → browse page currently runs on mock data
4. **Redirect counter** (`/i/[slug]`) → Claudinho's own install tracking
5. **Auto-generated publisher profiles** → pull from GitHub API, aggregate skills by shelf

After these: OG image generation (`@vercel/og`), "copy Slack message" button on detail page.

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
