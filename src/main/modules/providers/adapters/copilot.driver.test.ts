// ─────────────────────────────────────────────────────────────
// Pure-function tests for copilot.driver.
//
// The Copilot SDK is loaded via dynamic import and not exercised here —
// integration tests would require the actual @github/copilot-sdk package.
// These tests cover the deterministic outcome-classifier that translates
// (error / abort / timeout / result text) into a DriverOutcome.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  classifyOutcome,
  agentModeForPermission,
  resolveExitPlanDecision,
  isFileEditTool,
  mapCopilotTodos,
  isTodoBookkeepingSql,
  mapCopilotQuota,
} from "./copilot.driver";

const DEFAULT_TIMEOUT = 300_000;

describe("copilot.driver / classifyOutcome", () => {
  describe("success path", () => {
    it("succeeded with finalText when present", () => {
      expect(
        classifyOutcome({
          hasError: false,
          signalAborted: false,
          finalText: "Done refactoring",
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({ status: "succeeded", summary: "Done refactoring" });
    });

    it("succeeded with default summary when finalText is empty", () => {
      expect(
        classifyOutcome({
          hasError: false,
          signalAborted: false,
          finalText: "",
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({ status: "succeeded", summary: "Completed successfully" });
    });
  });

  describe("abort path", () => {
    it("canceled when AbortSignal fired (regardless of error message)", () => {
      expect(
        classifyOutcome({
          hasError: true,
          errorMessage: "any underlying error",
          signalAborted: true,
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({ status: "canceled", summary: "Run was aborted" });
    });

    it('canceled when error message contains "abort" (without signal)', () => {
      expect(
        classifyOutcome({
          hasError: true,
          errorMessage: "Operation was aborted",
          signalAborted: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({ status: "canceled", summary: "Run was aborted" });
    });
  });

  describe("timeout path", () => {
    it('failed with timeout summary when error message includes "timed out"', () => {
      expect(
        classifyOutcome({
          hasError: true,
          errorMessage: "Operation timed out after 300 seconds",
          signalAborted: false,
          timeoutMs: 300_000,
        }),
      ).toEqual({
        status: "failed",
        summary: "Request timed out after 300 seconds.",
      });
    });

    it("failed with timeout summary using timeoutMs / 1000", () => {
      expect(
        classifyOutcome({
          hasError: true,
          errorMessage: "TIMEOUT",
          signalAborted: false,
          timeoutMs: 60_000,
        }),
      ).toEqual({
        status: "failed",
        summary: "Request timed out after 60 seconds.",
      });
    });
  });

  describe("plan mode", () => {
    describe("agentModeForPermission", () => {
      it('maps "plan" to the "plan" agent mode', () => {
        expect(agentModeForPermission("plan")).toBe("plan");
      });

      it("leaves every other permission mode at the session default (undefined)", () => {
        for (const mode of [
          "default",
          "acceptEdits",
          "bypassPermissions",
          "allow",
          "dontAsk",
          undefined,
        ]) {
          expect(agentModeForPermission(mode)).toBeUndefined();
        }
      });
    });

    describe("resolveExitPlanDecision", () => {
      it("approves exiting plan mode with exit_only (stop without implementing)", () => {
        expect(resolveExitPlanDecision()).toEqual({
          approved: true,
          selectedAction: "exit_only",
        });
      });
    });
  });

  describe("mapCopilotTodos (session SQL todos → TodoSummaryBar snapshot)", () => {
    it("maps title + status, normalizing Copilot status strings", () => {
      expect(
        mapCopilotTodos([
          { id: "a", title: "Audit hook", status: "done" },
          { id: "b", title: "Refactor internals", status: "in_progress" },
          { id: "c", title: "Verify consumers", status: "pending" },
        ]),
      ).toEqual([
        { content: "Audit hook", status: "completed" },
        { content: "Refactor internals", status: "in_progress" },
        { content: "Verify consumers", status: "pending" },
      ]);
    });

    it("falls back to description then id for the label, and drops empty rows", () => {
      expect(
        mapCopilotTodos([
          { id: "x", description: "Do the thing" },
          { id: "y" },
          { title: "   " },
        ]),
      ).toEqual([
        { content: "Do the thing", status: "pending" },
        { content: "y", status: "pending" },
      ]);
    });

    it("returns [] for undefined/empty input", () => {
      expect(mapCopilotTodos(undefined)).toEqual([]);
      expect(mapCopilotTodos([])).toEqual([]);
    });
  });

  describe("mapCopilotQuota (account.getQuota → RateLimitInfo)", () => {
    const nowMs = Date.parse("2026-06-17T12:00:00.000Z");
    const firstOfNextMonth = Math.floor(
      new Date(new Date(nowMs).getFullYear(), new Date(nowMs).getMonth() + 1, 1).getTime() / 1000,
    );

    it("maps metered quotas to primary/secondary windows; trusts a real future resetDate", () => {
      const resetIso = "2026-07-01T00:00:00.000Z";
      const result = mapCopilotQuota(
        {
          premium_interactions: {
            remainingPercentage: 70,
            resetDate: resetIso,
            usedRequests: 300,
            entitlementRequests: 1000,
          },
          chat: { remainingPercentage: 100, resetDate: resetIso },
          completions: { isUnlimitedEntitlement: true },
        },
        nowMs,
      );
      expect(result?.primary).toEqual({
        usedPercent: 30,
        resetsAt: Math.floor(Date.parse(resetIso) / 1000),
        label: "Premium requests",
        used: 300,
        total: 1000,
      });
      expect(result?.secondary?.label).toBe("Chat");
      expect(result?.secondary?.usedPercent).toBe(0);
    });

    it("falls back to the 1st of next month when resetDate is the snapshot time (≈ now)", () => {
      const result = mapCopilotQuota(
        {
          premium_interactions: {
            remainingPercentage: 29.4,
            resetDate: "2026-06-17T12:00:00.000Z",
            usedRequests: 1059,
            entitlementRequests: 1500,
          },
        },
        nowMs,
      );
      expect(result?.primary?.usedPercent).toBe(71);
      expect(result?.primary?.resetsAt).toBe(firstOfNextMonth);
      expect(result?.primary?.used).toBe(1059);
      expect(result?.primary?.total).toBe(1500);
    });

    it("skips unlimited entitlements and returns null when none are metered", () => {
      expect(
        mapCopilotQuota({ chat: { isUnlimitedEntitlement: true } }, nowMs),
      ).toBeNull();
      expect(mapCopilotQuota(undefined, nowMs)).toBeNull();
      expect(mapCopilotQuota({}, nowMs)).toBeNull();
    });
  });

  describe("isTodoBookkeepingSql (timeline suppression of todo SQL)", () => {
    it("flags sql that touches the todos / todo_deps tables", () => {
      expect(isTodoBookkeepingSql("sql", { query: "UPDATE todos SET status = 'done' WHERE id = 'x'" })).toBe(true);
      expect(isTodoBookkeepingSql("sql", { query: "SELECT * FROM todo_deps" })).toBe(true);
      expect(isTodoBookkeepingSql("sql", { args: '{"query":"INSERT INTO todos VALUES (1)"}' })).toBe(true);
    });

    it("leaves non-todo sql and non-sql tools visible", () => {
      expect(isTodoBookkeepingSql("sql", { query: "SELECT * FROM users" })).toBe(false);
      expect(isTodoBookkeepingSql("bash", { query: "rm todos" })).toBe(false);
      expect(isTodoBookkeepingSql("sql", {})).toBe(false);
    });
  });

  describe("isFileEditTool (acceptEdits auto-approval scope)", () => {
    it("matches file-creating/modifying tools (case-insensitive)", () => {
      for (const t of ["apply_patch", "Apply_Patch", "write", "edit", "create", "str_replace", "notebookedit"]) {
        expect(isFileEditTool(t)).toBe(true);
      }
    });

    it("does not match read-only, shell, or destructive tools", () => {
      for (const t of ["read", "bash", "grep", "rg", "delete", "sql", "exit_plan_mode"]) {
        expect(isFileEditTool(t)).toBe(false);
      }
    });
  });

  describe("generic failure", () => {
    it("failed with the underlying error message", () => {
      expect(
        classifyOutcome({
          hasError: true,
          errorMessage: "SDK connection lost",
          signalAborted: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({ status: "failed", summary: "SDK connection lost" });
    });

    it("failed with empty summary when no error message provided", () => {
      expect(
        classifyOutcome({
          hasError: true,
          signalAborted: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({ status: "failed", summary: "" });
    });
  });
});
