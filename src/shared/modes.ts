/**
 * Canonical mode identifiers — the "experience" a space drives: developer
 * (coding agent), work (knowledge-work agent), chat (plain conversation).
 *
 * A mode decides how the app looks and behaves around the agent (sidebar,
 * right panel, default route, and later: prompt deltas, permission defaults),
 * while `providerId` decides which agent engine runs underneath. The two are
 * deliberately orthogonal — a work space can be driven by any provider.
 *
 * Mirrors `provider-ids.ts`: both renderer and main import from here so the
 * literal lives in one place and typos die at compile time.
 */

export const MODE_IDS = ["developer", "work", "chat"] as const;

export type ModeId = (typeof MODE_IDS)[number];

export const DEFAULT_MODE_ID: ModeId = "developer";

const MODE_ID_SET: ReadonlySet<string> = new Set(MODE_IDS);

export function isModeId(value: unknown): value is ModeId {
  return typeof value === "string" && MODE_ID_SET.has(value);
}
