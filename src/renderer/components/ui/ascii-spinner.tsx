import { useEffect, useReducer } from "react";

const BREATHING_FRAMES = [
  "⠀",
  "⠁",
  "⠃",
  "⠇",
  "⠏",
  "⠟",
  "⠿",
  "⣿",
  "⣿",
  "⠿",
  "⠟",
  "⠏",
  "⠇",
  "⠃",
  "⠁",
  "⠀",
];

export type AsciiSpinnerVariant =
  | "claude"
  | "copilot"
  | "codex"
  | "cursor"
  | "null";

export function AsciiSpinner({
  variant,
}: {
  variant?: AsciiSpinnerVariant;
}) {
  const [frameIndex, dispatch] = useReducer(
    (i: number) => (i + 1) % BREATHING_FRAMES.length,
    0,
  );

  useEffect(() => {
    const id = setInterval(dispatch, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className={`font-mono text-xs leading-none ${variant === "claude" ? "text-claude" : variant === "copilot" ? "text-copilot" : variant === "codex" ? "text-codex" : variant === "cursor" ? "text-cursor" : "text-primary-900 dark:text-primary-200"}`}
    >
      {BREATHING_FRAMES[frameIndex]}
    </span>
  );
}
