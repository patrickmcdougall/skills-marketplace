// The Manual — content model.
//
// Two kinds of material live here:
//   • GuidePage  — Part 1, general Cowork product-primer pages (skill-agnostic).
//   • CaseStudy       — Part 2, a skill-anchored case following the four moves
//                  (skill → scenario → see it work → install).
//
// Cases reference a real catalogue skill by `skillSlug`. Live install/star
// signals are fetched at render time via getSkillBySlug — this file holds only
// the authored copy + the join key, never hardcoded counts.
//
// Themes mirror catalogue shelves 1:1 (lib/data.ts shelf ids) so a Manual
// theme can sit beside its matching shelf.

// ─── shared rich-text ───────────────────────────────────────────────────────
// Authored, trusted content. Paragraph/list text supports a minimal **bold**
// markup, rendered by the manual components.

export type RichBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "h2"; text: string }
  | { kind: "callout"; title: string; text: string }
  | { kind: "tip"; text: string; label?: string }
  | { kind: "surface-grid"; rows: SurfaceRow[] }
  | { kind: "feature-list"; features: CoworkFeature[] }
  | { kind: "cowork-walkthrough"; intro?: string; steps: CoworkStep[] };

// One entry in the real Cowork feature list (mirrors the app's own sidebar).
// `icon` is a stable key the FeatureList component maps to a lucide icon.
export type CoworkFeature = {
  /** Route slug under /manual/features/[feature]. */
  slug: string;
  name: string;
  icon: "new-task" | "projects" | "scheduled" | "live-artifacts" | "dispatch" | "customize";
  badge?: string;
  text: string;
  /** Concrete "use it for:" example — how someone actually organizes with it. */
  example: string;
  /** The full guide. A feature page ships to production once this exists. */
  guide?: RichBlock[];
};

// One row of the "ways to use Claude" comparison grid (the top-down map on the
// "What Cowork is" page). Cowork is the highlighted destination.
export type SurfaceRow = {
  name: string;
  where: string;
  bestFor: string;
  highlight?: boolean;
};

// One step of the illustrative Cowork walkthrough. `view` selects which mock
// frame the CoworkWalkthrough component renders; the rest is the copy + the
// data that frame shows. Marked illustrative — not a real screenshot.
export type CoworkStep = {
  title: string;
  caption: string;
  view: "pick-skill" | "drop-files" | "compose" | "review";
  skillName?: string;
  otherSkills?: string[];
  files?: string[];
  typed?: string;
  question?: string;
  resultTitle?: string;
  resultMeta?: string;
};

// ─── Part 1 — Intro to Cowork ────────────────────────────────────────────────

export type GuidePage = {
  topic: string; // route slug under /manual/start/[topic]
  order: number; // 1..N, drives "Intro · n of N" + next link
  navLabel: string; // short label in the left index
  title: string;
  standfirst: string; // the lead line
  body: RichBlock[];
  /** Slug of the next thing to read — another intro topic, or a case slug. */
  next?: { href: string; label: string };
};

// ─── Part 2 — Cases ──────────────────────────────────────────────────

/** Catalogue shelf id (lib/data.ts) the case is filed under. */
export type ShelfId =
  | "product"
  | "eng"
  | "design"
  | "marketing"
  | "sales"
  | "cs"
  | "ops"
  | "finance";

export type CaseStep = { title: string; body?: string; typed?: string };

export type BeforeAfterRow = { label: string; value: string; dot?: string };

/** The skill the case is built on. Live signals come from the catalogue. */
export type SkillAnchor = {
  /** Catalogue slug — the join into getSkillBySlug for live signals + link. */
  skillSlug: string;
  /** Display name shown in the anchor row (the skill leaf). */
  name: string;
  /** Publisher handle (GitHub owner). */
  publisher: string;
  /** One-line what-it-does, in the case's own voice. */
  blurb: string;
  /** Install command shown in the install section + anchor. */
  installCommand: string;
};

export type CaseStudy = {
  slug: string; // route slug under /manual/[slug]
  shelf: ShelfId;
  subShelf: string;
  navLabel: string; // short label in the left index
  title: string; // outcome-framed, verb-first — never names the skill or "AI"
  standfirst: string;
  status: "live" | "soon";

  /** Stub teaser ("What you'll learn") while a case is in production. */
  concept: { lead: string; body: string };

  /** Live cases: the value you got — rendered as "What you get" bullets. */
  value?: string[];

  /** Present for every case; the protagonist. */
  skill: SkillAnchor;

  /** The chore, concretely (1–2 paras). */
  scenario: string[];

  // ── full walkthrough — present only when status === "live" ──
  /** The one sentence you give Cowork — shown in "See it work" with the result. */
  sentence?: string;
  before?: { label: string; lines: string[] };
  after?: { label: string; rows: BeforeAfterRow[]; footer?: string };
  stats?: [{ v: string; k: string }, { v: string; k: string }, { v: string; k: string }];
  /** ONE end-to-end flow, install first: download → drag in → use → review. */
  howTo?: CaseStep[];

  /** Points to another CaseStudy (ideally a different shelf) to keep people moving. */
  nextCase?: string;
};

// ─── theme order (mirrors the catalogue shelves, first wave first) ───────────

// Wave-1 themes (those with live cases) float first.
export const MANUAL_SHELF_ORDER: ShelfId[] = [
  "finance",
  "product",
  "marketing",
  "ops",
  "design",
  "sales",
];

export const SHELF_TITLES: Record<ShelfId, string> = {
  product: "Product",
  eng: "Engineering",
  design: "Design",
  marketing: "Marketing",
  sales: "Sales",
  cs: "Customer Success",
  ops: "Operations",
  finance: "Finance",
};

// ─── content: Part 1 ─────────────────────────────────────────────────────────

