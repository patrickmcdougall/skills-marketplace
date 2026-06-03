# Claudinho — Design System

Creator-first skills discovery. Trust comes from knowing who built the skill and being able to judge their body of work — real names, real repos, real star counts — not a badge we applied. The aesthetic is warm and editorial: it should feel like a curated directory, not a product marketplace.

---

## Tokens

```css
/* backgrounds */
--bg:        #efece4   /* page background — warm cream */
--paper:     #ffffff   /* card surfaces */
--paper-2:   #f3f1e8   /* slightly warm white (publishers band, avatar bg) */

/* ink (text) */
--ink:       #1c1b18   /* primary text */
--ink-2:     #54524c   /* secondary text */
--ink-3:     #8e8b82   /* muted / metadata */
--ink-4:     #b9b6ac   /* disabled / separators */

/* lines */
--line:      #d9d6cc
--line-2:    #e8e5db
--line-3:    #efece2

/* brand */
--accent:     #d8581c   /* orange — primary CTAs, focus rings, hover accents */
--accent-2:   #b4400e   /* darker orange — hover states */
--accent-soft:#fbe2d2   /* light orange tint — active filter chips */

/* verification */
--verified:      #2e8a4f   /* green — all trust/verified signals */
--verified-soft: #e2efe5

/* shelf accents (8 business functions) */
--c-product:   #8a6e2c
--c-eng:       #2f5d4f
--c-design:    #6a3a82
--c-marketing: #b04a32
--c-sales:     #b87a1f
--c-cs:        #3d5d8a
--c-ops:       #6c5c3d
--c-finance:   #2f6f4f
```

---

## Typography

**Display + body**: Geist Sans — `var(--font-geist-sans)`
**Technical / metadata**: JetBrains Mono — `var(--font-jetbrains-mono)` (also `var(--font-geist-mono)` fallback)

**Never use**: Inter, Roboto, Arial, system-ui as primary font. These are fallbacks only.

**Type scale:**
- Hero h1: `clamp(40px, 5vw, 66px)`, weight 600, tracking `-0.038em`
- Section h2: `clamp(32px, 3.6vw, 44px)`, weight 600, tracking `-0.034em`
- Shelf title h2: `30px`, weight 600, tracking `-0.032em`
- Card title: `16px`, weight 600, tracking `-0.018em`
- Body: `14px`, line-height 1.55
- Metadata / eyebrows: JetBrains Mono, `10.5–11px`, uppercase, `letter-spacing: 0.12–0.14em`

**Numeric values** always use `font-variant-numeric: tabular-nums` + JetBrains Mono.

---

## Spacing & Radii

```
--card-pad:   18px   /* card internal padding */
--row-gap:    16px   /* between cards in a grid */
--shelf-gap:  72px   /* between shelf sections */

--r-chip:     999px  /* pills / tags / status chips */
--r-card:     6px    /* skill cards, publisher cards */
--r-cardbig:  8px    /* large card variants */
```

Detail page (`.dp`) uses `border-radius: 2px` on all buttons and panels — tighter, more utilitarian.

Page max-width: `1280px` with `56px` horizontal padding (→ `24px` at `≤640px`).

---

## Components

### Skill Card (`.skill-card`)
Full `<Link>` wrapping the card. Four contexts: `wall`, `shelf`, `browse`, `detail`.
- Title 16px bold — leads the card
- Description clamped to 2 lines (1 line in shelf context)
- Tags row: shelf category + up to 2 topic chips
- Footer: creator byline (display name + `@handle` when name ≠ handle) + repo stars or follower count (left) / install count (right)

Trust signal is the creator, not the platform. No "checked" or "verified" label on cards — that framing overstated what we actually check and distracted from the creator signal.

### Buttons (`.lp-btn`)
- `.solid`: dark fill (`--ink` bg, `--bg` text) — default secondary
- `.ghost`: transparent with faint border
- `.accent`: **orange fill** (`--accent` bg, white text) — **primary CTA** (D4 decision)
- `.sm`: reduced padding for inline/card contexts

**Decision (D4)**: Hero CTA "Browse the registry" → `.lp-btn.accent`. "How we verify" → small text link (`font-size: 13px; color: var(--ink-2); text-decoration: underline`) below the button, not a button itself.

### Verification green (`.lp-verified`, `--verified`)
`--verified` green is **UI feedback only**: copy confirmation ("copied"), install confirmation ("Opening Claude Code…"), nav/footer status chip. Never used as a quality or trust badge on content — that's the creator's job, not ours.

### Section eyebrow (`.lp-section-eyebrow`)
Black top border + mono uppercase text. Left = section identifier. Right = meta count or date. Always use this pattern for section headers on the landing page.

---

## Page Structure

### Landing (`/`)
```
Nav (sticky)
Hero: h1 → sub → .accent CTA + text link → stat-strip
DriftWall (animated)
PublishersBand (horizontal scroll)
Shelves (8 × ShelfRow)
HowItWorks (dark band)
Footer
```

