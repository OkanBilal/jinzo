import { SquareSpinner } from "./square-spinner";
import { DownloadSpinner } from "./download-spinner";
import { GenerateSpinner } from "./generate-spinner";

export type AsciiSpinnerVariant =
  | "claude"
  | "copilot"
  | "codex"
  | "cursor"
  | "null";

/** Spinner shape. `square` is the diagonal grid; `download` is the falling-bar
 *  stream for "downloading…" affordances (e.g. CLI self-update buttons);
 *  `generate` is the randomly twinkling grid for "generating…" affordances. */
export type AsciiSpinnerKind = "square" | "download" | "generate";

const VARIANT_COLOR: Record<AsciiSpinnerVariant, string> = {
  claude: "text-claude",
  copilot: "text-copilot",
  codex: "text-codex",
  cursor: "text-cursor",
  null: "text-primary-900 dark:text-primary-200",
};

/**
 * Compact loading indicator tinted per provider variant. `kind` selects the
 * shape — the diagonal square-grid (`square`, default) or the falling-bar
 * download stream (`download`). Wrapped in an inline-flex shell so it sits
 * cleanly both inline with text (e.g. "⬚ Downloading…") and inside flex rows
 * (buttons, toasts, run tabs). Color flows to the shape via `currentColor`.
 */
export function AsciiSpinner({
  variant,
  kind = "square",
  className,
}: {
  variant?: AsciiSpinnerVariant;
  kind?: AsciiSpinnerKind;
  className?: string;
}) {
  const Spinner =
    kind === "download"
      ? DownloadSpinner
      : kind === "generate"
        ? GenerateSpinner
        : SquareSpinner;
  return (
    <span
      className={`inline-flex items-center align-middle ${VARIANT_COLOR[variant ?? "null"]}`}
    >
      <Spinner className={className ?? "size-3"} />
    </span>
  );
}