export const START_PAGES: GuidePage[] = [
  {
    topic: "what-cowork-is",
    order: 1,
    navLabel: "What Cowork is",
    title: "What Cowork is",
    standfirst: "There's more than one way to use Claude. Cowork is the one that does the work.",
    body: [
      {
        kind: "h2",
        text: "The map: ways to use Claude",
      },
      {
        kind: "p",
        text: "These are easy to mix up, so here's the whole landscape, simplest to most capable. They're not competing — you'll use more than one — but they do different jobs.",
      },
      {
        kind: "surface-grid",
        rows: [
          { name: "Chat", where: "App + web", bestFor: "Quick answers, explanations, brainstorms" },
          { name: "Claude in Chrome", where: "Your browser", bestFor: "Reading and acting on web pages for you" },
          { name: "Claude Code", where: "Your terminal", bestFor: "Building and editing software — for developers" },
          { name: "Cowork", where: "Desktop app", bestFor: "Real work on your files and apps, start to finish", highlight: true },
        ],
      },
      {
        kind: "p",
        text: "The dividing line is simple. **Chat advises; Cowork does.** With chat you copy something in, get an answer, and copy it back out — you're still the one doing the work. Cowork flips that: it runs in the Claude desktop app, reads and writes the files on your computer, connects to the apps you already use, and carries a multi-step task all the way to a finished deliverable — a doc, a deck, a spreadsheet — while you step away.",
      },
      {
        kind: "p",
        text: "You don't need to know what an “agent” is, and you don't need to code. If you've kept an AI tab open and copy-pasted into it for two years, you already know how to use this. It's that, minus the copy-pasting.",
      },
      {
        kind: "h2",
        text: "What using it actually looks like",
      },
      {
        kind: "cowork-walkthrough",
        intro:
          "Three steps, start to finish — and notice there's no skill involved. This is Cowork on its own: you give it your files and a sentence, it does the rest.",
        steps: [
          {
            title: "Give it your files",
            caption:
              "Drag in the file — here, a billing export that came out broken. Cowork reads the real files on your computer; no fixing it up first.",
            view: "drop-files",
            files: ["billing-export-may.xlsx"],
          },
          {
            title: "Say what you want",
            caption:
              "One plain sentence — what you want at the end, not the steps. Ask it to check with you first and it asks before doing anything, the habit that prevents most bad outputs.",
            view: "compose",
            typed:
              "Clean this export into a board-ready revenue report — totals by plan and region — and ask me first if anything looks off.",
            question:
              "Found 4 duplicated rows and one with shifted columns — want me to flag them for your review rather than fix them silently?",
          },
          {
            title: "It works, you review",
            caption:
              "Cowork does the multi-step part on its own and hands back a finished file. You already know what good looks like, so you check it in seconds.",
            view: "review",
            resultTitle: "May 2026 — Board revenue report.xlsx",
            resultMeta: "214 transactions · totals by plan & region · 5 rows flagged for you",
          },
        ],
      },
      {
        kind: "callout",
        title: "So where do skills come in? They're optional.",
        text: "Everything above worked without one. A **skill** is a saved playbook for a job you do again and again — it already knows your formats, your standards, the steps. So the same job drops to an even shorter sentence (“turn this export into the board report”) and comes back the same way every time, with nothing to set up. That's what the rest of the Manual shows, and where the catalogue comes in.",
      },
    ],
    next: { href: "/manual/start/when-to-use-it", label: "Next: when to use it" },
  },
  {
    topic: "when-to-use-it",
    order: 2,
    navLabel: "When to use it (vs. chat)",
    title: "When to use it (vs. chat)",
    standfirst: "A simple rule, then a five-part test.",
    body: [
      {
        kind: "p",
        text: "**Use chat** when what you want fits in a few exchanges — a question, an explanation, a brainstorm. **Use Cowork** when you need a deliverable: a file someone will open, multi-step work, or anything that touches more than one file or app.",
      },
      {
        kind: "list",
        items: [
          "**More than one thing goes in** — files, a folder, or a connected app.",
          "**A file comes out** — a doc, deck, or sheet you can hand over.",
          "**You'll do it again** — recurring work is the sweet spot.",
          "**You know what “good” looks like** — you can judge the result in 15 seconds.",
          "**The middle is the boring part** — extract, compile, reformat. That's the bit you hand off.",
        ],
      },
      { kind: "p", text: "A good Cowork task hits a few of these — not all five." },
      {
        kind: "p",
        text: "One more habit: when the work is recurring and belongs together — one client, one process — keep it in a [Project](/manual/features/projects). A Project is a folder on your computer that Cowork works in, so every task starts with the background already known instead of from scratch.",
      },
    ],
    next: { href: "/manual/start/your-first-10-minutes", label: "Next: your first 10 minutes" },
  },
  {
    topic: "your-first-10-minutes",
    order: 3,
    navLabel: "Your first 10 minutes",
    title: "Your first 10 minutes",
    standfirst: "Start with a real task you already know how to judge.",
    body: [
      {
        kind: "list",
        items: [
          "**Pick a real task** — one you already do and can judge in fifteen seconds. Not a test, the actual thing.",
          "**Give it context** — drop in a few files or a whole folder, or connect an app.",
          "**Describe the outcome**, not the steps. Say what you want at the end.",
          "**Make Claude ask first** — add “before you start, repeat my ask back and ask any clarifying questions.” This one habit prevents most bad outputs.",
        ],
      },
      {
        kind: "p",
        text: "Then step away and check the result. You already know what good looks like, so you'll see in seconds whether it's right, wrong, or 70% there.",
      },
      {
        kind: "p",
        text: "And when a task earns a repeat — same job next week, same job next month — that's the moment to **install a skill** for it, so next time is one short sentence.",
      },
    ],
    next: { href: "/manual/features", label: "Next: the features that matter" },
  },
];

// ─── content: Features ───────────────────────────────────────────────────────
// Mirrors Cowork's own sidebar, one entry per feature. The overview page lists
// them all; each also gets its own stub page at /manual/features/[slug] until
// its full guide is produced.

