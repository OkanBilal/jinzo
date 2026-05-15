// ─────────────────────────────────────────────────────────────
// Pure-function tests for copilot.driver.
//
// The Copilot SDK is loaded via dynamic import and not exercised here —
// integration tests would require the actual @github/copilot-sdk package.
// These tests cover the deterministic outcome-classifier that translates
// (error / abort / timeout / result text) into a DriverOutcome.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { classifyOutcome } from "./copilot.driver";

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
