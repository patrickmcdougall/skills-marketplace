<!-- /autoplan restore point: /Users/patrickmsterea/.gstack/projects/patrickmcdougall-skills-marketplace/main-autoplan-restore-20260608-162042.md -->
# Claudinho — TODOs

Generated from the /plan-design-review session on 2026-06-01. Each item references the DESIGN.md decision that drives it.

---

## P1 — Blocks ship

- [x] **CSS: :focus-visible + .sr-only** — `app/claudinho.css`
  Added global `*:focus-visible` rule (accent orange outline) and `.sr-only` utility class. WCAG 2.4.7 + 1.3.1.

- [x] **Search input labels** — `app/skills/BrowseClient.tsx`
  Added `<label htmlFor="bp-search-q" className="sr-only">Search skills</label>` and `<label htmlFor="bp-creator-q" className="sr-only">Search creators</label>`. WCAG 1.3.1.

- [x] **Dead link: publishers band → /creators** — `app/page.tsx:106`
  Changed `href="#"` to `href="/creators"` on the "Browse all N publishers" end card.

- [ ] **Mobile nav: hamburger drawer** — `components/Nav.tsx`
  Below 640px: hide status chip + links; show hamburger icon. Opens full-width drawer with Browse / Creators / About + status chip at bottom.
  See DESIGN.md "Mobile nav (D12)".

---

## P2 — Same branch

- [ ] **Hero CTA hierarchy** — `app/page.tsx`
  Change "Browse the registry ↓" from `.lp-btn.solid` to `.lp-btn.accent`. Change "How we verify" from `.lp-btn.ghost` to a text link (`<a>` or `<Link>`, small size, below the button).
  See DESIGN.md "Decision (D4)".

- [ ] **Detail page: skill outcome summary above install panel** — `app/skills/[slug]/page.tsx`
  Add a 2–3 line outcome summary element at the top of `.dp-right`, above `.dp-install`. Pull from the skill's output description or first line of the output sample.
  See DESIGN.md "Decision (D5)".

- [ ] **Browse empty state: warm copy + 2 buttons** — `app/skills/BrowseClient.tsx` (`BrowseEmpty`)
  Update `BrowseEmpty` heading from "No skills match this filter." to "Nothing in that combination yet." Add second action button: "Browse all" linking to `/skills` (after clearing all filters).
  See DESIGN.md "Browse empty state (D6)".

- [ ] **Copy button feedback state** — skill detail install panel
  On `.copy` click: swap text to "copied", color to `var(--verified)`, revert after 1500ms.
  See DESIGN.md "Copy button feedback (D7)".

- [ ] **Root error.tsx** — `app/error.tsx`
  `'use client'` component. Heading: "Something went wrong." Paragraph: "The registry is temporarily unavailable. Try refreshing." Button: "Try again" calling `reset()`. Use `.pp-notfound` CSS pattern.
  See DESIGN.md "Root error boundary (D8)".

- [ ] **Install button deeplink + confirmation state** — `app/skills/[slug]/page.tsx` or detail client component
  Primary install button → deeplink `claude://install?skill=[slug]` → button shifts to "Opening Claude Code…" in `var(--verified)` for 2s → show fallback text "If it didn't open, copy the command below."
  See DESIGN.md "Install button flow (D9)".

- [ ] **Nav active state** — `components/Nav.tsx`
  Add `'use client'` + `usePathname()`. Active link: `color: var(--ink)`, `fontWeight: 500`. Add `aria-current="page"` on the active link.
  See DESIGN.md "Active state (D15)".

---

## P3 — Follow-up

- [ ] **Filter button touch targets** — `app/claudinho.css`
  `.bp-check` and `.bp-radio` have ~26px height. Add `min-height: 44px` or increase padding to meet the 44px touch target minimum.

- [ ] **FilterSubShelf negative-margin hack** — `app/skills/BrowseClient.tsx`
  `style={{ marginTop: -16, paddingTop: 0, borderTop: "none" }}` is an inline style. Move to a CSS class `.bp-fsection.sub-shelf` in `claudinho.css`.