### Browse (`/skills`) + Search (`/search`)
```
Nav
bp-head: h1 + search input
bp-shell: [bp-aside: filters] [bp-main: topbar → chips → grid → load more]
Footer
```

### Skill Detail (`/skills/[slug]`)
```
Nav
dp-title-block: breadcrumb → h1 → desc
dp-grid:
  Left: [skill summary] [output sample] [readme/summary]
  Right (sticky): [skill outcome summary] [install panel] [source card] [other skills]
Footer
```
**Decision (D5)**: Right column starts with a 2–3 line outcome summary (from output data), then the install panel. Evidence before CTA.

### Creators Index (`/creators`)
Sortable table: avatar (GitHub photo), display name + role/company + location, GH ★ (repo stars, deduplicated), skill count, installs. Default sort: GH ★. Real names from `publisher_profile` take priority over catalog handles.

### Creator Profile (`/creators/[handle]`)
Avatar (80×80, border-radius 4px) + real display name + `/handle` + role/company/location + socials (GitHub with followers, Twitter, blog) → intro/bio → skills grouped by repo. Each repo section shows: repo name (linked to GitHub), star count, description, then skill cards. Single-repo creators show the repo header too.

---

## Interaction States

### Browse empty state (D6)
```tsx
<div className="bp-empty">
  <h3>Nothing in that combination yet.</h3>
  <p>We've verified [N] skills — try clearing one filter or browsing by a different shelf.</p>
  <div className="actions">
    <button className="lp-btn ghost" onClick={onClear}>Clear filters</button>
    <Link className="lp-btn solid" href="/skills">Browse all</Link>
  </div>
</div>
```

### Copy button feedback (D7)
On click: button text → "copied", color → `var(--verified)`, revert after 1500ms.

### Install button flow (D9)
1. Button: "Install in Claude Code →" (`.dp-install .primary`)
2. On click: attempt deeplink `claude://install?skill=[slug]`
3. Button immediately shifts to: "Opening Claude Code…" with `color: var(--verified)`
4. After 2s: show fallback text below: "If it didn't open, copy the command below."
5. Fallback: `.dp-install .cmd` row with the CLI command + copy button.

### Post-copy feedback (D7)
`.copy` button text swaps to "copied" in `var(--verified)` green for 1500ms, then reverts.

---

## Navigation

### Active state (D15)
Use `usePathname()` in Nav. Active link: `color: var(--ink)`, `font-weight: 500`. Inactive: `var(--ink-2)`, weight 400.

### Mobile nav (D12) — below 640px
- Hide: `.lp-nav .status` (status chip) and `.lp-nav .links`
- Show: hamburger icon button (right side of nav)
- Hamburger opens a full-width drawer (slides from right or top) containing: Browse / Creators / About links + the status chip at the bottom
- Drawer overlay: `background: rgba(28,27,24,0.4)`; drawer: `background: var(--bg)`

---

## Accessibility

- **Focus**: `*:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }` — applied globally in `claudinho.css`
- **Labels**: Never use placeholder-as-label. All inputs must have a `<label>` (visible or `.sr-only`)
- **Touch targets**: Minimum 44px height/width for interactive elements
- **Reduced motion**: `@media (prefers-reduced-motion: reduce)` pauses DriftWall animation (already implemented)
- **Screen readers**: Decorative SVGs use `aria-hidden="true"` (already implemented)

---

## Error States

### Root error boundary (D8)
`app/error.tsx` — `'use client'` component.
```tsx
// Heading: "Something went wrong."
// Paragraph: "The registry is temporarily unavailable. Try refreshing."
// Button: "Try again" → calls reset()
// Visual: uses .pp-notfound CSS pattern (centered, cream bg)
```

### 404 — Publisher not found
`.pp-notfound` CSS already exists. Pattern: centered h1 + p + link back to /creators.

---

## Not In Scope (decisions deferred)

- Filter button touch targets (currently ~26px, needs 44px) — P3 TODO
- Footer responsive below 375px — P3 TODO
- Sort menu keyboard dismissal (onBlur on div doesn't work for keyboard users) — P3 TODO
- Inline styles in FilterSubShelf (negative-margin hack) — P3 TODO
- Publisher profile intro section alignment column — intentional, no change needed

---

## Rules

1. **No default font stacks** as primary. Geist Sans only. JetBrains Mono for technical text.
2. **No inline styles** for design decisions. If you're writing `style={{ color: 'var(--ink-2)' }}`, add a CSS class instead.
3. **Cards earn their existence.** Don't add new card grids as default layout.
4. **One job per section.** Each section of the landing page has one purpose and one heading.
5. **Verified green for UI feedback only.** `--verified` is for copy/install confirmation states and the nav status chip — not for content trust signals. Creator credibility (stars, followers, identity) is the trust layer, not platform badges.
6. **Orange accent for primary actions.** `--accent` on the one primary CTA per page. Not on decorative elements.
