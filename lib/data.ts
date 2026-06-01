// Shared data layer for Skills Marketplace (Claudinho)
// Ported from the prototype's landing-data.jsx, browse-data.jsx, publisher-data.jsx

// ─── types ────────────────────────────────────────────────────────────────

export interface Skill {
  id: string;
  title: string;
  desc: string;
  publisher: string;
  installs: number;
  stars: number;
  pick?: boolean;
  verifiedDate: string;
  version: string;
  shelfTitle: string;
  shelfId: string;
  subShelf?: string;
  tags?: string[];
  // browse classifiers
  classifiers?: {
    audience: string[];
    stage: string[];
    shape: string[];
    setup: string[];
    input: string[];
  };
  tagSet?: Set<string>;
}

export interface Shelf {
  id: string;
  num: string;
  title: string;
  blurb: string;
  skills: Skill[];
}

export interface Publisher {
  handle: string;
  name: string;
  role: string;
  initials: string;
  skills: number;
  loc: string;
  gh: number;
  fol: number;
  bio: string | null;
  // enrichment fields
  position?: string;
  company?: string;
  location?: string;
  github?: { handle: string; followers: number };
  twitter?: { handle: string; followers: number };
  intro?: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────

// The generated-content shelf enum (engineering, customer-success, operations)
// differs from the catalog's shelf ids (eng, cs, ops) the browse sidebar uses.
export const GEN_SHELF_TO_ID: Record<string, string> = {
  engineering: "eng",
  "customer-success": "cs",
  operations: "ops",
};
export function genShelfId(shelf: string | null | undefined): string {
  if (!shelf) return "";
  return GEN_SHELF_TO_ID[shelf] ?? shelf;
}

function _verifiedDate(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const daysAgo = Math.abs(h) % 42;
  const today = new Date('2026-05-28T00:00:00Z');
  const d = new Date(today.getTime() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

function _version(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) | 0;
  const a = Math.abs(h);
  return `v${1 + (a % 3)}.${(a >> 3) % 10}.${(a >> 7) % 12}`;
}

export function fmtVerifiedDate(iso: string): string {
  if (!iso) return '';
  // Accept both 'YYYY-MM-DD' (catalog) and full ISO timestamps (DB rows).
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00Z' : iso);
  if (isNaN(d.getTime())) return '';   // never surface "invalid date" to users
  const today = new Date();            // real current date (was a hardcoded 2026-05-28)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff <= 0) return 'today';       // clamp future/just-now to "today" (no "-2d ago")
  if (diff === 1) return 'yesterday';
  if (diff < 7) return diff + 'd ago';
  if (diff < 30) return Math.round(diff / 7) + 'w ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toLowerCase();
}

export function fmtCount(n: number | null | undefined): string {
  if (n == null) return '0';
  if (n < 1000) return String(n);
  const k = n / 1000;
  return (k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '')) + 'k';
}

// ─── shelves ──────────────────────────────────────────────────────────────

const SHELVES_RAW: Shelf[] = [
  {
    id: 'product',
    num: '01',
    title: 'Product',
    blurb: 'Synthesize interviews, spec features, triage feedback.',
    skills: [
      { id: 'pd-interviews', title: "Synthesize 30 customer interviews into themes", desc: "Cluster ~30 anonymized transcripts into top themes with verbatims and frequency counts. Built for weekly customer-dev cadences.", publisher: 'patrick', installs: 4180, stars: 312, pick: true } as Skill,
      { id: 'pd-spec-slack', title: "Spec a feature from a single Slack thread", desc: "Read a thread, extract the underlying request, draft a one-page spec with user, problem, and edge cases.", publisher: 'granola', installs: 2140, stars: 188 } as Skill,
      { id: 'pd-prd-break', title: "Break a PRD into a Linear backlog with estimates", desc: "Parse a PRD, produce issues with titles, owners, and t-shirt estimates ready to paste into Linear.", publisher: 'linear', installs: 5230, stars: 412, pick: true } as Skill,
      { id: 'pd-feedback', title: "Triage a feedback inbox by theme and urgency", desc: "Read a week's worth of feedback, tag by theme, surface what's hot, recommend which 3 to address first.", publisher: 'granola', installs: 1880, stars: 134 } as Skill,
      { id: 'pd-release', title: "Draft release notes from this week's merged PRs", desc: "Pull merged PRs, group by surface area, produce changelog-quality notes in your team's voice.", publisher: 'linear', installs: 3120, stars: 244 } as Skill,
    ],
  },
  {
    id: 'eng',
    num: '02',
    title: 'Engineering',
    blurb: 'Review PRs, generate tests, document architecture.',
    skills: [
      { id: 'en-review-pr', title: "Review this PR for real bugs, not just style", desc: "Reads a diff, flags actual logic issues with file:line citations, ignores cosmetic nits.", publisher: 'obra', installs: 6840, stars: 891, pick: true } as Skill,
      { id: 'en-gen-tests', title: "Generate tests from a diff", desc: "Look at what changed, write tests that would have caught the bug — not 100%-coverage filler.", publisher: 'obra', installs: 2980, stars: 412 } as Skill,
      { id: 'en-handoff', title: "Write a handoff spec for a feature in progress", desc: "Turn an in-flight branch into a one-pager another engineer can pick up cold.", publisher: 'linear', installs: 1410, stars: 92 } as Skill,
      { id: 'en-schema', title: "Translate a SQL schema into a Mermaid diagram", desc: "Parse the DDL, generate a diagram of tables and relationships you can paste into a doc.", publisher: 'postgres', installs: 940, stars: 78 } as Skill,
      { id: 'en-refactor', title: "Refactor messy CSS into design tokens", desc: "Find duplication, extract a token set, rewrite the stylesheet to use it. Outputs a diff.", publisher: 'studio-xyz', installs: 2240, stars: 156, pick: true } as Skill,
    ],
  },
  {
    id: 'design',
    num: '03',
    title: 'Design',
    blurb: 'Audit Figma files, spec components, run accessibility passes.',
    skills: [
      { id: 'de-figma-audit', title: "Audit a Figma file for design-system drift", desc: "Find off-system colors, type sizes, and detached components. Produces a ranked checklist.", publisher: 'studio-xyz', installs: 1430, stars: 119, pick: true } as Skill,
      { id: 'de-component', title: "Spec a component from a working prototype", desc: "Read a Figma frame, generate a Storybook-ready component spec with props and states.", publisher: 'studio-xyz', installs: 820, stars: 64 } as Skill,
      { id: 'de-a11y', title: "Run an accessibility pass on a screen export", desc: "Identifies contrast, touch-target, and focus-order issues. Returns a prioritized fix list.", publisher: 'beam-labs', installs: 1120, stars: 88 } as Skill,
      { id: 'de-tokens', title: "Generate a token spec from a working prototype", desc: "Inspect a prototype, extract colors and type as a coherent token JSON.", publisher: 'studio-xyz', installs: 680, stars: 51 } as Skill,
    ],
  },
  {
    id: 'marketing',
    num: '04',
    title: 'Marketing',
    blurb: 'Draft launches, plan calendars, rewrite heroes.',
    skills: [
      { id: 'mk-launch', title: "Draft a launch tweet thread from a half-written post", desc: "Take a notes-style draft, produce a 6-tweet thread that holds the through-line and ends with a clear CTA.", publisher: 'pen-park', installs: 4180, stars: 318, pick: true } as Skill,
      { id: 'mk-hero', title: "Rewrite a landing-page hero in three voices", desc: "Punchy / specific / contrarian. Pick the one that matches your audience.", publisher: 'pen-park', installs: 2640, stars: 196 } as Skill,
      { id: 'mk-calendar', title: "Plan a content calendar from one idea", desc: "One seed idea → eight pieces across three surfaces, scheduled across two weeks.", publisher: 'beam-labs', installs: 1890, stars: 132 } as Skill,
      { id: 'mk-repurpose', title: "Repurpose this post into 5 LinkedIn drafts in my voice", desc: "Reads three of your posts, learns the voice, produces five new drafts on the same theme.", publisher: 'pen-park', installs: 3340, stars: 248 } as Skill,
    ],
  },
  {
    id: 'sales',
    num: '05',
    title: 'Sales',
    blurb: 'Cold outreach, post-demo summaries, champion finding.',
    skills: [
      { id: 'sl-cold', title: "Draft cold outreach I'd actually want to receive", desc: "Personal hook from the recipient's recent posts, one-sentence pitch, soft ask. No 'hope this finds you well.'", publisher: 'pen-park', installs: 6120, stars: 488, pick: true } as Skill,
      { id: 'sl-followup', title: "Post-demo follow-up summary", desc: "From a demo transcript: what they asked, what to send, who to loop in. Drafted as an email.", publisher: 'apollo', installs: 3420, stars: 232 } as Skill,
      { id: 'sl-champion', title: "Find the champion in a deal", desc: "Read the deal notes, identify who is actually selling internally for you. Flag risk if there's no one.", publisher: 'apollo', installs: 1840, stars: 108 } as Skill,
      { id: 'sl-pipe', title: "Summarize my open pipeline into a Friday wrap", desc: "Group by stage and likelihood, surface stalled deals, draft the Slack post.", publisher: 'kit-co', installs: 2210, stars: 162 } as Skill,
    ],
  },
  {
    id: 'cs',
    num: '06',
    title: 'Customer Success',
    blurb: 'Triage tickets, draft saves, build onboarding sequences.',
    skills: [
      { id: 'cs-triage', title: "Summarize a 60-ticket support queue by theme", desc: "Reads the queue, groups by theme, flags the three urgent threads worth your time today.", publisher: 'granola', installs: 5840, stars: 422, pick: true } as Skill,
      { id: 'cs-save', title: "Draft a churn-save reply tuned to the account", desc: "From the account history and ticket, write a save email in your support voice.", publisher: 'wave-co', installs: 2120, stars: 168 } as Skill,
      { id: 'cs-onboarding', title: "Build an onboarding email sequence from a feature list", desc: "Four emails over 14 days, each tied to a specific activation milestone.", publisher: 'asha', installs: 1340, stars: 88 } as Skill,
      { id: 'cs-sentiment', title: "Pull last quarter's churned accounts and tag reasons", desc: "From a CSV of canceled accounts, cluster the reasons, surface the trend.", publisher: 'wave-co', installs: 1610, stars: 124 } as Skill,
    ],
  },
  {
    id: 'ops',
    num: '07',
    title: 'Operations',
    blurb: 'Reconcile expenses, vet vendors, run weekly hygiene.',
    skills: [
      { id: 'op-expenses', title: "Reconcile expenses from a messy CSV", desc: "Three months, 200 rows, inconsistent vendor names. Output: a clean monthly report.", publisher: 'patrick', installs: 3210, stars: 256, pick: true } as Skill,
      { id: 'op-vendor', title: "Pull together a vendor shortlist with notes", desc: "From a brief, generate a five-vendor shortlist with pricing, gotchas, and a recommended next step.", publisher: 'tomas', installs: 1420, stars: 96 } as Skill,
      { id: 'op-soc2', title: "Draft an SOC 2 evidence collector", desc: "Read the audit scope, produce the evidence-gathering checklist with owners and dates.", publisher: 'kit-co', installs: 1180, stars: 84 } as Skill,
      { id: 'op-contacts', title: "Clean up a contact list — dedupe, normalize, fix caps", desc: "Heuristics + LLM judgement. Surfaces ambiguous duplicates instead of silently merging them.", publisher: 'tomas', installs: 1920, stars: 142 } as Skill,
      { id: 'op-oneonone', title: "Prep me for a 1:1 from notes and last week's calendar", desc: "Three talking points, two follow-ups, one ask. Customized to the person.", publisher: 'asha', installs: 2110, stars: 174 } as Skill,
    ],
  },
  {
    id: 'finance',
    num: '08',
    title: 'Finance',
    blurb: 'Build runway models, prep investor updates, categorize statements.',
    skills: [
      { id: 'fn-runway', title: "Build a runway model from a bank statement", desc: "Read 12 months, infer burn, model 6-/12-/18-month runway under three scenarios.", publisher: 'theo', installs: 2640, stars: 198, pick: true } as Skill,
      { id: 'fn-update', title: "Prep an investor update from raw notes", desc: "Two paragraphs you scribbled → a structured update with metrics, asks, and a closing line.", publisher: 'theo', installs: 1820, stars: 142 } as Skill,
      { id: 'fn-statements', title: "Categorize bank statements into a monthly report", desc: "Built for non-US founders. Handles inconsistent vendor names and currency conversion.", publisher: 'patrick', installs: 3180, stars: 244 } as Skill,
      { id: 'fn-stripe', title: "Reconcile a Stripe payout against open invoices", desc: "Match the deposit to the right invoices. Flag the ones that don't reconcile and why.", publisher: 'ledger-kit', installs: 1420, stars: 96 } as Skill,
    ],
  },
];

const SUB_AND_TAGS: Record<string, { sub: string; tags: string[] }> = {
  'pd-interviews': { sub: 'Customer dev', tags: ['transcripts', 'themes', 'weekly'] },
  'pd-spec-slack': { sub: 'Specs', tags: ['slack', 'spec', 'async'] },
  'pd-prd-break': { sub: 'Specs', tags: ['prd', 'linear', 'estimates'] },
  'pd-feedback': { sub: 'Triage', tags: ['inbox', 'themes', 'urgency'] },
  'pd-release': { sub: 'Release notes', tags: ['prs', 'changelog', 'weekly'] },
  'en-review-pr': { sub: 'PR review', tags: ['diff', 'bugs', 'citations'] },
  'en-gen-tests': { sub: 'Tests', tags: ['diff', 'tests'] },
  'en-handoff': { sub: 'Docs', tags: ['branch', 'spec', 'docs'] },
  'en-schema': { sub: 'Diagrams', tags: ['sql', 'mermaid'] },
  'en-refactor': { sub: 'Refactor', tags: ['css', 'tokens', 'diff'] },
  'de-figma-audit': { sub: 'Audit', tags: ['figma', 'drift', 'system'] },
  'de-component': { sub: 'Component spec', tags: ['figma', 'storybook'] },
  'de-a11y': { sub: 'Accessibility', tags: ['contrast', 'focus', 'a11y'] },
  'de-tokens': { sub: 'Tokens', tags: ['tokens', 'json'] },
  'mk-launch': { sub: 'Launch', tags: ['thread', 'draft', 'launch'] },
  'mk-hero': { sub: 'Copy', tags: ['hero', 'voices', 'rewrite'] },
  'mk-calendar': { sub: 'Calendar', tags: ['calendar', 'repurpose'] },
  'mk-repurpose': { sub: 'Voice', tags: ['linkedin', 'voice', 'drafts'] },
  'sl-cold': { sub: 'Outreach', tags: ['cold', 'personal', 'email'] },
  'sl-followup': { sub: 'Follow-up', tags: ['transcript', 'email'] },
  'sl-champion': { sub: 'Deal flow', tags: ['deal', 'risk', 'champion'] },
  'sl-pipe': { sub: 'Pipeline', tags: ['pipeline', 'slack', 'weekly'] },
  'cs-triage': { sub: 'Triage', tags: ['queue', 'themes', 'weekly'] },
  'cs-save': { sub: 'Saves', tags: ['churn', 'account', 'reply'] },
  'cs-onboarding': { sub: 'Onboarding', tags: ['sequence', 'activation'] },
  'cs-sentiment': { sub: 'Sentiment', tags: ['csv', 'churn', 'cluster'] },
  'op-expenses': { sub: 'Reconciliation', tags: ['csv', 'monthly', 'expenses'] },
  'op-vendor': { sub: 'Vendors', tags: ['brief', 'shortlist'] },
  'op-soc2': { sub: 'Compliance', tags: ['audit', 'checklist', 'soc2'] },
  'op-contacts': { sub: 'Hygiene', tags: ['csv', 'dedupe', 'cleanup'] },
  'op-oneonone': { sub: '1:1 prep', tags: ['notes', 'prep', 'calendar'] },
  'fn-runway': { sub: 'Models', tags: ['bank', 'runway', 'scenarios'] },
  'fn-update': { sub: 'Investor update', tags: ['notes', 'investor', 'metrics'] },
  'fn-statements': { sub: 'Bookkeeping', tags: ['bank', 'monthly', 'i18n'] },
  'fn-stripe': { sub: 'Reconciliation', tags: ['stripe', 'invoices'] },
};

// Annotate skills with verifiedDate, version, shelfTitle, shelfId, subShelf, tags
SHELVES_RAW.forEach((sh) => sh.skills.forEach((s) => {
  s.verifiedDate = _verifiedDate(s.id);
  s.version = _version(s.id);
  s.shelfTitle = sh.title;
  s.shelfId = sh.id;
  const x = SUB_AND_TAGS[s.id];
  if (x) { s.subShelf = x.sub; s.tags = x.tags; }
}));

export const SHELVES: Shelf[] = SHELVES_RAW;

// ─── publishers ───────────────────────────────────────────────────────────

export const PUBLISHERS: Record<string, Publisher> = {
  patrick: { handle: 'patrick', name: 'Patrick T.', role: 'Indie · finance & ops tooling', initials: 'PT', skills: 4, loc: 'São Paulo', gh: 1840, fol: 5200, bio: "Solo. Building finance tools for non-US founders." },
  granola: { handle: 'granola', name: 'Granola', role: 'Team · meetings & CS', initials: 'GR', skills: 9, loc: 'New York', gh: 4120, fol: 18400, bio: "Skills built around call recordings and meeting notes." },
  linear: { handle: 'linear', name: 'Linear', role: 'Team · product workflows', initials: 'LN', skills: 5, loc: 'Distributed', gh: 11200, fol: 92000, bio: "Skills designed around how Linear teams already work." },
  'studio-xyz': { handle: 'studio-xyz', name: 'Studio XYZ', role: 'Studio · 3 designers · Lisbon', initials: 'SX', skills: 12, loc: 'Lisbon', gh: 612, fol: 3400, bio: "Every skill ran on a client engagement first." },
  obra: { handle: 'obra', name: 'obra', role: 'Indie · engineering tooling', initials: 'OB', skills: 6, loc: 'Seattle', gh: 8240, fol: 12800, bio: "Author of the superpowers stack." },
  'pen-park': { handle: 'pen-park', name: 'Pen & Park', role: 'Indie · 2 writers', initials: 'PP', skills: 4, loc: 'Brooklyn', gh: 220, fol: 4100, bio: "Marketing copy, edited like editing." },
  apollo: { handle: 'apollo', name: 'Apollo Crew', role: 'Indie · 2 former AEs', initials: 'AC', skills: 3, loc: 'New York', gh: 180, fol: 2400, bio: null },
  'beam-labs': { handle: 'beam-labs', name: 'Beam Labs', role: 'Indie · brand & marketing', initials: 'BL', skills: 5, loc: 'Berlin', gh: 410, fol: 2900, bio: null },
  postgres: { handle: 'postgres', name: 'Postgres Pals', role: 'Crew · data tooling', initials: 'PG', skills: 2, loc: 'Distributed', gh: 1620, fol: 1800, bio: null },
  'kit-co': { handle: 'kit-co', name: 'Kit & Co.', role: 'Indie · operations', initials: 'KC', skills: 4, loc: 'London', gh: 340, fol: 1900, bio: null },
  'wave-co': { handle: 'wave-co', name: 'Wave & Co', role: 'Team · CS workflows', initials: 'WC', skills: 5, loc: 'Austin', gh: 540, fol: 2200, bio: null },
  asha: { handle: 'asha', name: 'Asha M.', role: 'Indie · operator', initials: 'AM', skills: 5, loc: 'Bangalore', gh: 290, fol: 3100, bio: null },
  tomas: { handle: 'tomas', name: 'Tomás R.', role: 'Indie · operator', initials: 'TR', skills: 3, loc: 'Lisbon', gh: 140, fol: 1200, bio: null },
  theo: { handle: 'theo', name: 'Theo R.', role: 'CFO-in-residence', initials: 'TH', skills: 4, loc: 'San Francisco', gh: 380, fol: 6800, bio: null },
  'ledger-kit': { handle: 'ledger-kit', name: 'Ledger.kit', role: 'Team · finance ops', initials: 'LK', skills: 3, loc: 'Toronto', gh: 720, fol: 1400, bio: null },
};

// ─── publisher enrichment ─────────────────────────────────────────────────

const PUB_ENRICHMENT: Record<string, Partial<Publisher>> = {
  obra: {
    position: 'Independent engineer',
    company: 'Maintainer, obra/superpowers',
    location: 'Seattle',
    github: { handle: 'obra', followers: 8240 },
    twitter: { handle: 'obra', followers: 12400 },
    intro: "I've been building Unix tools since the 90s. Most of the skills here started as scripts I wrote for myself, then I cleaned them up enough to share. If you can't get Claude to do the thing you want, the skill probably teaches it the context it was missing.",
  },
  patrick: {
    position: 'Indie · finance & ops tooling',
    company: 'Founder, Suma Ledger',
    location: 'São Paulo',
    github: { handle: 'patrick-t', followers: 1840 },
    twitter: { handle: 'patrickt', followers: 5200 },
    intro: "I came to São Paulo eight years ago to start a fintech. Most of these skills are tools I built reconciling messy banking data — Nubank statements, foreign-currency expenses, accounts I never quite finished setting up. If you're a non-US founder trying to do US-grade financial reporting on São Paulo time, this is for you.",
  },
  granola: {
    position: 'Team · meetings & CS',
    company: 'Engineering, Granola',
    location: 'New York',
    github: { handle: 'granola-ai', followers: 4120 },
    twitter: { handle: 'granola_ai', followers: 18400 },
    intro: "Our team runs everything through Granola — sales calls, 1:1s, support escalations. Every skill here started with the same question: what if Claude could read the call I just had and do the next thing? Try the customer-success triage one first; it surprised us.",
  },
  'studio-xyz': {
    position: 'Design studio · 3 designers',
    company: 'Founder, Studio XYZ',
    location: 'Lisbon',
    github: { handle: 'studio-xyz', followers: 612 },
    twitter: { handle: 'studioxyz', followers: 3400 },
    intro: "We're three designers in Lisbon. We publish a skill when it has earned its place on a client project — meaning one of us has run it, it produced something we shipped, and we'd reach for it again. If a skill doesn't survive that bar, it doesn't go up here.",
  },
  linear: {
    position: 'Team · product workflows',
    company: 'Linear, Inc.',
    location: 'Distributed',
    github: { handle: 'linear', followers: 11200 },
    twitter: { handle: 'linear', followers: 92000 },
    intro: "Skills built around how Linear teams already work. If your team plans in Linear, these snap into your existing cadence — no separate process to learn.",
  },
};

export function getPublisher(handle: string): Publisher | null {
  const base = PUBLISHERS[handle];
  if (!base) return null;
  const enrich = PUB_ENRICHMENT[handle] || {};
  return { ...base, ...enrich, handle };
}

// ─── computed stats ───────────────────────────────────────────────────────

export function publisherStats(handle: string): { installs: number; stars: number; count: number } {
  let installs = 0, stars = 0, count = 0;
  for (const sh of SHELVES) for (const s of sh.skills) {
    if (s.publisher === handle) {
      installs += s.installs || 0;
      stars += s.stars || 0;
      count++;
    }
  }
  return { installs, stars, count };
}

export function topSkills(handle: string, n = 2): Skill[] {
  const all: Skill[] = [];
  for (const sh of SHELVES) for (const s of sh.skills) {
    if (s.publisher === handle) all.push(s);
  }
  all.sort((a, b) => b.installs - a.installs);
  return all.slice(0, n);
}

export function skillsByPublisher(handle: string): Skill[] {
  const out: Skill[] = [];
  for (const sh of SHELVES) for (const s of sh.skills) {
    if (s.publisher === handle) out.push(s);
  }
  out.sort((a, b) => (b.verifiedDate || '').localeCompare(a.verifiedDate || ''));
  return out;
}

export function shelvesByPublisher(handle: string): string[] {
  const ids = new Set<string>();
  for (const sh of SHELVES) for (const s of sh.skills) {
    if (s.publisher === handle) ids.add(sh.id);
  }
  return SHELVES.filter((sh) => ids.has(sh.id)).map((sh) => sh.title);
}

export function findSkill(id: string): { skill: Skill; shelf: Shelf } | null {
  for (const sh of SHELVES) {
    const s = sh.skills.find((x) => x.id === id);
    if (s) return { skill: s, shelf: sh };
  }
  return null;
}

// ─── global stats ─────────────────────────────────────────────────────────

export const REAL_STATS = (() => {
  let skills = 0, installs = 0;
  for (const sh of SHELVES) for (const s of sh.skills) {
    skills++;
    installs += s.installs || 0;
  }
  const fmt = (n: number) => {
    if (n < 1000) return String(n);
    const k = n / 1000;
    return (k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, '')) + 'k';
  };
  return {
    skills,
    publishers: Object.keys(PUBLISHERS).length,
    weekly: 6,
    installs: fmt(installs),
  };
})();

