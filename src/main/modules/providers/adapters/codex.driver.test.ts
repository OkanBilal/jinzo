// ─────────────────────────────────────────────────────────────
// Pure-function tests for codex.driver.
//
// The Codex SDK (`codex app-server` subprocess) is not exercised here —
// integration tests would require the real CLI. These tests cover the
// deterministic helpers that translate codex-specific shapes into
// canonical/Mains formats.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  buildCollaborationMode,
  mapRateLimitSnapshot,
  mapSandboxMode,
  parseCodexReviewFindings,
  relativizeGoalMentions,
} from "./codex.driver";

describe("codex.driver / relativizeGoalMentions", () => {
  const root = "/Users/me/Library/Application Support/mains/worktrees/x/coconut";

  it("rewrites an @<abs path> mention under the root as relative", () => {
    expect(
      relativizeGoalMentions(`refactor @${root}/src/renderer/hooks/use-dark-mode.ts`, root),
    ).toBe("refactor @src/renderer/hooks/use-dark-mode.ts");
  });

  it("leaves mentions outside the workspace root untouched", () => {
    expect(relativizeGoalMentions("see @/etc/hosts now", root)).toBe("see @/etc/hosts now");
  });

  it("handles a trailing-slash root and multiple mentions", () => {
    expect(
      relativizeGoalMentions(`@${root}/a.ts and @${root}/b/c.ts`, root + "/"),
    ).toBe("@a.ts and @b/c.ts");
  });

  it("is a no-op without a root or goal", () => {
    expect(relativizeGoalMentions("@/abs/x.ts", undefined)).toBe("@/abs/x.ts");
    expect(relativizeGoalMentions("", root)).toBe("");
  });
});

describe("codex.driver / mapSandboxMode", () => {
  it("preserves valid sandbox modes", () => {
    expect(mapSandboxMode("read-only")).toBe("read-only");
    expect(mapSandboxMode("workspace-write")).toBe("workspace-write");
    expect(mapSandboxMode("danger-full-access")).toBe("danger-full-access");
  });

  it('defaults to "workspace-write" for unknown / undefined modes', () => {
    expect(mapSandboxMode(undefined)).toBe("workspace-write");
    expect(mapSandboxMode("")).toBe("workspace-write");
    expect(mapSandboxMode("invalid")).toBe("workspace-write");
    expect(mapSandboxMode("READ-ONLY")).toBe("workspace-write"); // case-sensitive
  });
});

describe("codex.driver / mapRateLimitSnapshot", () => {
  it("returns null for a missing snapshot", () => {
    expect(mapRateLimitSnapshot(undefined)).toBeNull();
  });

  it("maps the RateLimitSnapshot wire shape into RateLimitInfo", () => {
    // Mirrors the Codex `account/rateLimits/{read,updated}` payload
    // (RateLimitSnapshot — identical for the pull and push paths).
    const snapshot = {
      limitId: "codex",
      limitName: "Codex",
      planType: "pro",
      primary: { usedPercent: 42, windowDurationMins: 300, resetsAt: 1717200000 },
      secondary: { usedPercent: 8, windowDurationMins: 10080, resetsAt: 1717800000 },
      credits: { hasCredits: true, balance: "12.50", unlimited: false },
      rateLimitReachedType: null,
    };

    expect(mapRateLimitSnapshot(snapshot)).toEqual({
      planType: "pro",
      primary: { usedPercent: 42, windowDurationMins: 300, resetsAt: 1717200000 },
      secondary: { usedPercent: 8, windowDurationMins: 10080, resetsAt: 1717800000 },
      credits: { hasCredits: true, balance: "12.50", unlimited: false },
    });
  });

  it("omits absent window/credit sub-objects", () => {
    const result = mapRateLimitSnapshot({
      planType: "free",
      primary: { usedPercent: 5 },
    });
    expect(result).toEqual({
      planType: "free",
      primary: { usedPercent: 5, windowDurationMins: undefined, resetsAt: undefined },
      secondary: undefined,
      credits: undefined,
    });
  });
});