export const FEATURES: CoworkFeature[] = [
  {
    slug: "new-task",
    name: "New task",
    icon: "new-task",
    text: "Where everyday work starts. Drop in files, say what you want, Cowork does it.",
    example:
      "“Summarize this contract.” “Draft a renewal email from this thread.” “Compare these three proposals.” One task per job.",
    guide: [
      { kind: "h2", text: "When to reach for it" },
      { kind: "list", items: [
        "**Any one-off job** — summarize a contract, draft an email from a thread, compare three proposals.",
        "**The first run of anything** — if the job earns a repeat, you graduate it to a skill or a schedule later.",
        "**Quick questions about your files** — point at a folder and ask.",
      ] },
      { kind: "h2", text: "How to use it" },
      { kind: "list", items: [
        "**Open New task** — the box asks “How can I help you today?”",
        "**Add context** — drag files in, or use the + button. Ongoing work? Pick it under “Work in a project” so Claude starts with the background.",
        "**Describe the outcome, not the steps** — and ask Claude to check with you before it starts.",
      ] },
      { kind: "tip", text: "Unless it's a true one-off, link the task to a Project — just pick one under “Work in a project”, right in the box. Claude then starts with the files and history already known instead of from zero. [More on Projects](/manual/features/projects)." },
      { kind: "p", text: "Keep one task per job. Recent tasks stay in the sidebar, so a clean task-per-job history doubles as a to-do list you can reopen." },
      { kind: "p", text: "See it in action: [the board-report example](/manual/clean-a-messy-export) starts exactly like this — one task, one file, one sentence." },
    ],
  },
  {
    slug: "projects",
    name: "Projects",
    icon: "projects",
    text: "A Project is a folder on your computer that Cowork works in. Tasks inside it start with the files and history already there — no re-explaining.",
    example:
      "One project per area of your life: the company, each big client, your personal finances. Open the right one and Claude already knows the background.",
    guide: [
      { kind: "h2", text: "When to reach for it" },
      { kind: "list", items: [
        "**Work that belongs together** — one client, one company area, one ongoing process.",
        "**Anything you'll come back to** — the Project keeps the files and the history, so nothing gets re-explained.",
        "**Recurring jobs** — the monthly report lives where last month's files already are.",
      ] },
      { kind: "h2", text: "How to use it" },
      { kind: "list", items: [
        "**Create one** — Projects → New project. A Project is simply a folder on your computer that Cowork works in.",
        "**Put the files there** — exports, notes, contracts. Cowork reads and writes the real files in that folder.",
        "**Start tasks inside it** — pick the project in the “Work in a project” selector and every task starts with the background known.",
      ] },
      { kind: "tip", text: "You don't start work from this screen — in any [new task](/manual/features/new-task), pick the project under “Work in a project” and you're in it." },
      { kind: "callout", title: "A split that works", text: "One project per area of your life — **the company, each big client, personal finances**. Open the right one and Claude already knows where everything is." },
      { kind: "p", text: "Pairs naturally with [the board-report example](/manual/clean-a-messy-export): keep each month's export in the project folder and the report builds from where the files already live." },
    ],
  },
  {
    slug: "scheduled",
    name: "Scheduled",
    icon: "scheduled",
    text: "Set a task to repeat on its own — type /schedule in any task. The result is waiting when you sit down.",
    example:
      "A 6 a.m. brief of your calendar and inbox. A Friday team summary. A month-end revenue report that builds itself.",
    guide: [
      { kind: "h2", text: "When to reach for it" },
      { kind: "list", items: [
        "**The job repeats on a calendar** — a weekly summary, a month-end report, a morning brief.",
        "**The inputs arrive on their own** — email, calendar, connected apps — so nobody needs to kick it off.",
        "**You want the result waiting** — done before you sit down, not started when you remember.",
      ] },
      { kind: "h2", text: "How to use it" },
      { kind: "list", items: [
        "**Build the task once**, normally, until the output looks right.",
        "**Type /schedule inside that task** and pick the cadence — daily, weekdays, monthly.",
        "**Find the results under Scheduled** in the sidebar — each run stacks up with a “new” marker.",
      ] },
      { kind: "tip", label: "Good to know", text: "Scheduled tasks run while your computer is on. There's a **Keep awake** switch on the Scheduled page for runs that matter." },
      { kind: "p", text: "Pair it with a [Project](/manual/features/projects): if the export lands in the folder every month, the scheduled [board report](/manual/clean-a-messy-export) builds itself from it." },
    ],
  },
  {
    slug: "live-artifacts",
    name: "Live artifacts",
    icon: "live-artifacts",
    text: "A document that keeps itself up to date by pulling from the apps you've connected — instead of a report that's stale the day after.",
    example:
      "A week-at-a-glance page built from your calendar. A running list of emails still waiting on your reply.",
    guide: [
      { kind: "h2", text: "When to reach for it" },
      { kind: "list", items: [
        "**Information you check repeatedly** — not a report you generate once.",
        "**The answer keeps changing** — inbox state, this week's calendar, open tickets.",
        "**One page instead of four apps** open every morning.",
      ] },
      { kind: "tip", text: "Start with the **Unread email digest** template — it answers a question you already ask every day." },
      { kind: "h2", text: "How to use it" },
      { kind: "list", items: [
        "**Connect your apps first** — [Customize](/manual/features/customize) → Connectors (Gmail, calendar, and so on). Live artifacts feed on them.",
        "**Create one** — Live artifacts → New artifact. Start from a template — “Week at a glance”, “Unread email digest”, “What needs my attention” — or describe your own.",
        "**Keep it open** — it updates from the live data instead of going stale.",
      ] },
    ],
  },
  {
    slug: "dispatch",
    name: "Dispatch",
    icon: "dispatch",
    badge: "Beta",
    text: "Pair your phone and send tasks to your computer from anywhere. Claude works on your desktop; the result is waiting when you're back.",
    example:
      "On the way to the office: “get the notes ready for my 10 a.m.” Done by the time you arrive.",
    guide: [
      { kind: "h2", text: "When to reach for it" },
      { kind: "list", items: [
        "**You're away from the desk** but the work — the files, the apps — is on it.",
        "**Dead time** — the commute, the airport line — and a task you can hand off in one sentence.",
        "**Start remote, finish at the desk** — the result waits in the same conversation.",
      ] },
      { kind: "tip", label: "Important", text: "**Pair only a phone you own and trust** — Dispatch gives it a line to your real files and apps. The pairing screen links Anthropic's guide to using it safely. (It's in Beta.)" },
      { kind: "h2", text: "How to use it" },
      { kind: "list", items: [
        "**Pair your phone** — Dispatch → “Pair your phone”. Once.",
        "**Send a task from anywhere** — “get the notes ready for my 10 a.m.” Claude works on your desktop: files, apps, browser.",
        "**Review when you're back** — pick up exactly where you left off.",
      ] },
    ],
  },
  {
    slug: "customize",
    name: "Customize",
    icon: "customize",
    text: "Where your skills and connected apps live. Installed skills land here — and “Create new skills” lets you teach Claude your own process in plain language.",
    example:
      "Add the skills your team uses, so a report comes out the same no matter who asks. Or create one from how YOU write proposals.",
    guide: [
      { kind: "h2", text: "When to reach for it" },
      { kind: "list", items: [
        "**Right after installing a skill** — Skills is where it lands.",
        "**Before anything connector-driven** — link Gmail, calendar, Slack here once, and Cowork pulls and pushes without exports.",
        "**When a process is truly yours** — create a skill from it.",
      ] },
      { kind: "tip", label: "Team tip", text: "Install the same skills across the team, and a report comes out the same no matter who asks for it." },
      { kind: "h2", text: "How to use it" },
      { kind: "list", items: [
        "**Skills** — everything installed from [Claudinho](/skills) shows up here; check or remove anytime.",
        "**Connectors** — one-time logins to the apps you live in.",
        "**Create new skills** — teach Claude your process in plain language: how you write proposals, how the team formats updates. ([Where skills fit in](/manual/skills/where-skills-fit) covers when this beats installing.)",
      ] },
    ],
  },
];

export const FEATURES_OVERVIEW: {
  title: string;
  standfirst: string;
  body: RichBlock[];
  next?: { href: string; label: string };
} = {
  title: "The features that matter",
  standfirst:
    "These are the things you'll actually see down the side of Cowork — and what each one is for.",
  body: [
    { kind: "feature-list", features: FEATURES },
    {
      kind: "p",
      text: "Underneath all of these, two things do the heavy lifting: Cowork reads and writes the **real files** on your computer, and **connects to the apps** you already use (Slack, Gmail, Drive, your CRM) so it can pull and push without you exporting anything.",
    },
    {
      kind: "p",
      text: "And skills are an optional layer on top — a saved playbook that already knows which of these to reach for on a specific job.",
    },
  ],
  next: { href: "/manual/skills/where-skills-fit", label: "Next: where skills fit in" },
};

export function getFeature(slug: string): CoworkFeature | undefined {
  return FEATURES.find((f) => f.slug === slug);
}

// ─── content: Skills ─────────────────────────────────────────────────────────
// The layer on top of Cowork — what a skill is, how to install one without a
// terminal, and how to read the catalogue's trust signals. This is the bridge
// between the Manual and the marketplace.