// ─── browse / filter data ─────────────────────────────────────────────────

const SHELF_AUDIENCE: Record<string, string[]> = {
  product: ['for-pms', 'for-founders'],
  eng: ['for-engineers'],
  design: ['for-designers'],
  marketing: ['for-marketers'],
  sales: ['for-marketers', 'for-founders'],
  cs: ['for-ops'],
  ops: ['for-ops', 'for-founders'],
  finance: ['for-founders'],
};

const STAGE_VERBS = [
  { stage: 'discovery', match: /^(synthesize|find|pull together|triage|summarize|categorize|reconcile|clean up|audit|run an accessibility)/i },
  { stage: 'planning', match: /^(spec|plan|break a prd|draft a launch|build a runway|build an onboarding|prep)/i },
  { stage: 'execution', match: /^(generate|rewrite|repurpose|draft cold|refactor|translate|build a slide)/i },
  { stage: 'review', match: /^(review|audit|run|pull last)/i },
  { stage: 'delivery', match: /^(draft release|post-demo|summarize my open|prep an investor|draft a churn|draft an?)/i },
];

const INPUT_HINTS = [
  { input: 'from-csv', match: /csv|spreadsheet|bank statement/i },
  { input: 'from-repo', match: /pr|diff|merged|schema|repo/i },
  { input: 'from-url', match: /linkedin|twitter|figma file|site/i },
  { input: 'from-file', match: /pdf|deck|file/i },
];