describe("codex.driver / buildCollaborationMode", () => {
  describe("plan disabled, no force reset", () => {
    it("returns undefined when plan is off and forceReset is false", () => {
      expect(buildCollaborationMode(false, "gpt-5", "medium", false)).toBeUndefined();
      expect(buildCollaborationMode(false, undefined, undefined, false)).toBeUndefined();
    });
  });

  describe("plan enabled (new thread, forceReset=false)", () => {
    it('emits mode="plan" with model + medium default effort', () => {
      expect(buildCollaborationMode(true, "gpt-5.4", undefined)).toEqual({
        mode: "plan",
        settings: {
          model: "gpt-5.4",
          reasoning_effort: "medium",
          developer_instructions: null,
        },
      });
    });

    it("forwards explicit effort when provided", () => {
      expect(buildCollaborationMode(true, "gpt-5.4", "high")).toEqual({
        mode: "plan",
        settings: {
          model: "gpt-5.4",
          reasoning_effort: "high",
          developer_instructions: null,
        },
      });
    });

    it("uses empty string when model is missing", () => {
      const result = buildCollaborationMode(true, undefined, "low");
      expect(result?.settings).toMatchObject({ model: "" });
    });
  });

  describe("plan disabled, forceReset=true (continue/fork)", () => {
    it('emits mode="default" to clear stuck plan state', () => {
      expect(buildCollaborationMode(false, "gpt-5.4", "high", true)).toEqual({
        mode: "default",
        settings: {
          model: "gpt-5.4",
          reasoning_effort: "high",
          developer_instructions: null,
        },
      });
    });

    it("uses null reasoning_effort when none supplied (plan-off default)", () => {
      const result = buildCollaborationMode(false, "gpt-5.4", undefined, true);
      expect(result?.settings).toMatchObject({ reasoning_effort: null });
    });
  });
});

describe("codex.driver / parseCodexReviewFindings", () => {
  it("returns empty array for empty / non-string input", () => {
    expect(parseCodexReviewFindings("")).toEqual([]);
    expect(parseCodexReviewFindings(null as unknown as string)).toEqual([]);
    expect(parseCodexReviewFindings(undefined as unknown as string)).toEqual([]);
  });

  it("returns empty array when no priority markers found", () => {
    expect(parseCodexReviewFindings("This is just plain review text.")).toEqual([]);
  });

  it("parses a single P1 finding with line range", () => {
    const text = `- [P1] Use of any type — src/foo.ts:42-45
  This bypasses the type system. Replace with a concrete type.`;
    expect(parseCodexReviewFindings(text)).toEqual([
      {
        severity: "critical",
        title: "Use of any type",
        file: "src/foo.ts",
        lineStart: 42,
        lineEnd: 45,
        message: "Use of any type",
        reason: "This bypasses the type system. Replace with a concrete type.",
      },
    ]);
  });

  it("maps P1/P2/P3 to critical/warning/info", () => {
    const text = `- [P1] Critical issue — file.ts:1
  Critical desc

- [P2] Warning issue — file.ts:5
  Warning desc

- [P3] Info issue — file.ts:10
  Info desc`;
    const findings = parseCodexReviewFindings(text);
    expect(findings).toHaveLength(3);
    expect(findings[0].severity).toBe("critical");
    expect(findings[1].severity).toBe("warning");
    expect(findings[2].severity).toBe("info");
  });

  it("handles single-line ranges (lineEnd undefined)", () => {
    const text = `- [P2] Single line — src/x.ts:7
  Body`;
    const findings = parseCodexReviewFindings(text);
    expect(findings[0].lineStart).toBe(7);
    expect(findings[0].lineEnd).toBeUndefined();
  });

  it("handles findings with no line numbers", () => {
    const text = `- [P3] No location — src/x.ts
  General feedback`;
    const findings = parseCodexReviewFindings(text);
    expect(findings).toHaveLength(1);
    expect(findings[0].lineStart).toBeUndefined();
    expect(findings[0].lineEnd).toBeUndefined();
    expect(findings[0].file).toBe("src/x.ts");
  });

  it("falls back to title when body is empty", () => {
    const text = `- [P2] Just a title — file.ts:1
`;
    const findings = parseCodexReviewFindings(text);
    expect(findings[0].reason).toBe("Just a title");
  });

  it("skips malformed finding blocks but parses surrounding ones", () => {
    const text = `- [P1] Good finding — file.ts:1
  Good desc

- [P2] Malformed (no separator)

- [P3] Another good one — file.ts:5
  Another desc`;
    const findings = parseCodexReviewFindings(text);
    // Malformed in the middle shouldn't crash parsing of the others
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].file).toBe("file.ts");
  });
});