export const SKILLS_PAGES: GuidePage[] = [
  {
    topic: "where-skills-fit",
    order: 1,
    navLabel: "Where skills fit in",
    title: "Where skills fit in",
    standfirst: "Cowork can do a job from scratch. A skill means it never has to.",
    body: [
      {
        kind: "p",
        text: "Everything in Getting started worked without a skill: files in, one plain sentence, a deliverable out. So what's a skill for? **A skill is a saved playbook for a job you do repeatedly.** It carries the steps, the format, the rules — your categories, your accountant's layout, your deck structure — so you never re-explain them.",
      },
      {
        kind: "p",
        text: "**It's not software, and there's nothing to code.** A skill is closer to a recipe card than an app. Install it once and Claude follows it whenever that job comes up. Your ask shrinks from a paragraph of instructions to “turn this export into the board report.”",
      },
      {
        kind: "list",
        items: [
          "**The output comes back the same way every time** — the skill holds the standard.",
          "**Your sentence gets shorter** — context lives in the skill, not your prompt.",
          "**Nothing to set up again** — the second run is as easy as the tenth.",
          "**Your process becomes shareable** — send the skill to a teammate and they get your way of doing it.",
        ],
      },
      {
        kind: "h2",
        text: "Three ways to get a skill",
      },
      {
        kind: "list",
        items: [
          "**Pick one ready-made** — the [catalogue](/skills) has thousands, built by Anthropic and by people who do the job. Fastest path: install and go.",
          "**Make one yours** — a skill is a file of instructions on your computer, so you can ask Claude to adapt one you've installed: “take this report skill and use our categories and our tone.” Have it saved under your own name and the original stays untouched.",
          "**Create your own** — in Cowork, Customize → Create new skills. Teach Claude your process in plain language: how you write proposals, how your team formats updates.",
        ],
      },
      {
        kind: "p",
        text: "Most people start with the first, move to the second once a skill almost fits, and build from scratch only when the process is truly theirs.",
      },
    ],
    next: { href: "/manual/skills/install-your-first-skill", label: "Next: install your first skill" },
  },
  {
    topic: "install-your-first-skill",
    order: 2,
    navLabel: "Install your first skill",
    title: "Install your first skill",
    standfirst: "The fastest way in doesn't involve a terminal.",
    body: [
      {
        kind: "list",
        items: [
          "**Find a skill on Claudinho** — [browse by what you do](/skills) (operations, finance, sales…), not by technology.",
          "**Click Download on its page** — a single `.skill` file lands in your Downloads folder.",
          "**Drag that file into Cowork** — drop it into the Claude desktop app window and the skill is added. That's the install. (You'll find it afterwards under Customize → Skills.)",
          "**Ask in plain language** — you don't need to mention the skill by name. Claude knows what each installed skill is for and uses it automatically when the job matches.",
        ],
      },
      {
        kind: "p",
        text: "Prefer a command? Every skill page also shows an install command you can copy and paste instead — same result, your choice.",
      },
      {
        kind: "p",
        text: "And nothing is locked: once installed, a skill is yours. Ask Claude to adjust it to your format anytime — or [make your own version](/manual/skills/where-skills-fit).",
      },
    ],
    next: { href: "/manual/skills/how-to-choose", label: "Next: how to pick a good skill" },
  },
  {
    topic: "how-to-choose",
    order: 3,
    navLabel: "How to pick a good skill",
    title: "How to pick a good skill",
    standfirst: "The catalogue shows the signals. Here's how to read them.",
    body: [
      {
        kind: "list",
        items: [
          "**Installs** — how many people actually use it. The strongest single signal.",
          "**Stars** — community endorsement of the creator's work on GitHub.",
          "**The creator** — every skill links to a real GitHub profile. A publisher with followers and a track record is staking a reputation.",
          "**The “best for” line** — match it to your actual job, not the most impressive-sounding one.",
        ],
      },
      {
        kind: "p",
        text: "And the simplest filter of all: **start with one job you do every week and can judge in fifteen seconds.** If the skill nails that, trust compounds from there.",
      },
    ],
    next: { href: "/manual/clean-a-messy-export", label: "Now see it all in action" },
  },
];

export function getSkillsPage(topic: string): GuidePage | undefined {
  return SKILLS_PAGES.find((p) => p.topic === topic);
}

// ─── content: Part 2 ─────────────────────────────────────────────────────────
// The flagship (clean-a-messy-export, Finance) is the locked reference build —
// produced from a REAL run of anthropics/skills xlsx on a fabricated-but-
// realistic broken billing export (artifacts archived in the planning folder).
// Remaining cases are honest "coming soon" stubs until each gets the same
// production run against its real skill.

