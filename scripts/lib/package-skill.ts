/**
 * packageSkill — fetch a skill from GitHub, zip it as <slug>.skill, upload to Supabase Storage.
 *
 * Returns one of:
 *   { bundleUrl: string; sourceRef: string }   — packaged and uploaded
 *   { sourceOnly: true }                        — complex plugin; tell UI to show copy-command
 *   { failed: true; reason: string }            — hard error
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import * as fflate from "fflate";

// ─── env ──────────────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BUNDLE_BUCKET = "bundles";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const SECRET_PATTERNS = [/sk-[A-Za-z0-9]{20,}/, /AKIA[A-Z0-9]{16}/, /-----BEGIN [A-Z]+ PRIVATE KEY-----/];
// Indicators of a complex plugin that needs build tooling — return sourceOnly instead of failing.
const COMPLEX_INDICATORS = ["package.json", "Makefile", "CMakeLists.txt", "go.mod", "Cargo.toml"];

// ─── types ────────────────────────────────────────────────────────────────────

export type PackageResult =
  | { bundleUrl: string; sourceRef: string }
  | { sourceOnly: true }
  | { failed: true; reason: string };

export type ListingInput = {
  id: string;
  slug: string;
  source_url: string;
  skill_path?: string | null;
};

// ─── GitHub helpers ───────────────────────────────────────────────────────────

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "claudinho/1.0",
  };
  if (GITHUB_TOKEN) h["Authorization"] = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function ghGet(path: string): Promise<unknown> {
  const url = `https://api.github.com/${path}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub ${url}: ${res.status} ${res.statusText}`);
  return res.json();
}

function parseOwnerRepo(sourceUrl: string): { owner: string; repo: string } | null {
  try {
    const parts = new URL(sourceUrl).pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

// ─── skill-dir resolution ─────────────────────────────────────────────────────

type TreeEntry = { path: string; type: "blob" | "tree"; size?: number; sha: string };

async function getRepoTree(owner: string, repo: string, ref: string): Promise<TreeEntry[]> {
  const data = await ghGet(`repos/${owner}/${repo}/git/trees/${ref}?recursive=1`) as {
    tree: TreeEntry[];
    truncated: boolean;
  };
  if (data.truncated) {
    // Very large repo — can't get full tree; caller handles this.
    throw new Error("repo tree truncated");
  }
  return data.tree;
}

/** Find the directory containing SKILL.md. Returns the dir prefix (empty = root). */
function findSkillDir(tree: TreeEntry[], hintPath?: string | null): string | null {
  if (hintPath) {
    // Verify SKILL.md exists at the hint path
    const normalized = hintPath.replace(/\/$/, "");
    const candidate = `${normalized}/SKILL.md`;
    if (tree.some((e) => e.path === candidate)) return normalized;
  }
  // Locate any SKILL.md
  const skillMds = tree.filter((e) => e.type === "blob" && e.path.endsWith("SKILL.md"));
  if (skillMds.length === 0) return null;
  // Prefer the shallowest one
  skillMds.sort((a, b) => a.path.split("/").length - b.path.split("/").length);
  const skillMdPath = skillMds[0].path;
  const dir = skillMdPath.slice(0, skillMdPath.lastIndexOf("/"));
  return dir; // empty string = root
}

// ─── file content fetch ───────────────────────────────────────────────────────

async function fetchBlobContent(owner: string, repo: string, sha: string): Promise<Uint8Array> {
  const data = await ghGet(`repos/${owner}/${repo}/git/blobs/${sha}`) as {
    content: string;
    encoding: string;
  };
  if (data.encoding !== "base64") throw new Error(`unexpected blob encoding: ${data.encoding}`);
  const raw = data.content.replace(/\s/g, "");
  return Uint8Array.from(Buffer.from(raw, "base64"));
}

// ─── safety scan ─────────────────────────────────────────────────────────────

function looksLikeText(bytes: Uint8Array): boolean {
  // Heuristic: if first 512 bytes are mostly printable, treat as text
  const sample = bytes.slice(0, 512);
  let nonPrintable = 0;
  for (const b of sample) {
    if ((b < 32 || b > 126) && b !== 9 && b !== 10 && b !== 13) nonPrintable++;
  }
  return nonPrintable / sample.length < 0.1;
}

function containsSecret(text: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(text));
}

// ─── main export ─────────────────────────────────────────────────────────────

export async function packageSkill(listing: ListingInput): Promise<PackageResult> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { failed: true, reason: "Missing Supabase env vars" };
  }

  const parsed = parseOwnerRepo(listing.source_url);
  if (!parsed) return { failed: true, reason: `Cannot parse source_url: ${listing.source_url}` };
  const { owner, repo } = parsed;

  // 1. Get default branch + latest commit SHA
  const repoData = await ghGet(`repos/${owner}/${repo}`) as { default_branch: string };
  const branch = repoData.default_branch;

  const branchData = await ghGet(`repos/${owner}/${repo}/branches/${branch}`) as {
    commit: { sha: string };
  };
  const latestSHA = branchData.commit.sha;

  // 2. Get full repo tree
  let tree: TreeEntry[];
  try {
    tree = await getRepoTree(owner, repo, latestSHA);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("truncated")) return { sourceOnly: true };
    return { failed: true, reason: msg };
  }

  // 3. Locate the skill directory
  const skillDir = findSkillDir(tree, listing.skill_path);
  if (skillDir === null) return { failed: true, reason: "SKILL.md not found in repo" };

  // 4. Collect files in skill dir
  const prefix = skillDir === "" ? "" : `${skillDir}/`;
  const skillFiles = tree.filter(
    (e) => e.type === "blob" && e.path.startsWith(prefix)
  );

  // Check for complex plugin indicators (outside our prefix is fine; inside signals build tooling)
  const fileNames = skillFiles.map((f) => f.path.slice(prefix.length));
  const hasComplexIndicator = COMPLEX_INDICATORS.some((ind) => fileNames.includes(ind));
  if (hasComplexIndicator) return { sourceOnly: true };

  // 5. Fetch all blobs and validate
  const zipEntries: Record<string, Uint8Array> = {};
  for (const entry of skillFiles) {
    if ((entry.size ?? 0) > MAX_FILE_BYTES) {
      return { failed: true, reason: `File too large: ${entry.path} (${entry.size} bytes)` };
    }
    const bytes = await fetchBlobContent(owner, repo, entry.sha);
    const relPath = entry.path.slice(prefix.length);
    if (looksLikeText(bytes)) {
      const text = new TextDecoder().decode(bytes);
      if (containsSecret(text)) {
        return { failed: true, reason: `Secret pattern detected in ${relPath}` };
      }
    }
    zipEntries[relPath] = bytes;
  }

  if (!zipEntries["SKILL.md"]) {
    return { failed: true, reason: "SKILL.md missing from collected files" };
  }

  // 6. Create zip — SKILL.md at root, no nesting
  const zipBuffer: Uint8Array = fflate.zipSync(zipEntries, { level: 6 });

  // 7. Upload to Supabase Storage
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const bundlePath = `${listing.slug}.skill`;

  const { error: uploadError } = await db.storage
    .from(BUNDLE_BUCKET)
    .upload(bundlePath, zipBuffer, {
      contentType: "application/zip",
      upsert: true,
    });

  if (uploadError) {
    return { failed: true, reason: `Storage upload failed: ${uploadError.message}` };
  }

  const { data: urlData } = db.storage.from(BUNDLE_BUCKET).getPublicUrl(bundlePath);

  return { bundleUrl: urlData.publicUrl, sourceRef: latestSHA };
}
