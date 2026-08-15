import { useEffect, useReducer } from "react";
import { Text } from "@/components/ui";
export { AsciiSpinner } from "@/components/ui/ascii-spinner";

const ASCII_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const LOADER_WORDS = [
  "Thinking",
  "Analyzing",
  "Searching",
  "Processing",
  "Generating",
  "Creating",
  "Evaluating",
  "Researching",
  "Refining",
  "Formulating"

];

type LoaderState = { frameIndex: number; word: string };
type LoaderAction = { type: "tick" } | { type: "newWord" };

function loaderReducer(state: LoaderState, action: LoaderAction): LoaderState {
  switch (action.type) {
    case "tick":
      return {
        ...state,
        frameIndex: (state.frameIndex + 1) % ASCII_FRAMES.length,
      };
    case "newWord":
      return {
        ...state,
        word: LOADER_WORDS[Math.floor(Math.random() * LOADER_WORDS.length)],
      };
  }
}

/** Strip markdown formatting for plain-text display */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")  // **bold**
    .replace(/\*(.+?)\*/g, "$1")       // *italic*
    .replace(/__(.+?)__/g, "$1")       // __bold__
    .replace(/_(.+?)_/g, "$1")         // _italic_
    .replace(/`(.+?)`/g, "$1")         // `code`
    .replace(/^#+\s*/gm, "");          // # headings
}

export function AsciiLoader({
  className,
  thinkingText,
}: {
  className?: string;
  variant?: "claude" | "copilot" | "codex" | "cursor";
  thinkingText?: string;
}) {
  const [state, dispatch] = useReducer(loaderReducer, undefined, () => ({
    frameIndex: 0,
    word: LOADER_WORDS[Math.floor(Math.random() * LOADER_WORDS.length)],
  }));

  useEffect(() => {
    const frameInterval = setInterval(() => dispatch({ type: "tick" }), 80);
    const wordInterval = setInterval(() => dispatch({ type: "newWord" }), 4000);

    return () => {
      clearInterval(frameInterval);
      clearInterval(wordInterval);
    };
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className || ""}`}>

      <Text as="span" size="sm" tone="inherit" className="shine-text truncate max-w-120">
        {thinkingText ? stripMarkdown(thinkingText) : `${state.word}`}
      </Text>
    </div>
  );
}
