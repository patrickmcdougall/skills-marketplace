/**
 * scripts/scrape-skillssh.ts
 *
 * SUPERSEDED — The skills.sh API is now available via Vercel OIDC (no API
 * key needed). Use import-from-skillssh.ts and sync-install-counts.ts
 * instead; both call the real API directly.
 *
 * This scraper was a workaround while the API was gated. The HTML-based
 * install counts it produces are unreliable (all entries parsed as 600 due
 * to rate-limit text appearing in the page). Do not use the snapshot it
 * generates for install count data.
 *
 * Keeping this file for reference; safe to delete.
 *
 * ---
 *
 * Claudinho — scrapes the public skills.sh leaderboard pages and writes
 * a snapshot to scripts/skillssh-snapshot.json.
 *
 * Why this existed:
 *   The skills.sh API endpoint at /api/v1/skills returned 401 without an
 *   API key, despite the docs saying public endpoints don't need auth.
 *   While waiting on a key, the public HTML pages were accessible and
 *   contained the same leaderboard data. This script fetched them, parsed
 *   out the skills, and wrote a snapshot in roughly the same shape the API
 *   would have returned.
 *
 *   import-from-skillssh.ts and sync-install-counts.ts both read this
 *   snapshot when no SKILLSSH_API_KEY is configured. Once the API key
 *   arrives, the scraper can be retired.
 *
 * Pages scraped:
 *   https://skills.sh/         (all-time top installed, ~280 entries)
 *   https://skills.sh/trending (recent growth)
 *   https://skills.sh/hot      (last hour vs. yesterday)
 *
 * Limits:
 *   Each page caps at the top ~280 entries on the homepage. To go deeper,
 *   we'd need pagination, which isn't exposed on the public HTML. Once we
 *   have an API key we get all 8,000+.
 *
 * Run:
 *   npx tsx scripts/scrape-skillssh.ts
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TARGETS = [
  { url: "https://skills.sh/",          view: "all-time" as const },
  { url: "https://skills.sh/trending",  view: "trending" as const },
  { url: "https://skills.sh/hot",       view: "hot"      as const },
];

const USER_AGENT = "claudinho-scraper/0.1 (+claudinho.app)";
const SNAPSHOT_PATH = resolve(process.cwd(), "scripts/skillssh-snapshot.json");

// Paths that look like /owner/repo/slug but aren't skills. Filter them out.
const NON_SKILL_OWNERS = new Set([
  "docs", "api", "agent", "topic", "agents", "audits", "official",
  "trending", "hot", "about", "contact", "privacy", "terms",
  "site", // used for well-known sources like "open.feishu.cn"
]);

type Skill = {
  id: string;          // "owner/repo/slug"
  source: string;      // "owner/repo"
  slug: string;        // skill slug
  installs: number;
  views: string[];     // which leaderboard views surfaced this entry
};

async function main() {
  console.log(`[scrape] scraping ${TARGETS.length} skills.sh pages…`);

  const seen = new Map<string, Skill>();
  for (const target of TARGETS) {
    let html: string;
    try {
      html = await fetchHtml(target.url);
    } catch (err) {
      console.warn(`[scrape] FAILED ${target.url}: ${(err as Error).message}`);
      continue;
    }
    const entries = parsePage(html);
    console.log(`[scrape] ${target.url} → ${entries.length} entries`);

    for (const e of entries) {
      const existing = seen.get(e.id);
      if (!existing) {
        seen.set(e.id, { ...e, views: [target.view] });
      } else {
        existing.installs = Math.max(existing.installs, e.installs);
        if (!existing.views.includes(target.view)) existing.views.push(target.view);
      }
    }
  }

  const skills = Array.from(seen.values()).sort((a, b) => b.installs - a.installs);
  const withInstalls = skills.filter((s) => s.installs > 0).length;

  const snapshot = {
    generatedAt: new Date().toISOString(),
    total: skills.length,
    withInstallCount: withInstalls,
    skills,
  };
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));

  console.log(`\n[scrape] done — wrote ${skills.length} unique skills to ${SNAPSHOT_PATH}`);
  console.log(`[scrape] ${withInstalls} of them have parsed install counts; ${skills.length - withInstalls} we couldn't read a number for`);
  if (withInstalls < skills.length * 0.5) {
    console.warn(`[scrape] WARNING: parsed install counts for under half of entries. The HTML structure may have changed — check parsePage().`);
  }
  console.log(`[scrape] top 10:`);
  for (const s of skills.slice(0, 10)) {
    console.log(`  ${s.installs.toLocaleString().padStart(10)}  ${s.id}`);
  }
}

// ---------- fetch ----------

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

// ---------- parse ----------

/**
 * skills.sh's leaderboard rows render as anchor tags whose href looks like
 * `/owner/repo/slug`. The install count appears as a text node alongside —
 * formatted as "1.7M", "474.4K", "56.0K", or a plain integer.
 *
 * We look for href patterns, then sniff a window of ~400 characters around
 * each one for the install count. The pairing isn't perfect (the same row
 * might render in two formats across views), but it's good enough for a
 * snapshot. Worst case: some entries have installs=0, which we filter on
 * read.
 */
