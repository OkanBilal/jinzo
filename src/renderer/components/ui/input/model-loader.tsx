import { useEffect, useReducer } from "react";

const ASCII_FRAMES = [
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
type LoaderAction = { type: "tick" } | { type: "randomize" };

function loaderReducer(state: LoaderState, action: LoaderAction): LoaderState {
  if (action.type === "randomize") {
    return {
      ...state,
      wordIndex: Math.floor(Math.random() * MODEL_LOADER_WORDS.length),
    };
  }
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

export function ModelLoader() {
  const [state, dispatch] = useReducer(loaderReducer, {
    frameIndex: 0,
    wordIndex: 0,
  });

  useEffect(() => {
    dispatch({ type: "randomize" });
    const id = setInterval(() => dispatch({ type: "tick" }), 100);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-sm text-primary-900 dark:text-primary-400">
        {ASCII_FRAMES[state.frameIndex]}
      </span>
      <span className="shine-text text-sm">Loading models...</span>
    </span>
  );
}