- [ ] **Sort menu keyboard dismissal** — `app/skills/BrowseClient.tsx` (`BrowseTopBar`)
  `onBlur` on a div doesn't reliably close the sort menu on keyboard navigation. Replace with a click-outside listener or a proper `<details>`/`<select>` pattern.

- [ ] **Footer at 375px** — `app/claudinho.css`
  Footer goes to 2-column grid at 640px. Check behavior at 375px — may need 1-column fallback.
  Add `@media (max-width: 480px) { .lp-footer .inner { grid-template-columns: 1fr; } }`.

- [ ] **Inline styles audit** — multiple components
  Several inline styles should be CSS classes. Key ones: the clear-search `×` button in `BrowseClient.tsx`, the `FilterSubShelf` margin hack. See also the `style={{ fontSize: "18px" }}` on Nav logo link.

---

## /autoplan Review — 2026-06-08

### Phase 1: CEO Review `[subagent-only]`

**Plan summary:** UI polish + interaction state completion plan. 1 P1 item remaining (mobile nav), 6 P2 items, 5 P3 items. Generated from design review session on 2026-06-01.

**Premises evaluation:**

| Premise | Verdict | Notes |
|---------|---------|-------|
| "Shipping these UI items unlocks launch" | PARTIALLY HOLDS | True for the listed items, but plan is missing one P0 trust issue |
| "The install path is handled" | HOLDS | `/i/[slug]` route is live, sophisticated, `.skill` download is primary |
| "D9 deeplink is a P2 add-on" | DOES NOT HOLD | D9 as speced in DESIGN.md would REPLACE the current primary action — needs explicit decision |
| "SecuritySection shows meaningful trust" | DOES NOT HOLD | `PLACEHOLDER_PERMISSIONS` (SecuritySection.tsx:11-15) shows fabricated capabilities for every skill |

**What already exists (leveraged from codebase):**
- `/i/[slug]` route — full skill packaging, install counting, bot filtering, bundle caching — already live
- InstallCard.tsx — `.skill` download as primary, copy command secondary, copy-to-clipboard (text "copied") already done
- Copy text feedback (`copied` for 1400ms) already works — D7 only needs color change to `var(--verified)`
- Creator profiles, trust tooltips, ShareCard, DriftWall, trust/verification layer — all built since the session briefing

**CEO DUAL VOICES — CONSENSUS TABLE `[subagent-only]`:**
```
═══════════════════════════════════════════════════════════════
  Dimension                           Claude  Codex  Consensus
  ──────────────────────────────────── ─────── ─────── ─────────
  1. Premises valid?                   NO      N/A    [subagent-only]
  2. Right problem to solve?           YES     N/A    [subagent-only]
  3. Scope calibration correct?        NO      N/A    [subagent-only]
  4. Alternatives explored?            YES     N/A    [subagent-only]
  5. Competitive risks covered?        YES     N/A    [subagent-only]
  6. 6-month trajectory sound?         NO      N/A    [subagent-only]
═══════════════════════════════════════════════════════════════
```

**NOT in scope (deferred):**
- AI content script (display_title, shelf classification) — separate launch blocker, not in this plan
- Browse wiring to Supabase — separate launch blocker
- OG image generation — V1 follow-up
- Install count read-modify-write atomicity fix — fine at current traffic (acknowledged in code comment)

**Error & Rescue Registry:**

| Risk | Surface | Impact | Fix |
|------|---------|--------|-----|
| PLACEHOLDER_PERMISSIONS live on detail page | SecuritySection.tsx:11-15 | Trust-destroying for Alex | Hide or wire to real data — P1 |
| Silent install failures → `?install=unavailable` | `/i/[slug]` route | No visibility into failure rate | Add logging/alerting |
| D9 deeplink conflicts with current primary action | InstallCard.tsx | Unclear install UX | Explicit decision needed |
| D7 copy feedback missing color | InstallCard.tsx:68 | Incomplete feedback | Add `color: var(--verified)` on `.copy` |