export const CASES: CaseStudy[] = [
  // ── 02 · Product · LIVE — real run of anthropics/skills pptx (2026-06-11).
  // Input: 3 fabricated-but-realistic discovery-call note files; output: a real
  // 9-slide .pptx (artifacts in the planning folder, case-02/). Numbers genuine.
  {
    slug: "call-notes-to-deck",
    shelf: "product",
    subShelf: "communication",
    navLabel: "Call notes → deck",
    title: "Turn a folder of call notes into a client-ready deck",
    standfirst:
      "Your notes already hold the thinking. Turning them into a presentable deck is the afternoon this removes.",
    status: "live",
    concept: {
      lead: "Skills work from your files, not just chat.",
      body: "Point it at the folder and the deck comes back built — structure, flow, and all.",
    },
    value: [
      "**An afternoon of slide assembly back** — the thinking was in your notes; the skill builds the deck.",
      "**Nothing invented** — every slide traces to the calls. What wasn't clear became an “Open questions” slide, not a guess.",
      "**A real PowerPoint file** — designed slides you open, reword and present. Not a wall of bullets to copy over.",
      "**Repeatable** — next client, same sentence.",
    ],
    skill: {
      skillSlug: "anthropics-skills-pptx",
      name: "pptx",
      publisher: "anthropics",
      blurb:
        "Creates and edits real PowerPoint files — turns raw material into designed, presentable slides you can open and tweak.",
      installCommand: "npx skills add https://github.com/anthropics/skills/tree/main/pptx",
    },
    scenario: [
      "**You finish three discovery calls** with pages of notes — fragments, action items, half-sentences spread across files.",
      "**Before the client sees anything**, someone turns that into a deck: structure, story, slides. An afternoon, every time.",
    ],
    sentence:
      "Turn these call notes into a client-ready deck — what we heard, what we propose, timeline and next steps — and put anything unclear on an open-questions slide.",
    before: {
      label: "Before — 3 files of raw notes",
      lines: [
        "- finance closes the month in ~3 days of csv hell",
        "- chargebacks tracked... by email?? est R$ 40k/mo (NOT SURE, check)",
        "- POS contract maybe locked until mar/2027?? legal has it",
        "- they want a pilot BEFORE black friday. hard requirement",
        "NEXT: send intro material by friday (DONT FORGET)",
      ],
    },
    after: {
      label: "After — a 9-slide deck",
      rows: [
        { label: "What we heard", value: "4 pains", dot: "#4571d8" },
        { label: "The proposal", value: "3 phases", dot: "var(--accent)" },
        { label: "Timeline", value: "to Black Friday", dot: "var(--verified)" },
        { label: "Open questions", value: "3 — not guessed", dot: "var(--ink-3)" },
      ],
      footer: "✓ 3 calls → 9 designed slides · a real .pptx",
    },
    stats: [
      { v: "~1 aft.", k: "of assembly, back" },
      { v: "3", k: "unknowns flagged, 0 guessed" },
      { v: "1", k: "sentence typed" },
    ],
    howTo: [
      {
        title: "Download the skill",
        body: "[Click here to download it](/i/anthropics-skills-pptx) — or use the Download button on [its Claudinho page](/skills/anthropics-skills-pptx). A file called anthropics-skills-pptx.skill lands in your Downloads folder.",
      },
      {
        title: "Drag that file into Cowork",
        body: "Open your Downloads folder and drag the file into the Claude desktop app window. Steps 1 and 2 are once — from now on you start at step 3.",
      },
      {
        title: "Start a task and drop your notes in",
        body: "The whole folder — every file, as messy as it is.",
      },
      {
        title: "Type the sentence",
        body: "You don't need to mention the skill: Claude sees a deck job and uses it on its own.",
        typed:
          "Turn these call notes into a client-ready deck — what we heard, what we propose, timeline and next steps — and put anything unclear on an open-questions slide.",
      },
      {
        title: "Review the deck",
        body: "Open the .pptx, adjust the wording, present. The structure and the design are already done.",
      },
    ],
    nextCase: "competitor-teardown",
  },

  // ── 03 · Product · LIVE — real run of anthropics search-strategy (2026-06-12).
  // Question decomposed per the skill, real web searches, cited brief with
  // confidence flags. Artifact: planning folder case-05-research/.
  {
    slug: "question-to-research-brief",
    shelf: "product",
    subShelf: "research",
    navLabel: "Question → research brief",
    title: "Go from a question to a sourced research brief",
    standfirst:
      "You'd normally lose the day to open tabs and a doc of pasted links you half-trust. One sentence, and every claim comes back with its source.",
    status: "live",
    concept: {
      lead: "Cowork can fan out, fetch, and cite — not just answer.",
      body: "Every claim traces back to a source you can open.",
    },
    value: [
      "**The tab-day back** — the question gets split into the right searches; you read one brief.",
      "**Every claim linked** — trust the brief, or click through and check it yourself.",
      "**Confidence labeled** — solid numbers separated from single-source projections. Our run flagged 3 uncertainties instead of smoothing them over.",
      "**Decision-shaped** — it ends with what this means for you, not a pile of facts.",
    ],
    skill: {
      skillSlug: "anthropics-knowledge-work-plugins-search-strategy",
      name: "search-strategy",
      publisher: "anthropics",
      blurb:
        "Breaks your question into the right searches across sources, then brings back one answer with every claim attributed.",
      installCommand: "npx skills add https://github.com/anthropics/knowledge-work-plugins/tree/main/search-strategy",
    },
    scenario: [
      "**Someone needs an answer with evidence** — a client, the board, your own pricing call.",
      "**So you open the tabs** — and an hour later you have nine of them, two contradicting numbers, and a doc of links you no longer trust.",
    ],
    sentence:
      "Research where Pix is heading versus cards for Brazilian retail — current share, trajectory, what changes in 2026 — cite every claim and flag anything uncertain.",
    before: {
      label: "Before — the tab ritual",
      lines: [
        "tab: a 2024 stat inside a 2026 argument",
        "tab: two sites, two different numbers",
        "doc: links pasted, claims unpinned",
        "the question, still unanswered: what do we tell the client?",
      ],
    },
    after: {
      label: "After — one cited brief",
      rows: [
        { label: "Headline answer", value: "in one line", dot: "#4571d8" },
        { label: "Current share", value: "multi-source", dot: "var(--accent)" },
        { label: "The 2026 story", value: "with timeline", dot: "var(--verified)" },
        { label: "Flagged (3)", value: "not guessed", dot: "var(--ink-3)" },
      ],
      footer: "✓ every claim linked · projections labeled as projections",
    },
    stats: [
      { v: "~½ day", k: "of tab-hopping, back" },
      { v: "3", k: "uncertainties flagged, 0 smoothed" },
      { v: "1", k: "sentence typed" },
    ],
    howTo: [
      {
        title: "Download the skill",
        body: "[Click here to download it](/i/anthropics-knowledge-work-plugins-search-strategy) — or use the Download button on [its Claudinho page](/skills/anthropics-knowledge-work-plugins-search-strategy). A .skill file lands in your Downloads folder.",
      },
      {
        title: "Drag that file into Cowork",
        body: "Open your Downloads folder and drag the file into the Claude desktop app window. Steps 1 and 2 are once — from now on you start at step 3.",
      },
      {
        title: "Start a task — no files needed",
        body: "Just bring the question you actually need answered.",
      },
      {
        title: "Type the sentence",
        body: "You don't need to mention the skill: Claude recognizes a research question and uses it on its own.",
        typed:
          "Research where Pix is heading versus cards for Brazilian retail — current share, trajectory, what changes in 2026 — cite every claim and flag anything uncertain.",
      },
      {
        title: "Read the brief",
        body: "Claims linked, confidence labeled, flags where the sources disagree. Click any source you want to verify.",
      },
    ],
    nextCase: "interviews-to-findings",
  },

  // ── 04 · Operations · LIVE — real run of anthropics internal-comms (2026-06-12).
  // 14 fabricated-but-realistic fragments across 3 sources → one 3P update in
  // the skill's strict format. Artifact: planning folder case-04-digest/.
  {
    slug: "weekly-team-digest",
    shelf: "ops",
    subShelf: "people-team-ops",
    navLabel: "Weekly team digest",
    title: "A weekly team digest from scattered updates",
    standfirst:
      "Every week someone reassembles what happened from chats, email and docs — just to write the update nobody has time to write. This makes it one sentence.",
    status: "live",
    concept: {
      lead: "A skill can run on a schedule, unattended.",
      body: "Set it once and the digest lands before you sit down.",
    },
    value: [
      "**The Monday hour back** — the gathering was the job, and the gathering is what's handed off.",
      "**A 30-second read** — the format caps it at Progress, Plans, Problems. No essay.",
      "**Nothing buried** — our run surfaced 2 problems (a pricing-loss pattern, an audit deadline) that were scattered across three sources.",
      "**Schedulable** — type /schedule in the task and Friday's digest writes itself. [How Scheduled works](/manual/features/scheduled).",
    ],
    skill: {
      skillSlug: "anthropics-skills-internal-comms",
      name: "internal-comms",
      publisher: "anthropics",
      blurb:
        "A set of formats for internal updates — status reports, leadership updates, newsletters — so the write-up comes out the way companies actually write them.",
      installCommand: "npx skills add https://github.com/anthropics/skills/tree/main/internal-comms",
    },
    scenario: [
      "**The week happened everywhere** — a dozen chat threads, a few emails, a doc or two.",
      "**And every Monday someone reassembles it** into the update for leadership. Same gather-and-summarize loop, every week.",
    ],
    sentence:
      "Turn this week's updates in these files into our weekly 3P team update — progress, plans, problems.",
    before: {
      label: "Before — 14 fragments, 3 sources",
      lines: [
        "[mon 9:12] felipe: pix refunds finally green in staging",
        "[tue] duda: lost the drogaria deal :( pricing AGAIN",
        "from marina: we still owe SOC2 evidence, deadline jun 30",
        "[wed 16:44] ana: the marketplace csv doubled in size lol",
        "[fri] rafa: demo w/ construmax monday, need eng??",
      ],
    },
    after: {
      label: "After — one 3P update",
      rows: [
        { label: "Progress", value: "4 wins, merged", dot: "#4571d8" },
        { label: "Plans", value: "4 items, dated", dot: "var(--accent)" },
        { label: "Problems", value: "2 surfaced", dot: "var(--verified)" },
        { label: "Read time", value: "~30 seconds", dot: "var(--ink-3)" },
      ],
      footer: "✓ 14 fragments in, nothing dropped",
    },
    stats: [
      { v: "~1 hr", k: "per week, back" },
      { v: "2", k: "problems surfaced, 0 buried" },
      { v: "1", k: "sentence typed" },
    ],
    howTo: [
      {
        title: "Download the skill",
        body: "[Click here to download it](/i/anthropics-skills-internal-comms) — or use the Download button on [its Claudinho page](/skills/anthropics-skills-internal-comms). A .skill file lands in your Downloads folder.",
      },
      {
        title: "Drag that file into Cowork",
        body: "Open your Downloads folder and drag the file into the Claude desktop app window. Steps 1 and 2 are once — from now on you start at step 3.",
      },
      {
        title: "Start a task and drop the week in",
        body: "Channel exports, notes, emails — as they are. No tidying first.",
      },
      {
        title: "Type the sentence",
        body: "You don't need to mention the skill: Claude recognizes an internal update and uses it on its own.",
        typed: "Turn this week's updates in these files into our weekly 3P team update — progress, plans, problems.",
      },
      {
        title: "Review and send",
        body: "Thirty seconds to read, so thirty seconds to check. When it earns a repeat, /schedule it for Friday.",
      },
    ],
    nextCase: "question-to-research-brief",
  },

  // ── 05 · Design · LIVE — real run of anthropics knowledge-synthesis (2026-06-12).
  // 5 fabricated-but-realistic interview transcripts → ranked themes with
  // counts and quotes. Artifact: planning folder case-06-interviews/.
  {
    slug: "interviews-to-findings",
    shelf: "design",
    subShelf: "research-synthesis",
    navLabel: "Interviews → findings",
    title: "Raw interviews → synthesized findings",
    standfirst:
      "The interviews are done. Now someone re-reads all of them before anyone can say what was learned. That re-read is what this removes.",
    status: "live",
    concept: {
      lead: "Synthesis is a job you delegate, not just a summary.",
      body: "Themes, supporting quotes, and a recommendation — from the transcripts, not your memory.",
    },
    value: [
      "**The re-read days back** — themes come ranked, with the quotes attached.",
      "**Counted, not vibed** — every theme says how many interviews support it. “3 of 5”, not “everyone says”.",
      "**Single voices stay single** — a one-person point gets flagged, not promoted to a trend. Our run flagged exactly one.",
      "**A recommendation, not a recap** — it ends with what to do, in order.",
    ],
    skill: {
      skillSlug: "anthropics-knowledge-work-plugins-knowledge-synthesis",
      name: "knowledge-synthesis",
      publisher: "anthropics",
      blurb:
        "Merges what many sources say into one answer — deduplicated, ranked, confidence-labeled, every quote attributed.",
      installCommand: "npx skills add https://github.com/anthropics/knowledge-work-plugins/tree/main/knowledge-synthesis",
    },
    scenario: [
      "**Five interviews, 126 minutes of transcripts** — and the patterns are in there somewhere.",
      "**So someone re-reads everything**, highlighter out, trying to remember if three people said the thing or two.",
    ],
    sentence:
      "Synthesize these five interviews into findings — ranked themes with supporting quotes and counts, flag anything only one person said, end with a recommendation.",
    before: {
      label: "Before — 5 transcripts, 126 min",
      lines: [
        "int-1 carla: “the POS report never matches the bank one”",
        "int-3 patricia: “automation of a mess is faster mess”",
        "int-4 ricardo: “no system flagged it when it mattered”",
        "your notes: did 3 people say the pix thing, or 2?",
      ],
    },
    after: {
      label: "After — ranked findings",
      rows: [
        { label: "Themes", value: "4, ranked", dot: "#4571d8" },
        { label: "Support", value: "counted per theme", dot: "var(--accent)" },
        { label: "Quotes", value: "attributed", dot: "var(--verified)" },
        { label: "Flagged (1)", value: "single-source", dot: "var(--ink-3)" },
      ],
      footer: "✓ 5 interviews → findings + a sequenced recommendation",
    },
    stats: [
      { v: "~1 day", k: "of re-reading, back" },
      { v: "1", k: "single voice flagged, 0 promoted" },
      { v: "1", k: "sentence typed" },
    ],
    howTo: [
      {
        title: "Download the skill",
        body: "[Click here to download it](/i/anthropics-knowledge-work-plugins-knowledge-synthesis) — or use the Download button on [its Claudinho page](/skills/anthropics-knowledge-work-plugins-knowledge-synthesis). A .skill file lands in your Downloads folder.",
      },
      {
        title: "Drag that file into Cowork",
        body: "Open your Downloads folder and drag the file into the Claude desktop app window. Steps 1 and 2 are once — from now on you start at step 3.",
      },
      {
        title: "Start a task and drop the transcripts in",
        body: "All of them — recordings transcribed, notes, whatever you have.",
      },
      {
        title: "Type the sentence",
        body: "You don't need to mention the skill: Claude recognizes a synthesis job and uses it on its own.",
        typed:
          "Synthesize these five interviews into findings — ranked themes with supporting quotes and counts, flag anything only one person said, end with a recommendation.",
      },
      {
        title: "Review the findings",
        body: "Check the quotes against your memory of the calls — they're attributed, so it takes minutes, not a re-read.",
      },
    ],
    nextCase: "first-pass-financial-model",
  },

  // ── 06 · Finance · LIVE — real run of claude-office-skills financial-modeling
  // (2026-06-12). 24 raw monthly rows → assumptions-driven .xlsx with working
  // formulas (math verified independently). Artifact: case-07-model/.
  {
    slug: "first-pass-financial-model",
    shelf: "finance",
    subShelf: "runway-forecasting",
    navLabel: "First-pass financial model",
    title: "Build a first-pass financial model from raw data",
    standfirst:
      "The board asks for a forecast, and you rebuild the same spreadsheet structure you build every time. This hands you the structure — working.",
    status: "live",
    concept: {
      lead: "Skills produce real artifacts — a working .xlsx, not a screenshot.",
      body: "You open it and keep going, assumptions and all.",
    },
    value: [
      "**The rebuild evening back** — actuals aggregated, projections wired, structure standard.",
      "**Assumptions you can argue with** — five blue cells drive the whole model. Change one in the meeting, everything recalculates.",
      "**A real Excel file with working formulas** — your finance person takes it from here, nothing to re-type.",
      "**An honest first pass** — the 80% scaffold to refine, not a board-final valuation pretending otherwise.",
    ],
    skill: {
      skillSlug: "claude-office-skills-skills-financial-modeling",
      name: "financial-modeling",
      publisher: "claude-office-skills",
      blurb:
        "Builds assumption-driven financial models — from raw actuals to projections with working formulas, in standard modeling conventions.",
      installCommand: "npx skills add https://github.com/claude-office-skills/skills/tree/main/financial-modeling",
    },
    scenario: [
      "**You have the raw actuals** — 24 months of revenue and costs in an export, no totals, no structure.",
      "**And an ask: “can we see three years out?”** So you start rebuilding the same model skeleton you've built before.",
    ],
    sentence:
      "Build a first-pass model from these actuals — 2024–2025 aggregated, 2026–2028 projected, assumptions in their own tab so I can change them.",
    before: {
      label: "Before — 24 rows of raw actuals",
      lines: [
        "2024-01, 98412, 23117, 38990, 11214, …",
        "2025-07, 152330, 36110, 47821, 17442, …",
        "…22 more rows. no totals, no structure",
        "the ask: “can we see three years out?”",
      ],
    },
    after: {
      label: "After — an assumptions-driven model",
      rows: [
        { label: "Assumptions", value: "5, editable", dot: "#4571d8" },
        { label: "Actuals", value: "2024–25, aggregated", dot: "var(--accent)" },
        { label: "Projections", value: "2026–28, formulas", dot: "var(--verified)" },
        { label: "EBITDA path", value: "29.4% modeled fwd", dot: "var(--ink-3)" },
      ],
      footer: "✓ change an assumption — the whole model recalculates",
    },
    stats: [
      { v: "~1 eve.", k: "of structure-building, back" },
      { v: "5", k: "assumptions, 0 buried constants" },
      { v: "1", k: "sentence typed" },
    ],
    howTo: [
      {
        title: "Download the skill",
        body: "[Click here to download it](/i/claude-office-skills-skills-financial-modeling) — or use the Download button on [its Claudinho page](/skills/claude-office-skills-skills-financial-modeling). A .skill file lands in your Downloads folder.",
      },
      {
        title: "Drag that file into Cowork",
        body: "Open your Downloads folder and drag the file into the Claude desktop app window. Steps 1 and 2 are once — from now on you start at step 3.",
      },
      {
        title: "Start a task and drop the actuals in",
        body: "The raw export, as it came out. Monthly is fine.",
      },
      {
        title: "Type the sentence",
        body: "You don't need to mention the skill: Claude recognizes a modeling job and uses it on its own.",
        typed:
          "Build a first-pass model from these actuals — 2024–2025 aggregated, 2026–2028 projected, assumptions in their own tab so I can change them.",
      },
      {
        title: "Open the model and argue with it",
        body: "That's what the assumptions tab is for — change the growth rate live in the meeting.",
      },
    ],
    nextCase: "proposal-from-call",
  },

  // ── 07 · Sales · LIVE — real run of claude-office-skills proposal-writer
  // (2026-06-12). One 41-min discovery transcript → real .docx proposal (7
  // sections) + follow-up email. Artifact: case-08-proposal/.
  {
    slug: "proposal-from-call",
    shelf: "sales",
    subShelf: "demo-followup",
    navLabel: "Proposal from a call",
    title: "A proposal drafted from the discovery call",
    standfirst:
      "The call went well. Now the proposal has to say what they said, back to them — and drafting that takes the evening. This takes the transcript.",
    status: "live",
    concept: {
      lead: "One input can become several deliverables.",
      body: "The call becomes the proposal and the follow-up email in one pass.",
    },
    value: [
      "**The drafting evening back** — the call already contains the proposal; this extracts it.",
      "**It says what they said** — their constraint (nothing installs on store machines), their date (the July 2 committee), their fear (adoption) — answered in the design, not boilerplate.",
      "**Two deliverables from one input** — the proposal and the follow-up email, consistent with each other.",
      "**A real .docx** — open, adjust the numbers, send.",
    ],
    skill: {
      skillSlug: "claude-office-skills-skills-proposal-writer",
      name: "proposal-writer",
      publisher: "claude-office-skills",
      blurb:
        "Turns discovery material into a structured proposal — executive summary through next steps — in a real document.",
      installCommand: "npx skills add https://github.com/claude-office-skills/skills/tree/main/proposal-writer",
    },
    scenario: [
      "**The discovery call had everything** — their pain, their constraint, their timeline, their fear.",
      "**Now it has to come back as a proposal** that proves you heard it — while it's still fresh. That drafting is the evening.",
    ],
    sentence:
      "Draft a proposal from this discovery call — their goals, constraints and timeline reflected back — plus the follow-up email to send with it.",
    before: {
      label: "Before — a 41-minute transcript",
      lines: [
        "sandra: “I need to stop paying people to compare spreadsheets”",
        "otavio: nothing installs on POS machines. cloud or nothing",
        "sandra: committee meets jul 2. budget exists this quarter",
        "sandra: store staff “allergic to new systems”",
        "agreed: proposal before jul 2",
      ],
    },
    after: {
      label: "After — proposal + email",
      rows: [
        { label: "Proposal", value: ".docx, 7 sections", dot: "#4571d8" },
        { label: "Their constraints", value: "answered in design", dot: "var(--accent)" },
        { label: "Timeline", value: "built to their jul 2", dot: "var(--verified)" },
        { label: "Follow-up email", value: "ready to send", dot: "var(--ink-3)" },
      ],
      footer: "✓ one call → two deliverables, every section traceable",
    },
    stats: [
      { v: "~1 eve.", k: "of drafting, back" },
      { v: "2", k: "deliverables from 1 input" },
      { v: "1", k: "sentence typed" },
    ],
    howTo: [
      {
        title: "Download the skill",
        body: "[Click here to download it](/i/claude-office-skills-skills-proposal-writer) — or use the Download button on [its Claudinho page](/skills/claude-office-skills-skills-proposal-writer). A .skill file lands in your Downloads folder.",
      },
      {
        title: "Drag that file into Cowork",
        body: "Open your Downloads folder and drag the file into the Claude desktop app window. Steps 1 and 2 are once — from now on you start at step 3.",
      },
      {
        title: "Start a task and drop the transcript in",
        body: "The call recording's transcript, or even your raw notes from it.",
      },
      {
        title: "Type the sentence",
        body: "You don't need to mention the skill: Claude recognizes a proposal job and uses it on its own.",
        typed:
          "Draft a proposal from this discovery call — their goals, constraints and timeline reflected back — plus the follow-up email to send with it.",
      },
      {
        title: "Review both, adjust, send",
        body: "Check the numbers and the names — the structure and the listening are done.",
      },
    ],
    nextCase: "clean-a-messy-export",
  },

  // ── 08 · Finance · LIVE (flagship) ──
  {
    // ★ FLAGSHIP — built from a real run of anthropics/skills xlsx (2026-06-10).
    // Numbers below are the run's actual output, not invented.
    slug: "clean-a-messy-export",
    shelf: "finance",
    subShelf: "reporting-dashboards",
    navLabel: "Messy export → board report",
    title: "Clean a messy export into a board-ready report",
    standfirst:
      "You download the export, it comes out a mess, and you spend an hour turning it into something presentable. This removes that hour.",
    status: "live",
    concept: {
      lead: "Cleanup and formatting is rule-based — a perfect handoff.",
      body: "Three date formats, amounts typed as text, duplicated rows: every fix follows a rule, so none of it needs you.",
    },
    value: [
      "**An hour or two back, every month** — the cleanup follows rules, so it doesn't need you.",
      "**Nothing silently guessed** — the 5 odd rows went to a “Flagged for review” tab, not into your totals.",
      "**A real Excel file, not a picture of one** — the formulas work: change a number, the totals update.",
      "**Repeatable** — next month, same sentence, same clean report.",
    ],
    skill: {
      skillSlug: "anthropics-skills-xlsx",
      name: "xlsx",
      publisher: "anthropics",
      blurb:
        "Reads, fixes, and builds spreadsheet files end to end — cleaning messy exports into proper, formatted workbooks with live formulas and zero formula errors.",
      installCommand: "npx skills add https://github.com/anthropics/skills/tree/main/xlsx",
    },
    scenario: [
      "**You download the revenue export** and it arrives ugly: junk rows, dates in three formats, amounts typed as text (“R$ 1.234,56”), duplicates hiding in 220 rows.",
      "**So you fix it by hand** — delete, retype, hunt duplicates, rebuild the totals. An hour or two, every month.",
    ],
    sentence:
      "Clean this export into a board-ready revenue report — totals by plan and region — and flag anything I should look at.",
    before: {
      label: "Before — 220 raw lines",
      lines: [
        "BILLING SYSTEM v4.2 — TRANSACTION EXPORT",
        "2026-05-07 · AutoPeças Silva · Pro · 4470 · pago",
        "12/05/2026 · Livraria Foco · Starter · R$ 245,00",
        "May 3, 2026 · Mercado Aurora · PRO · 4470 · paid",
        "--- SUBTOTAL PAGE 1 ---",
        "· Construmax · Enterprise · 4900 · SP   Paid",
      ],
    },
    after: {
      label: "After — board-ready",
      rows: [
        { label: "Enterprise", value: "R$ 338,100", dot: "#4571d8" },
        { label: "Pro", value: "R$ 178,055", dot: "var(--accent)" },
        { label: "Starter", value: "R$ 55,370", dot: "var(--verified)" },
        { label: "Flagged (5)", value: "for review", dot: "var(--ink-3)" },
      ],
      footer: "✓ 214 transactions · 20 customers · formulas that update",
    },
    stats: [
      { v: "~2 hrs", k: "of cleanup, back" },
      { v: "5", k: "rows flagged, 0 guessed" },
      { v: "1", k: "sentence typed" },
    ],
    howTo: [
      {
        title: "Download the skill",
        body: "[Click here to download it](/i/anthropics-skills-xlsx) — or use the Download button on [its Claudinho page](/skills/anthropics-skills-xlsx). A file called anthropics-skills-xlsx.skill lands in your Downloads folder.",
      },
      {
        title: "Drag that file into Cowork",
        body: "Open your Downloads folder and drag the file into the Claude desktop app window, like attaching a file to a chat. It shows up under Customize → Skills. Steps 1 and 2 are once — from now on you start at step 3.",
      },
      {
        title: "Start a task and drop your export in",
        body: "Broken as-is — no pre-cleaning, no renaming.",
      },
      {
        title: "Type the sentence",
        body: "You don't need to mention the skill: Claude sees a spreadsheet job and uses it on its own.",
        typed:
          "Clean this export into a board-ready revenue report — totals by plan and region — and flag anything I should look at.",
      },
      {
        title: "Review the spreadsheet",
        body: "A real Excel file back: a Summary tab whose formulas still work — change a number and the totals update — the cleaned data behind it, and a “Flagged for review” tab with the rows it refused to fix silently.",
      },
    ],
    nextCase: "call-notes-to-deck",
  },

  // ── 09 · Marketing · LIVE — real run of coreyhaines31/competitor-profiling
  // (2026-06-11). Real subject profiled from scraped pages following the
  // skill's template; 7 sections, 4 gaps flagged. Artifact in planning
  // folder, case-03/. Published copy keeps the competitor generic.
  {
    slug: "competitor-teardown",
    shelf: "marketing",
    subShelf: "positioning-messaging",
    navLabel: "Competitor profile",
    title: "Profile a competitor without losing the day",
    standfirst:
      "“How do we compare to them?” usually costs an afternoon of tabs and a doc of fragments. This makes it one sentence.",
    status: "live",
    concept: {
      lead: "Skills chain steps — research, then structure, then write.",
      body: "Each step feeds the next, so a vague ask comes back as a finished profile.",
    },
    value: [
      "**The afternoon back** — the structure asks the questions; the research fills them in.",
      "**An answer, not a link pile** — organized to answer “how do we compare”, not to store bookmarks.",
      "**Gaps stay visible** — what can't be verified gets flagged (4 items in our run), never papered over.",
      "**Comparable** — same structure every time, so two competitors sit side by side.",
    ],
    skill: {
      skillSlug: "coreyhaines31-marketingskills-competitor-profiling",
      name: "competitor-profiling",
      publisher: "coreyhaines31",
      blurb:
        "Turns a competitor's website into a structured profile — positioning, pricing, strengths, weaknesses — with every claim traced to a source.",
      installCommand:
        "npx skills add https://github.com/coreyhaines31/marketingskills/tree/main/competitor-profiling",
    },
    scenario: [
      "**Someone asks how you compare** to a competitor — a partner, an investor, a big prospect.",
      "**So you open the tabs** — their site, the pricing page, reviews, LinkedIn — and paste fragments into a doc until it sort of answers the question.",
    ],
    sentence:
      "Profile this competitor from their website — positioning, pricing, where they win and lose, and how we sell against them. Flag anything you can't verify.",
    before: {
      label: "Before — nine tabs and a doc",
      lines: [
        "tab: their homepage (again)",
        "tab: pricing — “contact sales”, of course",
        "tab: reviews, page 3",
        "notes.doc: “they do stablecoins?? check”",
        "the question, still unanswered: how do we compare?",
      ],
    },
    after: {
      label: "After — one structured profile",
      rows: [
        { label: "Positioning", value: "in one line", dot: "#4571d8" },
        { label: "Pricing teardown", value: "model + the gates", dot: "var(--accent)" },
        { label: "Win / lose vs you", value: "with evidence", dot: "var(--verified)" },
        { label: "Flagged (4)", value: "not guessed", dot: "var(--ink-3)" },
      ],
      footer: "✓ 7 sections, every claim sourced from their own pages",
    },
    stats: [
      { v: "~½ day", k: "of tab-hopping, back" },
      { v: "4", k: "gaps flagged, 0 guessed" },
      { v: "1", k: "sentence typed" },
    ],
    howTo: [
      {
        title: "Download the skill",
        body: "[Click here to download it](/i/coreyhaines31-marketingskills-competitor-profiling) — or use the Download button on [its Claudinho page](/skills/coreyhaines31-marketingskills-competitor-profiling). A .skill file lands in your Downloads folder.",
      },
      {
        title: "Drag that file into Cowork",
        body: "Open your Downloads folder and drag the file into the Claude desktop app window. Steps 1 and 2 are once — from now on you start at step 3.",
      },
      {
        title: "Start a task — no files needed",
        body: "Just name the competitor, or paste their website address.",
      },
      {
        title: "Type the sentence",
        body: "You don't need to mention the skill: Claude recognizes competitor research and uses it on its own.",
        typed:
          "Profile this competitor from their website — positioning, pricing, where they win and lose, and how we sell against them. Flag anything you can't verify.",
      },
      {
        title: "Review the profile",
        body: "Same structure every time, so profiles compare side by side. Gaps are marked, not filled in.",
      },
    ],
    nextCase: "weekly-team-digest",
  },
];

