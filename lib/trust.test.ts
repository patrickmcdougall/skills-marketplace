import { describe, it, expect } from "vitest";
import { getSkillTrust } from "./trust";

const PASS_GEN    = { riskLevel: "NONE",   status: "pass" };
const HIGH_GEN    = { riskLevel: "HIGH",   status: "fail" };
const CRIT_GEN    = { riskLevel: "CRITICAL", status: "fail" };
const MED_GEN     = { riskLevel: "MEDIUM", status: "warn" };

const PASS_SOCKET = { riskLevel: null, status: "pass",  summary: "0 alerts" };
const WARN_SOCKET = { riskLevel: null, status: "warn",  summary: "2 alerts detected" };
const FAIL_SOCKET = { riskLevel: null, status: "fail",  summary: "Critical alert" };

const LOW_SNYK    = { riskLevel: "LOW",      status: "pass" };
const MED_SNYK    = { riskLevel: "MEDIUM",   status: "warn" };
const HIGH_SNYK   = { riskLevel: "HIGH",     status: "fail" };
const CRIT_SNYK   = { riskLevel: "CRITICAL", status: "fail" };

describe("getSkillTrust", () => {
  describe("verified", () => {
    it("all three pass → verified", () => {
      const t = getSkillTrust({ gen: PASS_GEN, socket: PASS_SOCKET, snyk: LOW_SNYK });
      expect(t.status).toBe("verified");
      expect(t.reasons).toHaveLength(0);
    });

    it("Snyk Med alone → verified (Med is below threshold)", () => {
      const t = getSkillTrust({ gen: PASS_GEN, socket: PASS_SOCKET, snyk: MED_SNYK });
      expect(t.status).toBe("verified");
    });

    it("Gen Med (below threshold) → verified", () => {
      const t = getSkillTrust({ gen: MED_GEN, socket: PASS_SOCKET, snyk: LOW_SNYK });
      expect(t.status).toBe("verified");
    });
  });

  describe("flagged", () => {
    it("Gen High → flagged", () => {
      const t = getSkillTrust({ gen: HIGH_GEN, socket: PASS_SOCKET, snyk: LOW_SNYK });
      expect(t.status).toBe("flagged");
      expect(t.checks.gen.concern).toBe(true);
      expect(t.checks.socket.concern).toBe(false);
      expect(t.checks.snyk.concern).toBe(false);
    });

    it("Gen Critical → flagged", () => {
      const t = getSkillTrust({ gen: CRIT_GEN, socket: PASS_SOCKET, snyk: LOW_SNYK });
      expect(t.status).toBe("flagged");
    });

    it("Socket any alert → flagged", () => {
      const t = getSkillTrust({ gen: PASS_GEN, socket: WARN_SOCKET, snyk: LOW_SNYK });
      expect(t.status).toBe("flagged");
      expect(t.checks.socket.concern).toBe(true);
    });

    it("Socket fail → flagged", () => {
      const t = getSkillTrust({ gen: PASS_GEN, socket: FAIL_SOCKET, snyk: LOW_SNYK });
      expect(t.status).toBe("flagged");
    });

    it("Snyk High → flagged", () => {
      const t = getSkillTrust({ gen: PASS_GEN, socket: PASS_SOCKET, snyk: HIGH_SNYK });
      expect(t.status).toBe("flagged");
      expect(t.checks.snyk.concern).toBe(true);
    });

    it("Snyk Critical → flagged", () => {
      const t = getSkillTrust({ gen: PASS_GEN, socket: PASS_SOCKET, snyk: CRIT_SNYK });
      expect(t.status).toBe("flagged");
    });

    it("Gen Safe + Snyk High → flagged (worst-of-three wins)", () => {
      const t = getSkillTrust({ gen: PASS_GEN, socket: PASS_SOCKET, snyk: HIGH_SNYK });
      expect(t.status).toBe("flagged");
      expect(t.checks.gen.concern).toBe(false);
      expect(t.checks.snyk.concern).toBe(true);
    });

    it("multiple sources flagged → reasons list populated", () => {
      const t = getSkillTrust({ gen: HIGH_GEN, socket: WARN_SOCKET, snyk: HIGH_SNYK });
      expect(t.status).toBe("flagged");
      expect(t.reasons.length).toBeGreaterThan(1);
    });
  });

  describe("pending", () => {
    it("all three missing → pending", () => {
      const t = getSkillTrust({});
      expect(t.status).toBe("pending");
    });

    it("all pass but Socket missing → pending", () => {
      const t = getSkillTrust({ gen: PASS_GEN, snyk: LOW_SNYK });
      expect(t.status).toBe("pending");
      expect(t.checks.socket.present).toBe(false);
      expect(t.checks.socket.subtext).toBe("Pending");
    });

    it("all pass but Gen missing → pending", () => {
      const t = getSkillTrust({ socket: PASS_SOCKET, snyk: LOW_SNYK });
      expect(t.status).toBe("pending");
    });
  });

  describe("checks subtext", () => {
    it("Socket passes → subtext shows summary", () => {
      const t = getSkillTrust({ gen: PASS_GEN, socket: PASS_SOCKET, snyk: LOW_SNYK });
      expect(t.checks.socket.subtext).toBe("0 alerts");
    });

    it("Socket no summary → subtext is 0 alerts", () => {
      const t = getSkillTrust({
        gen: PASS_GEN,
        socket: { riskLevel: null, status: "pass", summary: null },
        snyk: LOW_SNYK,
      });
      expect(t.checks.socket.subtext).toBe("0 alerts");
    });

    it("Snyk Med → subtext is Med risk", () => {
      const t = getSkillTrust({ gen: PASS_GEN, socket: PASS_SOCKET, snyk: MED_SNYK });
      expect(t.checks.snyk.subtext).toBe("Med risk");
    });

    it("Gen High → subtext is High risk", () => {
      const t = getSkillTrust({ gen: HIGH_GEN, socket: PASS_SOCKET, snyk: LOW_SNYK });
      expect(t.checks.gen.subtext).toBe("High risk");
    });
  });
});
