// ─────────────────────────────────────────────────────────────
// Pure-function tests for claude.driver.
//
// The Claude SDK is loaded via dynamic import and not exercised here —
// integration tests would require the actual @anthropic-ai/claude-agent-sdk.
// These tests cover the deterministic outcome classifier that translates
// (stop reason / abort flag / timeout / error) into a DriverOutcome.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { classifyOutcome } from "./claude.driver";

const DEFAULT_TIMEOUT = 6_000_000;

describe("claude.driver / classifyOutcome", () => {
  describe("success path", () => {
    it("succeeded with normal stop reason", () => {
      expect(
        classifyOutcome({
          stopReason: "end_turn",
          aborted: false,
          timedOut: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "succeeded",
        summary: "Completed successfully",
        stopReason: "end_turn",
        usage: undefined,
      });
    });

    it("succeeded when stopReason is null", () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: false,
          timedOut: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "succeeded",
        summary: "Completed successfully",
        stopReason: undefined,
        usage: undefined,
      });
    });

    it("preserves usage on success", () => {
      const usage = { inputTokens: 100, outputTokens: 50, model: "claude-opus" };
      expect(
        classifyOutcome({
          stopReason: "end_turn",
          usage,
          aborted: false,
          timedOut: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }).usage,
      ).toBe(usage);
    });
  });

  describe("refusal", () => {
    it('failed with refusal summary when stop reason is "refusal"', () => {
      expect(
        classifyOutcome({
          stopReason: "refusal",
          aborted: false,
          timedOut: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "failed",
        summary: "The model declined to fulfill this request.",
        stopReason: "refusal",
        usage: undefined,
      });
    });
  });

  describe("abort path", () => {
    it("canceled when AbortSignal fired (no error)", () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: true,
          timedOut: false,
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "canceled",
        summary: "Run was aborted",
        stopReason: undefined,
        usage: undefined,
      });
    });

    it("canceled when AbortSignal fired even with error message", () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: true,
          timedOut: false,
          errorMessage: "AbortError: aborted",
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "canceled",
        summary: "Run was aborted",
        stopReason: undefined,
        usage: undefined,
      });
    });

    it('canceled when error message includes "aborted" without explicit signal', () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: false,
          timedOut: false,
          errorMessage: "Operation was aborted by upstream",
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "canceled",
        summary: "Run was aborted",
        stopReason: undefined,
        usage: undefined,
      });
    });
  });

  describe("timeout path", () => {
    it("failed with timeout summary when timedOut flag set", () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: true, // timeout aborts the controller too
          timedOut: true,
          timeoutMs: 60_000,
        }),
      ).toEqual({
        status: "failed",
        summary: "Request timed out after 60 seconds.",
        stopReason: undefined,
        usage: undefined,
      });
    });

    it('failed with timeout summary when error message includes "timed out"', () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: false,
          timedOut: false,
          errorMessage: "Request timed out after 30000ms",
          timeoutMs: 30_000,
        }),
      ).toEqual({
        status: "failed",
        summary: "Request timed out after 30 seconds.",
        stopReason: undefined,
        usage: undefined,
      });
    });
  });

  describe("generic failure", () => {
    it("failed with the underlying error message", () => {
      expect(
        classifyOutcome({
          stopReason: null,
          aborted: false,
          timedOut: false,
          errorMessage: "SDK connection lost",
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toEqual({
        status: "failed",
        summary: "SDK connection lost",
        stopReason: undefined,
        usage: undefined,
      });
    });

    it("preserves usage on failure", () => {
      const usage = { inputTokens: 100, outputTokens: 50 };
      expect(
        classifyOutcome({
          stopReason: "tool_use",
          usage,
          aborted: false,
          timedOut: false,
          errorMessage: "boom",
          timeoutMs: DEFAULT_TIMEOUT,
        }),
      ).toMatchObject({
        status: "failed",
        summary: "boom",
        stopReason: "tool_use",
        usage,
      });
    });
  });
});
