// ─────────────────────────────────────────────────────────────
// Pure-function tests for cursor.driver.
//
// The cursor SDK (ACP subprocess) is not exercised here — those are
// integration concerns. These tests cover the deterministic helpers that
// translate cursor-specific stop reasons into the canonical DriverOutcome.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { mapStopReasonToOutcome } from "./cursor.driver";

describe("cursor.driver / mapStopReasonToOutcome", () => {
  it('maps "cancelled" to canceled status', () => {
    expect(mapStopReasonToOutcome("cancelled")).toEqual({ status: "canceled" });
  });

  it('maps "refusal" to failed with descriptive summary', () => {
    expect(mapStopReasonToOutcome("refusal")).toEqual({
      status: "failed",
      summary: "Agent refused the request",
    });
  });

  it('maps "max_tokens" to succeeded with truncation summary', () => {
    expect(mapStopReasonToOutcome("max_tokens")).toEqual({
      status: "succeeded",
      summary: "Response truncated (max tokens)",
    });
  });

  it("maps unknown / undefined stop reasons to succeeded", () => {
    expect(mapStopReasonToOutcome(undefined)).toEqual({ status: "succeeded" });
    expect(mapStopReasonToOutcome("end_turn")).toEqual({ status: "succeeded" });
    expect(mapStopReasonToOutcome("anything-else")).toEqual({ status: "succeeded" });
  });
});