const SETUP_HINTS = [
  { setup: 'needs-integration', match: /linear|stripe|figma|mixpanel|github|apollo/i },
];

function deriveClassifiers(skill: Skill) {
  const audience = (SHELF_AUDIENCE[skill.shelfId] || []).slice();
  if (!audience.includes('for-founders')) audience.push('for-founders');

  let stage = 'execution';
  for (const v of STAGE_VERBS) { if (v.match.test(skill.title)) { stage = v.stage; break; } }

  let input = 'from-text';
  const text = (skill.title + ' ' + skill.desc).toLowerCase();
  for (const h of INPUT_HINTS) { if (h.match.test(text)) { input = h.input; break; } }

  let setup = 'no-setup';
  for (const s of SETUP_HINTS) { if (s.match.test(text)) { setup = 'needs-integration'; break; } }

  const shape = 'atomic';
  return { audience, stage: [stage], shape: [shape], setup: [setup], input: [input] };
}

export const ALL_SKILLS: Skill[] = (() => {
  const out: Skill[] = [];
  for (const sh of SHELVES) {
    for (const s of sh.skills) {
      const c = deriveClassifiers(s);
      const tagSet = new Set([...c.audience, ...c.stage, ...c.shape, ...c.setup, ...c.input]);
      out.push({ ...s, shelfId: sh.id, shelfTitle: sh.title, classifiers: c, tagSet });
    }
  }
  return out;
})();

