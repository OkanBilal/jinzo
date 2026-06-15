import { SquareSpinner } from "./square-spinner";

export type AsciiSpinnerVariant =
  | "claude"
  | "copilot"
  | "codex"
  | "cursor"
  | "null";

const VARIANT_COLOR: Record<AsciiSpinnerVariant, string> = {
  claude: "text-claude",
  copilot: "text-copilot",
  codex: "text-codex",
  cursor: "text-cursor",
  null: "text-primary-900 dark:text-primary-200",
};

/**
 * Compact loading indicator (the diagonal square-grid `SquareSpinner`) tinted
 * per provider variant. Wrapped in an inline-flex shell so it sits cleanly both
 * inline with text (e.g. "⬚ Downloading…") and inside flex rows (buttons,
 * toasts, run tabs). Color flows to the squares via `currentColor`.
 */
export function AsciiSpinner({
  variant,
  className,
}: {
  variant?: AsciiSpinnerVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center align-middle ${VARIANT_COLOR[variant ?? "null"]}`}
    >
      <SquareSpinner className={className ?? "size-3"} />
    </span>
  );
}
