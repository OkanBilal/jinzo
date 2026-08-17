// ─────────────────────────────────────────────────────────────
// Table-invariant tests for the mode-config descriptor — the UI
// half of a mode; the sibling of provider-variants.test.ts.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { MODE_IDS, DEFAULT_MODE_ID } from "../../shared/modes";
import { MODE_CONFIGS, getModeConfig } from "./mode-config";

describe("MODE_CONFIGS table invariants", () => {
  it("has an entry for every mode id, keyed consistently", () => {
    for (const mode of MODE_IDS) {
      expect(MODE_CONFIGS[mode]).toBeDefined();
      expect(MODE_CONFIGS[mode].mode).toBe(mode);
      expect(MODE_CONFIGS[mode].label.length).toBeGreaterThan(0);
    }
  });

  it("locks developer to the full surface — every flag true", () => {
    const dev = MODE_CONFIGS.developer;
    expect(dev.showGitActions).toBe(true);
    expect(dev.showTerminal).toBe(true);
    expect(dev.showChangesTab).toBe(true);
    expect(dev.showPermissionControls).toBe(true);
    expect(dev.showPlanControls).toBe(true);
    expect(dev.showGoalControls).toBe(true);
  });

  it("hides the git ceremony in work and chat", () => {
    for (const mode of ["work", "chat"] as const) {
      expect(MODE_CONFIGS[mode].showGitActions).toBe(false);
      expect(MODE_CONFIGS[mode].showTerminal).toBe(false);
      expect(MODE_CONFIGS[mode].showChangesTab).toBe(false);
      expect(MODE_CONFIGS[mode].showPermissionControls).toBe(false);
    }
  });

  it("keeps chat free of every composer mode control", () => {
    expect(MODE_CONFIGS.chat.showPlanControls).toBe(false);
    expect(MODE_CONFIGS.chat.showGoalControls).toBe(false);
  });
});

describe("getModeConfig", () => {
  it("resolves valid ids", () => {
    for (const mode of MODE_IDS) {
      expect(getModeConfig(mode)).toBe(MODE_CONFIGS[mode]);
    }
  });

  it("falls back to the default mode for unknown or absent values", () => {
    expect(getModeConfig(null)).toBe(MODE_CONFIGS[DEFAULT_MODE_ID]);
    expect(getModeConfig(undefined)).toBe(MODE_CONFIGS[DEFAULT_MODE_ID]);
    expect(getModeConfig("gaming")).toBe(MODE_CONFIGS[DEFAULT_MODE_ID]);
  });
});