export const SHELF_SUB_SHELVES: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const sh of SHELVES) {
    const counts: Record<string, number> = {};
    for (const s of sh.skills) {
      if (!s.subShelf) continue;
      counts[s.subShelf] = (counts[s.subShelf] || 0) + 1;
    }
    map[sh.id] = Object.entries(counts)
      .filter(([, n]) => n >= 1)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }
  return map;
})();

export const SORT_OPTIONS = [
  { id: 'installs', label: 'Most installed' },
  { id: 'stars', label: 'GitHub stars' },
  { id: 'newest', label: 'Newest' },
  { id: 'az', label: 'A–Z' },
];

export function sortSkills(arr: Skill[], sortId: string): Skill[] {
  const copy = [...arr];
  switch (sortId) {
    case 'stars': copy.sort((a, b) => (b.stars || 0) - (a.stars || 0)); break;
    case 'newest': copy.sort((a, b) => (b.verifiedDate || '').localeCompare(a.verifiedDate || '')); break;
    case 'az': copy.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'installs':
    default: copy.sort((a, b) => (b.installs || 0) - (a.installs || 0));
  }
  return copy;
}

export interface BrowseFilters {
  shelves: string[];
  subShelf: string | null;
  publishers: string[];
}

export function applyFilters(skills: Skill[], filters: BrowseFilters): Skill[] {
  return skills.filter((s) => {
    const shelves = filters.shelves || [];
    if (shelves.length > 0 && !shelves.includes(s.shelfId)) return false;
    if (filters.subShelf && s.subShelf !== filters.subShelf) return false;
    const pubs = filters.publishers || [];
    if (pubs.length > 0 && !pubs.includes(s.publisher)) return false;
    return true;
  });
}