// ─── lookups ─────────────────────────────────────────────────────────────────

export function getCase(slug: string): CaseStudy | undefined {
  return CASES.find((p) => p.slug === slug);
}

export function getStartPage(topic: string): GuidePage | undefined {
  return START_PAGES.find((i) => i.topic === topic);
}

/** Cases grouped by shelf, in MANUAL_SHELF_ORDER, skipping empty shelves. */
export function casesByShelf(): { shelf: ShelfId; title: string; cases: CaseStudy[] }[] {
  return MANUAL_SHELF_ORDER.map((shelf) => ({
    shelf,
    title: SHELF_TITLES[shelf],
    cases: CASES.filter((p) => p.shelf === shelf),
  })).filter((g) => g.cases.length > 0);
}

export const LIVE_CASE_COUNT = CASES.filter((p) => p.status === "live").length;
export const TOTAL_TOPICS =
  START_PAGES.length + 1 + FEATURES.length + SKILLS_PAGES.length + CASES.length;

// LAUNCHED 2026-06-11. To take the Manual off production again, restore the
// env-keyed gate (see git history) or set this to false on a branch.
export const MANUAL_ENABLED = true;

// WIP pages (feature-guide stubs, example stubs) stay off production: visible
// in dev/preview for production work, hidden (404 + absent from the index) on
// the live site until each is finished. NODE_ENV guard for the stale local
// VERCEL_ENV — same caveat as the old launch gate.
export const SHOW_WIP =
  process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production";

/** Cases visible in the current environment (prod = live only). */
export function visibleCases(): CaseStudy[] {
  return SHOW_WIP ? CASES : CASES.filter((c) => c.status === "live");
}

/** Feature pages visible in the current environment (prod = guided only). */
export function visibleFeatures(): CoworkFeature[] {
  return SHOW_WIP ? FEATURES : FEATURES.filter((f) => f.guide);
}