function parsePage(html: string): Skill[] {
  const out: Skill[] = [];
  const seen = new Set<string>();

  // Match anchor hrefs of the form /owner/repo/slug. Filter known non-skill
  // first segments. Skill slugs and owner/repo names can contain dots and
  // hyphens (e.g. "open.feishu.cn/lark-doc"), so we accept that range.
  const hrefRe = /href="\/([A-Za-z0-9][\w.-]*)\/([A-Za-z0-9][\w.-]*)\/([A-Za-z0-9][\w.-]*)"/g;

  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(html)) !== null) {
    const [_, owner, repo, slug] = match;
    if (NON_SKILL_OWNERS.has(owner)) continue;
    const id = `${owner}/${repo}/${slug}`;
    if (seen.has(id)) continue;
    seen.add(id);

    // Look in a window after the match for a count like "1.7M" or "474.4K".
    // Strip HTML tags first — skills.sh renders the count as separate DOM
    // nodes (e.g. `<span>1.7</span><span>M</span>`), so we need adjacent
    // characters after tag removal for the regex to catch.
    const windowEnd = Math.min(html.length, match.index + 800);
    const windowText = html.slice(match.index, windowEnd);
    const cleanText = stripHtml(windowText);
    const installs = extractInstallCount(cleanText);

    out.push({ id, source: `${owner}/${repo}`, slug, installs, views: [] });
  }
  return out;
}

/**
 * Strip HTML tags so that DOM-split numbers like `<span>1.7</span><span>M</span>`
 * collapse into `1.7M` for the regex below. Also strips style/script blocks
 * which can contain misleading numbers (e.g. viewBox="0 0 600 ...").
 */
function stripHtml(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Extract an install count from a text window. Accepts:
 *   1.7M, 474.4K, 56.0K, 56000, 1234
 * Picks the largest number found in the window — install counts are usually
 * the biggest standalone numeric in a row.
 */
function extractInstallCount(text: string): number {
  // Prefer M/K-suffixed numbers (they're explicit install-count formatting on skills.sh).
  const suffixed = [...text.matchAll(/(\d+(?:\.\d+)?)([KMB])\b/g)];
  let best = 0;
  for (const m of suffixed) {
    const n = parseFloat(m[1]);
    const mult = m[2] === "K" ? 1000 : m[2] === "M" ? 1_000_000 : 1_000_000_000;
    const v = Math.round(n * mult);
    if (v > best) best = v;
  }
  if (best > 0) return best;

  // Fall back to plain integers in the 100..9_999_999 range. Avoid years (1900-2100)
  // and small noise numbers. Reject decimals.
  const plain = [...text.matchAll(/(?<![\w.])(\d{3,8})(?![\w.])/g)];
  for (const m of plain) {
    const v = parseInt(m[1], 10);
    if (v >= 100 && v < 10_000_000 && (v < 1900 || v > 2100)) {
      if (v > best) best = v;
    }
  }
  return best;
}

// ---------- go ----------

main().catch((err) => {
  console.error("[scrape] fatal:", err);
  process.exit(1);
});