export function publisherListForCurrent(skills: Skill[]): { handle: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const s of skills) counts[s.publisher] = (counts[s.publisher] || 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([handle, count]) => ({ handle, count }));
}

export function shelfLabel(id: string): string {
  const sh = SHELVES.find((x) => x.id === id);
  return sh ? sh.title : id;
}

export function shelfIdsByPublisher(handle: string): string[] {
  const ids = new Set<string>();
  for (const sh of SHELVES) for (const s of sh.skills) {
    if (s.publisher === handle) ids.add(sh.id);
  }
  return SHELVES.filter((sh) => ids.has(sh.id)).map((sh) => sh.id);
}

export interface PublisherDirectoryRow {
  handle: string;
  name: string;
  initials: string;
  role: string;
  loc: string;
  installs: number;
  ghStars: number;
  twFollowers: number;
  skillCount: number;
  shelfIds: string[];
  shelfTitles: string[];
}

export function publisherDirectory(): PublisherDirectoryRow[] {
  const rows: PublisherDirectoryRow[] = [];
  for (const handle of Object.keys(PUBLISHERS)) {
    const p = PUBLISHERS[handle];
    const stats = publisherStats(handle);
    if (stats.count === 0) continue;
    rows.push({
      handle,
      name: p.name,
      initials: p.initials,
      role: p.role,
      loc: p.loc,
      installs: stats.installs,
      ghStars: p.gh || 0,
      twFollowers: p.fol || 0,
      skillCount: stats.count,
      shelfIds: shelfIdsByPublisher(handle),
      shelfTitles: shelvesByPublisher(handle),
    });
  }
  return rows;
}

