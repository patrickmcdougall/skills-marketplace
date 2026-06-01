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
