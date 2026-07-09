import type { FindingSeverity } from "@/lib/redux/api";

/**
 * Presentation for the review-finding severity taxonomy (critical / warning /
 * info) in the three forms the UI needs: inline text accents for dots and
 * counters, tinted chips for badges, and raw hex for the @pierre/diffs
 * annotation layer (which renders outside Tailwind's reach). The diff
 * added/removed accents live here too so every diff surface stays in sync.
 */

export function asFindingSeverity(s: string): FindingSeverity {
  if (s === "critical" || s === "warning" || s === "info") return s;
  return "info";
}

/** Inline text accents for severity dots/counters. */
export const SEVERITY_TEXT: Record<FindingSeverity, string> = {
  critical: "text-red-500 dark:text-red-400",
  warning: "text-yellow-400",
  info: "text-blue-500",
};

/** Tinted chip (bg + text) for severity badges on finding cards. */
export const SEVERITY_TINT: Record<FindingSeverity, string> = {
  critical: "bg-red-500/10 text-red-400",
  warning: "bg-yellow-500/10 text-yellow-400",
  info: "bg-blue-500/10 text-blue-400",
};

export interface SeverityHex {
  pill: string;
  pillBg: string;
  line: string;
}

export const SEVERITY_HEX_LIGHT: Record<FindingSeverity, SeverityHex> = {
  critical: { pill: "#dc2626", pillBg: "#ef444426", line: "#ef444414" },
  warning: { pill: "#d97706", pillBg: "#f59e0b26", line: "#f59e0b14" },
  info: { pill: "#2563eb", pillBg: "#3b82f626", line: "#3b82f60f" },
};

export const SEVERITY_HEX_DARK: Record<FindingSeverity, SeverityHex> = {
  critical: { pill: "#f44336", pillBg: "#f4433633", line: "#1a1a1a" },
  warning: { pill: "#fcd34d", pillBg: "#f59e0b33", line: "#1a1a1a" },
  info: { pill: "#93c5fd", pillBg: "#3b82f633", line: "#1a1a1a" },
};

/** Diff insertion/deletion accents shared by every diff summary surface. */
export const DIFF_ADDED_TEXT = "text-green-600 dark:text-green-400";
export const DIFF_REMOVED_TEXT = "text-red-500 dark:text-red-400";
