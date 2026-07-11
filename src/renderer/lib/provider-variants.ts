// ─────────────────────────────────────────────────────────────
// Provider-variant descriptor
//
// One table answering "what does provider-variant X look like and support?"
// so components and hooks read fields instead of re-deriving the answer with
// scattered `variant === "..."` ternaries. See CONTEXT.md "Provider variants".
//
// Renderer-only: the main-process drivers read the same config keys but never
// branch on variant (each driver only handles its own provider), so the table
// lives where the branching pain is. The config-key fields below are the
// renderer's half of a contract shared with the drivers — keep them in sync
// with what each driver reads (claude/copilot: permissionMode; codex:
// sandboxMode, modelReasoningEffort, serviceTier; cursor: mode).
// ─────────────────────────────────────────────────────────────

import type { ComponentType } from "react";
import { CopilotStatic, Codex, Cursor } from "@/components/ui/icons";
import { Claude } from "@/components/ui/icons/space";
import { PROVIDER_IDS, type ProviderId } from "../../shared/provider-ids";

export type ProviderVariant = "claude" | "copilot" | "codex" | "cursor";

/** Variant of the surface the user is on: a provider variant on `/code`, "default" elsewhere. */
export type WorkspaceVariant = ProviderVariant | "default";

/**
 * How a variant stores its "fast mode" toggle. Codex maps it to the "fast"
 * service tier (and accepts the legacy "priority" id); the others use a plain
 * boolean.
 */
export type FastModeStyle =
  | { kind: "boolean"; key: "fastMode" }
  | { kind: "serviceTier"; key: "serviceTier"; on: string; match: string[] };

/**
 * Config write performed when the user leaves plan mode: set `key` (currently
 * holding `planValue`) to `nextValue`. Note codex uses a dedicated `planMode`
 * boolean here, distinct from its `permissionKey` (`sandboxMode`).
 */
export interface PlanExitConfig {
  key: string;
  planValue: string | boolean;
  nextValue: string | boolean;
}

export interface ProviderVariantDescriptor {
  variant: ProviderVariant;
  providerId: ProviderId;
  /** Human-facing name ("Claude", "Copilot", …) — the one source for tab/page/picker labels. */
  label: string;
  /** Tab/header icon for this variant. */
  icon: ComponentType<{ className?: string }>;
  /** Accent class always applied to this variant's icon (e.g. Claude's tint). */
  accentClassName?: string;

  // ── config-key contract (renderer reads/writes; mirrors the drivers' reads) ──
  /** Config key holding the permission/sandbox mode. */
  permissionKey: string;
  /** Default permission mode when the config key is unset. */
  permissionDefault: string;
  /** Config key holding the effort level. */
  effortKey: "modelReasoningEffort" | "effortLevel";
  /**
   * When true, "thinking on" is inferred from the presence of an effort value
   * (no separate `thinkingMode` boolean), and an effort change writes only
   * `effortKey`. When false, thinking is its own `thinkingMode` boolean.
   */
  thinkingCoupledToEffort: boolean;
  fastMode: FastModeStyle;

  // ── capability flags (drive UI gates and behavior) ──
  supportsUltracode: boolean;
  supportsPlanMode: boolean;
  supportsGoalMode: boolean;
  supportsSkills: boolean;
  /** Whether the provider's driver implements the plugin API (gates the Plugins page). */
  supportsPlugins: boolean;

  // ── /code page wiring (was per-route props before the agent routes unified) ──
  planExit: PlanExitConfig;
  enableForkRun: boolean;
  enableSuggestions: boolean;
}

export const PROVIDER_VARIANTS: Record<ProviderVariant, ProviderVariantDescriptor> = {
  claude: {
    variant: "claude",
    label: "Claude",
    providerId: PROVIDER_IDS.claude,
    icon: Claude,
    accentClassName: "text-claude",
    permissionKey: "permissionMode",
    permissionDefault: "default",
    effortKey: "effortLevel",
    thinkingCoupledToEffort: false,
    fastMode: { kind: "boolean", key: "fastMode" },
    supportsUltracode: true,
    supportsPlanMode: false,
    supportsGoalMode: false,
    supportsSkills: true,
    supportsPlugins: true,
    planExit: { key: "permissionMode", planValue: "plan", nextValue: "acceptEdits" },
    enableForkRun: true,
    enableSuggestions: true,
  },
  copilot: {
    variant: "copilot",
    label: "Copilot",
    providerId: PROVIDER_IDS.copilot,
    icon: CopilotStatic,
    permissionKey: "permissionMode",
    permissionDefault: "default",
    effortKey: "modelReasoningEffort",
    thinkingCoupledToEffort: true,
    fastMode: { kind: "boolean", key: "fastMode" },
    supportsUltracode: false,
    supportsPlanMode: false,
    supportsGoalMode: false,
    supportsSkills: false,
    supportsPlugins: false,
    planExit: { key: "permissionMode", planValue: "plan", nextValue: "acceptEdits" },
    enableForkRun: false,
    enableSuggestions: false,
  },
  codex: {
    variant: "codex",
    label: "Codex",
    providerId: PROVIDER_IDS.codex,
    icon: Codex,
    permissionKey: "sandboxMode",
    permissionDefault: "workspace-write",
    effortKey: "modelReasoningEffort",
    thinkingCoupledToEffort: true,
    fastMode: { kind: "serviceTier", key: "serviceTier", on: "fast", match: ["fast", "priority"] },
    supportsUltracode: false,
    supportsPlanMode: true,
    supportsGoalMode: true,
    supportsSkills: true,
    supportsPlugins: true,
    planExit: { key: "planMode", planValue: true, nextValue: false },
    enableForkRun: true,
    enableSuggestions: false,
  },
  cursor: {
    variant: "cursor",
    label: "Cursor",
    providerId: PROVIDER_IDS.cursor,
    icon: Cursor,
    permissionKey: "mode",
    permissionDefault: "agent",
    effortKey: "effortLevel",
    thinkingCoupledToEffort: false,
    fastMode: { kind: "boolean", key: "fastMode" },
    supportsUltracode: false,
    supportsPlanMode: false,
    supportsGoalMode: false,
    supportsSkills: false,
    supportsPlugins: false,
    planExit: { key: "mode", planValue: "plan", nextValue: "agent" },
    enableForkRun: true,
    enableSuggestions: true,
  },
};

export function getProviderVariant(variant: ProviderVariant): ProviderVariantDescriptor {
  return PROVIDER_VARIANTS[variant];
}

/**
 * Reverse lookup for callers that hold a provider id (pulse pickers, stats
 * filters) rather than a variant. Undefined for non-agent provider ids.
 */
export function getProviderVariantById(
  providerId: string,
): ProviderVariantDescriptor | undefined {
  return Object.values(PROVIDER_VARIANTS).find(
    (d) => d.providerId === providerId,
  );
}