**Dream state delta:**
- THIS PLAN lands us at: mobile nav + 6 P2 interaction states + P3 polish. A complete, shippable UI.
- 12-MONTH IDEAL: real permissions model (from SKILL.md parsing or DB column), install monitoring, deeplink protocol confirmed working.
- GAP: SecuritySection needs a decision NOW (hide vs wire), not in 12 months.

**Regret scenario:** Ship with PLACEHOLDER_PERMISSIONS on every detail page. Alex's team notices the security section claims "Runs code on your machine" for a simple text summarizer. They ask Patrick why. He has no answer. The feature designed to build trust destroys it.

**CEO Section 1-10 analysis:**

Sections 1-3 (Problem / Solution / Market): The plan is tactical UI, no strategic misalignment. The items address real gaps in the shipped product.

Section 4 (Scope): One critical gap — SecuritySection PLACEHOLDER_PERMISSIONS not in plan. Otherwise scope is appropriate.

Section 5 (Timeline): P1/P2/P3 bucketing is reasonable. Mobile nav as P1 is slightly aggressive for a desktop-primary product but acceptable.

Section 6 (Success metrics): No metrics in this plan (tactical). Install counts and click-through will become relevant once the install path is complete.

Section 7 (Alternatives): The D9 deeplink vs .skill download decision is unresolved. Both are in the codebase in different states.

Sections 8-10 (Risk/Operations/Team): Solo project, no team risk. Operations risk is the silent install failure path.

**CEO COMPLETION SUMMARY:**
- Issues found: 4
- Critical: 1 (SecuritySection PLACEHOLDER_PERMISSIONS — not in plan)
- High: 1 (D9 creates conflicting install paths — needs decision)
- Medium: 2 (silent install failures, D7 color-only fix)
- Auto-decided: SecuritySection → P1 (Principle 1: completeness, trust is the product)
- Taste decision: D9 deeplink vs .skill download (surfaced at gate)

---

### Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | SecuritySection PLACEHOLDER_PERMISSIONS → P1 blocker | Mechanical | P1 completeness | Shows fabricated capabilities to every user; trust is the core product differentiator | Defer to P3 |
| 2 | CEO | D9 deeplink vs .skill primary | Taste | — | Both are valid; surfaced at gate for user decision | Auto-decide |
| 3 | CEO | D7 already has text feedback; only color missing | Mechanical | P5 explicit | Read the code — `setCopied` already done, only CSS color change needed | Rewrite from scratch |

---

### Phase 2: Design Review `[subagent-only]`

**Design litmus scorecard:**

| Dimension | Score | Issues |
|-----------|-------|--------|
| D1 — Information hierarchy | 5/10 | D9 deeplink conflicts with .skill download primary; D5 placement correct |
| D2 — Missing interaction states | 4/10 | Drawer close/escape, deeplink fallback trigger, button disabled states — all underspecified |
| D3 — User journey | 6/10 | SecuritySection gap breaks trust at key moment; D5 + D9 improve eval flow |
| D4 — Specificity | 5/10 | D12 drawer has no animation/focus-trap/scroll-lock spec; D9 fallback trigger undefined |
| D5 — Design system compliance | 8/10 | `var(--verified)` on copy/install confirmation is CORRECT per DESIGN.md (UI feedback = valid use); no violations found |
| D6 — Responsive/mobile | 4/10 | Drawer needs backdrop overlay, focus trap, scroll-lock, animation spec |
| D7 — Accessibility | 5/10 | Drawer needs `role="dialog"`, `aria-modal`, focus trap, return-focus; sort fix choice leaves wrong ambiguity |

**Design-specific findings (new — not in CEO phase):**

1. **D12 (mobile drawer) is underspecified** — The plan says "full-width drawer" with Browse/Creators/About links. Missing: (a) backdrop overlay `rgba(28,27,24,0.4)` already specified in DESIGN.md — just needs implementation, (b) focus trap when open, (c) `Escape` key to close, (d) scroll-lock on body behind. These are not taste decisions — they're correctness for a drawer component.

2. **D9 fallback trigger is undefined** — "If it didn't open, copy the command below." But HOW does the UI know Claude didn't open? There's no protocol handler confirmation. Auto-decide: show fallback text after 2s unconditionally (same as the confirmation state timeout). The deeplink fires, button shows "Opening Claude Code…", after 2s the fallback appears. The user either already opened Claude or sees the fallback.

