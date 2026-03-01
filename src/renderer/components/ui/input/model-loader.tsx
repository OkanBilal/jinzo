import { useEffect, useReducer } from "react";

const ASCII_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const MODEL_LOADER_WORDS = [
  "Models are waking up",
  "Summoning the matrix",
  "Aligning the vectors",
  "Tuning the neurons",
  "Warming up the weights",
  "Calibrating the layers",
  "Optimizing the attention",
  "Feeding the tokens",
  "Activating the transformers",
  "Booting up the model",

];

type LoaderState = { frameIndex: number; wordIndex: number };

function loaderReducer(state: LoaderState): LoaderState {
  const nextFrame = (state.frameIndex + 1) % ASCII_FRAMES.length;
  // Cycle word every full spinner rotation
  if (nextFrame === 0) {
    return {
      frameIndex: nextFrame,
      wordIndex: (state.wordIndex + 1) % MODEL_LOADER_WORDS.length,
    };
  }
  return { ...state, frameIndex: nextFrame };
}

export function ModelLoader({
  variant = "default",
}: {
  variant?: "claude" | "copilot" | "default";
}) {
  const [state, dispatch] = useReducer(loaderReducer, {
    frameIndex: 0,
    wordIndex: Math.floor(Math.random() * MODEL_LOADER_WORDS.length),
  });

  useEffect(() => {
    const id = setInterval(() => dispatch(), 100);
    return () => clearInterval(id);
  }, []);

  const spinnerColor =
    variant === "claude"
      ? "text-claude-dark dark:text-claude-light"
      : variant === "copilot"
        ? "text-copilot-blue dark:text-copilot-light"
        : "text-primary-600 dark:text-primary-400";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`font-mono text-sm ${variant === "claude" ? "text-[#D97757]" : "text-[#4361c2]"}`}>
        {ASCII_FRAMES[state.frameIndex]}
      </span>
      <span className="shine-text text-sm">
        {MODEL_LOADER_WORDS[state.wordIndex]}...
      </span>
    </span>
  );
}
