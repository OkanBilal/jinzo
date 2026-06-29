import { describe, it, expect } from "vitest";
import { PROVIDER_IDS } from "../../../../shared/provider-ids";
import {
  PROVIDER_VARIANTS,
  getProviderVariant,
  type ProviderVariant,
} from "./provider-variants";

const VARIANTS: ProviderVariant[] = ["claude", "copilot", "codex", "cursor"];

describe("provider variant descriptor", () => {
  it("maps each variant to its canonical provider id", () => {
    expect(getProviderVariant("claude").providerId).toBe(PROVIDER_IDS.claude);
    expect(getProviderVariant("copilot").providerId).toBe(PROVIDER_IDS.copilot);
    expect(getProviderVariant("codex").providerId).toBe(PROVIDER_IDS.codex);
    expect(getProviderVariant("cursor").providerId).toBe(PROVIDER_IDS.cursor);
  });

  it("pins the permission config-key contract (must match what the drivers read)", () => {
    expect(getProviderVariant("claude").permissionKey).toBe("permissionMode");
    expect(getProviderVariant("copilot").permissionKey).toBe("permissionMode");
    expect(getProviderVariant("codex").permissionKey).toBe("sandboxMode");
    expect(getProviderVariant("cursor").permissionKey).toBe("mode");
  });

  it("pins the effort key and thinking/effort coupling", () => {
    // Codex/Copilot infer "thinking on" from the reasoning-effort value.
    expect(getProviderVariant("codex").thinkingCoupledToEffort).toBe(true);
    expect(getProviderVariant("copilot").thinkingCoupledToEffort).toBe(true);
    expect(getProviderVariant("claude").thinkingCoupledToEffort).toBe(false);
    expect(getProviderVariant("cursor").thinkingCoupledToEffort).toBe(false);
    expect(getProviderVariant("codex").effortKey).toBe("modelReasoningEffort");
    expect(getProviderVariant("copilot").effortKey).toBe("modelReasoningEffort");
    expect(getProviderVariant("claude").effortKey).toBe("effortLevel");
    expect(getProviderVariant("cursor").effortKey).toBe("effortLevel");
  });

  it("pins fast-mode style: codex uses the service tier, others a boolean", () => {
    expect(getProviderVariant("codex").fastMode).toEqual({
      kind: "serviceTier",
      key: "serviceTier",
      on: "fast",
      match: ["fast", "priority"],
    });
    for (const v of ["claude", "copilot", "cursor"] as const) {
      expect(getProviderVariant(v).fastMode).toEqual({ kind: "boolean", key: "fastMode" });
    }
  });

  it("pins capability flags (ultracode→Claude, plan/goal→Codex)", () => {
    expect(getProviderVariant("claude").supportsUltracode).toBe(true);
    for (const v of ["copilot", "codex", "cursor"] as const) {
      expect(getProviderVariant(v).supportsUltracode).toBe(false);
    }
    expect(getProviderVariant("codex").supportsPlanMode).toBe(true);
    expect(getProviderVariant("codex").supportsGoalMode).toBe(true);
    for (const v of ["claude", "copilot", "cursor"] as const) {
      expect(getProviderVariant(v).supportsPlanMode).toBe(false);
      expect(getProviderVariant(v).supportsGoalMode).toBe(false);
    }
  });

  it("pins skills availability (Claude + Codex only)", () => {
    expect(getProviderVariant("claude").supportsSkills).toBe(true);
    expect(getProviderVariant("codex").supportsSkills).toBe(true);
    expect(getProviderVariant("copilot").supportsSkills).toBe(false);
    expect(getProviderVariant("cursor").supportsSkills).toBe(false);
  });

  it("gives every variant an icon and a self-consistent variant key", () => {
    for (const v of VARIANTS) {
      const d = PROVIDER_VARIANTS[v];
      expect(d.variant).toBe(v);
      expect(typeof d.icon).toBe("function");
    }
  });
});