3. **D5 data source ambiguity** — "Pull from output description or first line of output sample." These are two different DB fields. Auto-decide: use `display_description` if present (AI-generated), fall back to first 120 chars of `raw_description`. Don't use output sample (that's the README area, not the right column).

4. **D6 BrowseEmpty button spec** — "Clear filters" should clear all active URL params and return to `/skills`. "Browse all" links to `/skills` with no params. These are the same action. Auto-decide: single "Browse all skills" button that clears filters + navigates to `/skills`. Simpler, same result.

**Design-corrected items:**

| Item | Original spec | Clarification |
|------|--------------|---------------|
| D9 fallback trigger | undefined | Show fallback unconditionally after 2s |
| D5 data source | "output description or output sample" | Use `display_description`, fall back to `raw_description[:120]` |
| D6 "Browse all" + "Clear filters" | Two separate buttons | Single "Browse all skills" action |
| D12 drawer backdrop | unspecified | `rgba(28,27,24,0.4)` per DESIGN.md |
| Sort menu fix | "click-outside or details/select" | Use click-outside listener (not `<details>` — wrong interaction model) |

**Design completion summary:** 
Issues found: 5. Critical: 0 (SecuritySection already captured in CEO phase). High: 3 (D12 underspecified, D9 fallback, D9 vs .skill conflict). Medium: 2 (D5 data source, D6 duplicate buttons). Auto-decided: 3. Taste: 1 (D9 deeplink vs .skill — user gate).

| 4 | Design | D12 drawer needs backdrop/focus-trap/scroll-lock/escape | Mechanical | P1 completeness | Drawer without these is broken UX; specs were in DESIGN.md already | Leave underspecified |
| 5 | Design | D9 fallback: show after 2s unconditionally | Mechanical | P5 explicit | No reliable way to detect protocol handler success; 2s timeout is correct | Wait for protocol confirmation |
| 6 | Design | D5 data source: display_description → raw_description[:120] | Mechanical | P5 explicit | Two fields exist; deterministic fallback chain is correct | Use output sample |
| 7 | Design | D6 two buttons → single "Browse all skills" | Mechanical | P5 explicit | Same destination; simpler is better | Keep both buttons |
| 8 | Design | var(--verified) on copy/install is CORRECT | Mechanical | P5 explicit | DESIGN.md explicitly names "copy confirmation" and "install confirmation" as valid uses | False positive — no change |

---

### Phase 3: Eng Review `[subagent-only]`

**Architecture ASCII diagram:**
```
                    ┌─────────────────────────────────┐
                    │         Next.js App Router        │
                    │                                   │
        ┌───────────┴──────────┐    ┌──────────────────┴──────┐
        │  Server Components   │    │   Client Components       │
        │                      │    │                           │
        │  app/page.tsx        │    │  components/Nav.tsx       │
        │  skills/[slug]/      │    │  (NEEDS 'use client'      │
        │    page.tsx          │    │   for active state +      │
        │  SecuritySection.tsx │    │   hamburger drawer)       │
        └────────────┬─────────┘    │                           │
                     │              │  skills/BrowseClient.tsx  │
                     │ props        │  skills/[slug]/           │
                     ▼              │    InstallCard.tsx         │
              ┌──────────┐         └───────────────────────────┘
              │ Supabase │                      │
              │  DB      │         /i/[slug]    │ route.ts
              └──────────┘         (install counter + bundle)
```

**Section 1 — Architecture findings:**

- **Nav.tsx → `use client` conversion:** Safe. Nav receives serializable props only (`stats` object). No async/await, no server-only data. Blast radius: zero. Adding `usePathname()` means Nav re-renders on every navigation (needed for active state + drawer close). Acceptable.

- **SecuritySection:** Self-contained server component. `PLACEHOLDER_PERMISSIONS` (lines 11-15) is a standalone constant. Hiding the `dp-sec-perms` block is surgical — `{false && <div>...</div>}` or delete the block. The three real check rows and verdict pill are unaffected. Zero blast radius.

