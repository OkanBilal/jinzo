// ─────────────────────────────────────────────────────────────
// Table-invariant tests for the mode harness — the same role
// provider-variants.test.ts plays for the variant descriptor.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { MODE_IDS } from "./modes";
import { PROVIDER_IDS } from "./provider-ids";
import {
  MODE_HARNESSES,
  getModeHarness,
  composeExtraInstructions,
  composeConfigSnapshot,
} from "./mode-harness";

describe("MODE_HARNESSES table invariants", () => {
  it("has an entry for every mode id, keyed consistently", () => {
    for (const mode of MODE_IDS) {
      expect(MODE_HARNESSES[mode]).toBeDefined();
      expect(MODE_HARNESSES[mode].mode).toBe(mode);
    }
  });

  it("locks developer to current behavior: no delta, no policy, no config", () => {
    const dev = MODE_HARNESSES.developer;
    expect(dev.promptDelta).toBeNull();
    expect(dev.toolPolicy).toBeNull();
    expect(dev.configDefaults).toEqual({});
    expect(dev.configOverrides).toEqual({});
  });

  it("keeps chat's allowlist free of write tools, Bash, and mains tools", () => {
    const allowed = MODE_HARNESSES.chat.toolPolicy?.allowedTools ?? [];
    for (const tool of ["Bash", "Write", "Edit", "NotebookEdit", "Task"]) {
      expect(allowed).not.toContain(tool);
    }
    expect(allowed.some((t) => t.startsWith("mcp__mains__"))).toBe(false);
  });

  it("denies Bash in work mode while keeping the default allowlist", () => {
    const policy = MODE_HARNESSES.work.toolPolicy;
    expect(policy?.allowedTools).toBeNull();
    expect(policy?.disallowedTools).toContain("Bash");
  });

  it("enforces read-only chat per provider via configOverrides", () => {
    const overrides = MODE_HARNESSES.chat.configOverrides;
    expect(overrides[PROVIDER_IDS.codex]).toEqual({ sandboxMode: "read-only" });
    expect(overrides[PROVIDER_IDS.cursor]).toEqual({ mode: "ask" });
    expect(overrides[PROVIDER_IDS.claude]).toEqual({ permissionMode: "default" });
    expect(overrides[PROVIDER_IDS.copilot]).toEqual({ permissionMode: "default" });
  });

  it("only chat carries overrides — work's settings stay caller-overridable", () => {
    expect(Object.keys(MODE_HARNESSES.developer.configOverrides)).toHaveLength(0);
    expect(Object.keys(MODE_HARNESSES.work.configOverrides)).toHaveLength(0);
    expect(Object.keys(MODE_HARNESSES.chat.configOverrides).length).toBeGreaterThan(0);
  });

  it("resolves unknown or absent modes to developer", () => {
    expect(getModeHarness(undefined)).toBe(MODE_HARNESSES.developer);
    expect(getModeHarness(null)).toBe(MODE_HARNESSES.developer);
    expect(getModeHarness("bogus" as never)).toBe(MODE_HARNESSES.developer);
  });
});

describe("composeExtraInstructions", () => {
  it("returns null for developer with no space prompt", () => {
    expect(composeExtraInstructions("developer")).toBeNull();
    expect(composeExtraInstructions("developer", "   ")).toBeNull();
  });

  it("layers the mode delta before the space prompt", () => {
    const composed = composeExtraInstructions("work", "Always answer in Turkish.");
    expect(composed).toContain("non-technical");
    expect(composed?.endsWith("Always answer in Turkish.")).toBe(true);
    expect(composed?.indexOf("non-technical")).toBeLessThan(
      composed!.indexOf("Always answer in Turkish."),
    );
  });

  it("passes the space prompt through alone for developer", () => {
    expect(composeExtraInstructions("developer", "Be terse.")).toBe("Be terse.");
  });
});

describe("composeConfigSnapshot", () => {
  it("returns null when the mode adds nothing and the payload is empty", () => {
    expect(composeConfigSnapshot("developer", PROVIDER_IDS.codex)).toBeNull();
    expect(composeConfigSnapshot("developer", PROVIDER_IDS.codex, {})).toBeNull();
  });

  it("passes the payload through untouched for developer", () => {
    expect(
      composeConfigSnapshot("developer", PROVIDER_IDS.claude, { permissionMode: "plan" }),
    ).toEqual({ permissionMode: "plan" });
  });

  it("lets the payload beat work's defaults", () => {
    expect(
      composeConfigSnapshot("work", PROVIDER_IDS.claude, { permissionMode: "plan" }),
    ).toEqual({ permissionMode: "plan" });
    expect(composeConfigSnapshot("work", PROVIDER_IDS.claude)).toEqual({
      permissionMode: "acceptEdits",
    });
  });

  it("lets chat's overrides beat the payload — no client can escalate", () => {
    expect(
      composeConfigSnapshot("chat", PROVIDER_IDS.codex, {
        sandboxMode: "danger-full-access",
      }),
    ).toEqual({ sandboxMode: "read-only" });
    expect(
      composeConfigSnapshot("chat", PROVIDER_IDS.claude, {
        permissionMode: "bypassPermissions",
      }),
    ).toEqual({ permissionMode: "default" });
  });

  it("keeps unrelated payload keys alongside mode values", () => {
    expect(
      composeConfigSnapshot("chat", PROVIDER_IDS.codex, { effortLevel: "high" }),
    ).toEqual({ effortLevel: "high", sandboxMode: "read-only" });
  });
});
