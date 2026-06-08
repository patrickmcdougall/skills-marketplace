// lib/trust.ts
// Derives one plain-language trust verdict from Gen, Socket, and Snyk audits.
//
// Concern thresholds rationale (keep in sync with TRUST_CONFIG):
//   Gen    — High/Critical only: agent-native scanner; these levels mean the
//             skill's *instructions* are behaviorally suspect — the most
//             important signal for non-technical users.
//   Socket — any non-pass alert: baseline is "0 alerts" across nearly all
//             skills, so any alert is meaningful.
//   Snyk   — High/Critical only: most conservative/noisy scanner; Med Risk is
//             extremely common on legitimate mainstream skills (e.g. shadcn,
//             find-skills). If Med flagged, most of the catalog would show amber
//             and the whole marketplace would read as unsafe.

// ─── types ────────────────────────────────────────────────────────────────────

export type SkillTrustStatus = "verified" | "flagged" | "pending";

/** Raw per-source inputs — all optional since any audit may be missing. */
export interface SkillAuditInput {
  gen?: { riskLevel: string | null; status: string } | null;
  socket?: { riskLevel: string | null; status: string; summary: string | null } | null;
  snyk?: { riskLevel: string | null; status: string } | null;
}

export interface TrustCheck {
  present: boolean;
  concern: boolean;
  subtext: string; // human-readable verdict for the detail page
}

export interface SkillTrust {
  status: SkillTrustStatus;
  /** Plain-language reasons why a skill is flagged (empty when verified/pending). */
  reasons: string[];
  checks: {
    gen: TrustCheck;
    socket: TrustCheck;
    snyk: TrustCheck;
  };
}

// ─── config ───────────────────────────────────────────────────────────────────

/** Per-source concern thresholds — tune here, logic stays untouched. */
export const TRUST_CONFIG = {
  gen: {
    // risk_level values that count as a concern for the Gen Agent Trust Hub.
    concernRiskLevels: ["HIGH", "CRITICAL"],
  },
  socket: {
    // Any non-pass status means Socket raised an alert.
    concernStatuses: ["warn", "fail"],
  },
  snyk: {
    // Only High/Critical count for Snyk — Med is too common on legitimate skills.
    concernRiskLevels: ["HIGH", "CRITICAL"],
  },
} as const;

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtRiskLevel(level: string | null | undefined): string {
  if (!level) return "No data";
  const map: Record<string, string> = {
    NONE: "Safe",
    LOW: "Low risk",
    MEDIUM: "Med risk",
    HIGH: "High risk",
    CRITICAL: "Critical",
  };
  return map[level.toUpperCase()] ?? level;
}

// ─── adapter ─────────────────────────────────────────────────────────────────

/** Maps provider_slug values from the DB to the three expected keys. */
const PROVIDER_MAP: Record<string, keyof SkillAuditInput> = {
  "agent-trust-hub": "gen",
  "socket":          "socket",
  "snyk":            "snyk",
};

/**
 * Converts a flat array of SkillAuditRow (from the DB) into the SkillAuditInput
 * shape expected by getSkillTrust.  Import-cycle-safe: accepts a structurally
 * compatible type rather than importing SkillAuditRow directly.
 */
export function auditRowsToInput(
  rows: { provider_slug: string; status: string; risk_level: string | null; summary?: string | null }[]
): SkillAuditInput {
  const input: SkillAuditInput = {};
  for (const row of rows) {
    const key = PROVIDER_MAP[row.provider_slug];
    if (!key) continue;
    if (key === "socket") {
      input.socket = { riskLevel: row.risk_level, status: row.status, summary: row.summary ?? null };
    } else {
      input[key] = { riskLevel: row.risk_level, status: row.status };
    }
  }
  return input;
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function getSkillTrust(audits: SkillAuditInput): SkillTrust {
  const { gen, socket, snyk } = audits;

  const genConcern =
    gen != null &&
    gen.riskLevel != null &&
    (TRUST_CONFIG.gen.concernRiskLevels as readonly string[]).includes(
      gen.riskLevel.toUpperCase()
    );

  const socketConcern =
    socket != null &&
    (TRUST_CONFIG.socket.concernStatuses as readonly string[]).includes(
      socket.status
    );

  const snykConcern =
    snyk != null &&
    snyk.riskLevel != null &&
    (TRUST_CONFIG.snyk.concernRiskLevels as readonly string[]).includes(
      snyk.riskLevel.toUpperCase()
    );

  const anyPending = gen == null || socket == null || snyk == null;

  // Precedence: flagged > pending > verified
  let status: SkillTrustStatus;
  if (genConcern || socketConcern || snykConcern) {
    status = "flagged";
  } else if (anyPending) {
    status = "pending";
  } else {
    status = "verified";
  }

  const reasons: string[] = [];
  if (genConcern) reasons.push("Flagged for behavioral risk by Gen Agent Trust Hub");
  if (socketConcern) reasons.push("Socket detected code alerts");
  if (snykConcern) reasons.push("Snyk found a high-severity vulnerability");

  return {
    status,
    reasons,
    checks: {
      gen: {
        present: gen != null,
        concern: genConcern,
        subtext: gen ? fmtRiskLevel(gen.riskLevel) : "Pending",
      },
      socket: {
        present: socket != null,
        concern: socketConcern,
        subtext: socket
          ? (socket.summary ?? (socketConcern ? "Alerts detected" : "0 alerts"))
          : "Pending",
      },
      snyk: {
        present: snyk != null,
        concern: snykConcern,
        subtext: snyk ? fmtRiskLevel(snyk.riskLevel) : "Pending",
      },
    },
  };
}