// ─── detail page data ─────────────────────────────────────────────────────

export const DETAIL_SKILL = {
  id: 'obra-brainstorming',
  slug: 'obra/brainstorming',
  title: 'Get Claude to brainstorm, not just answer.',
  desc: "Flips Claude from 'answer the question fast' to 'pull on the question with you' — asks branching follow-ups, surfaces assumptions, and ends with a clear set of options.",
  shelf: { id: 'eng', num: '02', title: 'Engineering' },
  subShelf: 'Planning & thinking',
  tags: ['for-engineers', 'for-founders', 'no-setup', 'from-text'],
  bestFor: "Anyone stuck on a problem they haven't framed well yet.",
  publisherNote: 'The default LLM behavior is to be the expert. The skill that changes that is brainstorming.',
  publisherHandle: 'obra',
  repo: 'obra/superpowers',
  skillName: 'brainstorming',
  installs: 18000,
  ghStars: 116000,
  version: 'v0.0.0',
  verifiedDate: '2026-05-27',
  firstSeen: '2026-01-19',
  status: 'current',
  distribution: 'standard',
  installCommand: 'npx skills add obra/superpowers --skill brainstorming',
  sourceUrl: 'github.com/obra/superpowers',
  summary: [
    "Fires only on prompts Claude reads as underspecified — leaves routine questions alone.",
    "Asks 2–3 clarifying questions before producing options, then surfaces 4 directions with tradeoffs.",
    "No configuration, no API keys. Works in any Claude session, in Cowork or Claude Code.",
    "Best for early-stage problems before you've written a spec; skip it when you already know what you want.",
  ],
  pattern: 'A',
  representativeOutput: true,
  readme: [
    {
      h: 'How it works',
      p: [
        "You install the skill. Then in any session, when you start a prompt with a question you haven't fully framed, Claude flips into brainstorming mode: it asks one or two clarifying questions before producing options, instead of jumping to a confident first answer.",
        "The skill is small on purpose. It doesn't change Claude's tone elsewhere — it only fires when the prompt looks underspecified.",
      ],
    },
    {
      h: 'When to use it',
      p: [
        "Use this when you're stuck on a problem you can't quite articulate, or when the first answer Claude gives feels too settled. Skip it when you already know what you want — the back-and-forth is friction in those cases.",
      ],
    },
  ],
};

export const DETAIL_PUBLISHER = {
  handle: 'obra',
  name: 'Jesse Vincent',
  alias: 'obra',
  initials: 'JV',
  role: "Engineer; long-time independent toolmaker. Maintainer of superpowers.",
  twitter: '@obra',
  followers: 12400,
  github: 'github.com/obra',
  skills: 6,
};

export const VERIFICATION_LOG = [
  { date: '2026-05-27', version: 'v0.0.0', status: 'pass' },
  { date: '2026-05-20', version: 'v0.0.0', status: 'pass' },
  { date: '2026-05-13', version: 'v0.0.0', status: 'pass' },
  { date: '2026-05-06', version: 'v0.0.0', status: 'pass' },
];