**Section 2 — Code quality:**

- **D9 deeplink parameter is wrong:** The plan specifies `claude://install?skill=[slug]`. The slug is Claudinho-internal — Claude Code cannot resolve it. The correct value is the full `installCommand` string (e.g., `claude skill add github.com/owner/repo`). InstallCard already receives `installCommand` as a prop. The URL should be: `claude://install?skill=${encodeURIComponent(installCommand)}`. Without fixing this, D9 ships as a silent install failure.

- **D7 copy color — no inline style:** Use modifier class `copy is-copied` + CSS `.copy.is-copied { color: var(--verified); }`. The `setCopied` state already exists. Zero new state needed.

- **D12 drawer close on navigation missing:** `usePathname()` change does not auto-close drawer. Must add: `useEffect(() => { setOpen(false); }, [pathname])`. One line but must be in spec or it will be omitted.

**Section 3 — Test coverage:**

Test diagram (codepaths):

| Codepath | Type | Exists? | Gap? |
|----------|------|---------|------|
| Nav active state renders on /skills | Unit | No | Add |
| Drawer opens/closes on hamburger click | Unit | No | Add |
| Drawer closes on navigation | Unit | No | Add — critical |
| Drawer closes on Escape key | Unit | No | Add |
| Copy button shows "copied" + green | Unit | No | Add |
| D9 deeplink fires with installCommand (not slug) | Unit | No | Add — critical |
| D9 fallback shows after 2s unconditionally | Unit | No | Add |
| Browse empty state "Browse all skills" clears filters | Unit | No | Add |
| `/i/[slug]` increments install count | Integration | Exists? | Verify |
| SecuritySection hides fake permissions | Unit | No | Add |

**Section 4 — Performance:** No N+1 queries. No new fetches. Nav `usePathname()` subscription is fine at this scale. `BrowseClient` filter is client-side `useMemo` — no flash on clear.

**Section 5 — Security:** No new attack surface. D9 deeplink uses `encodeURIComponent`. No user-supplied content reaches protocol handler.

**Failure modes registry:**

| Failure | When | What user sees | Fix |
|---------|------|----------------|-----|
| D9 uses slug (wrong) | `claude://install?skill=memory-bank` | Claude Code opens, installs nothing, no error | Use `installCommand` param |
| Drawer stays open on navigation | User clicks Browse link while drawer open | Drawer persists over new page | `useEffect` close on pathname change |
| Body scroll-lock not removed | Drawer unmounts during navigation | Page stays scroll-locked | `useEffect` cleanup |
| SecuritySection PLACEHOLDER_PERMISSIONS | Every detail page | Alex sees fake capabilities | Hide block |

**Eng completion summary:**
Issues found: 4. Critical: 1 (D9 wrong parameter — silent install failure). High: 1 (drawer close on navigation). Medium: 2 (SecuritySection already in CEO findings, copy modifier class).

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 9 | Eng | D9 deeplink must use installCommand, not slug | Mechanical | P5 explicit | Claude Code cannot resolve Claudinho slugs; installCommand is already a prop | Use slug |
| 10 | Eng | Drawer needs useEffect close on pathname change | Mechanical | P1 completeness | Missing from plan spec; without it drawer persists on navigation | Leave to implementer |
| 11 | Eng | D7 copy color → modifier class .is-copied | Mechanical | P5 explicit | Inline style would violate no-inline-styles rule; modifier class is right | Inline style |
| 12 | Eng | SecuritySection hide dp-sec-perms with false && | Mechanical | P5 explicit | Surgical zero-blast-radius fix; preserves data shape comment | Delete file |

- [ ] **site_event abuse protection + retention** — `app/api/event/route.ts`
  Accepted risk at ship time (2026-06-10, near-zero traffic): the event endpoint is unauthenticated and unthrottled; bot filter is UA-substring only. When traffic grows: add per-IP rate limiting (Vercel WAF rule or token bucket), and a retention cron (`delete from site_event where created_at < now() - interval '90 days'`). Flagged by 3 review specialists + red team.
