import { useEffect, useReducer } from "react";

const ASCII_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const LOADER_WORDS = [
  "Decomposing",
  "Correlating",
  "Tracing",
  "Evaluating",
  "Reframing",
  "Projecting",
  "Reconciling",
  "Normalizing",
  "Harmonizing",
  "Distilling",
  "Aligning",
  "Converging",
];

type LoaderState = { frameIndex: number; word: string };
type LoaderAction = { type: "tick" } | { type: "newWord" };

function loaderReducer(state: LoaderState, action: LoaderAction): LoaderState {
  switch (action.type) {
    case "tick":
      return { ...state, frameIndex: (state.frameIndex + 1) % ASCII_FRAMES.length };
    case "newWord":
      return { ...state, word: LOADER_WORDS[Math.floor(Math.random() * LOADER_WORDS.length)] };
  }
}

// Braille dots ordered by fill density: empty → full → empty (breathing cycle)
const BREATHING_FRAMES = [
  "⠀", "⠁", "⠃", "⠇", "⠏", "⠟", "⠿", "⣿",
  "⣿", "⠿", "⠟", "⠏", "⠇", "⠃", "⠁", "⠀",
];

export function AsciiSpinner({ variant }: { variant?: "claude" | "copilot" }) {
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
      className={`font-mono text-xs leading-none ${variant === "claude" ? "text-[#D97757]" : "text-[#4361c2]"}`}
    >
      {BREATHING_FRAMES[frameIndex]}
    </span>
  );
}

export function AsciiLoader({
  className,
  variant,
}: {
  className?: string;
  variant?: "claude" | "copilot";
}) {
  const [state, dispatch] = useReducer(loaderReducer, undefined, () => ({
    frameIndex: 0,
    word: LOADER_WORDS[Math.floor(Math.random() * LOADER_WORDS.length)],
  }));

  useEffect(() => {
    const frameInterval = setInterval(() => dispatch({ type: "tick" }), 80);
    const wordInterval = setInterval(() => dispatch({ type: "newWord" }), 3000);

    return () => {
      clearInterval(frameInterval);
      clearInterval(wordInterval);
    };
  }, []);

  return (
    <div className={`flex items-center gap-2 py-2 ${className || ""}`}>
      <span
        className={`font-mono text-base ${variant === "claude" ? "text-[#D97757]" : "text-[#4361c2]"}`}
      >
        {ASCII_FRAMES[state.frameIndex]}
      </span>
      <span className="shine-text text-sm">{state.word}...</span>
    </div>
  );
}
