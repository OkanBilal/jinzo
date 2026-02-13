import { useEffect, useState } from "react";

export function AsciiLoader({
  className,
  variant,
}: {
  className?: string;
  variant?: "claude" | "workspace";
}) {
  const [frameIndex, setFrameIndex] = useState(0);

  const ASCII_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  const LOADER_WORDS = [
    "decomposing",
    "correlating",
    "tracing",
    "evaluating",
    "reframing",
    "projecting",
    "reconciling",
    "normalizing",
    "harmonizing",
    "distilling",
    "aligning",
    "converging",
  ];

  const [word, setWord] = useState(
    () => LOADER_WORDS[Math.floor(Math.random() * LOADER_WORDS.length)],
  );

  useEffect(() => {
    const frameInterval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % ASCII_FRAMES.length);
    }, 80);

    const wordInterval = setInterval(() => {
      setWord(LOADER_WORDS[Math.floor(Math.random() * LOADER_WORDS.length)]);
    }, 3000);

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
        {ASCII_FRAMES[frameIndex]}
      </span>
      <span className="shine-text text-sm">{word}...</span>
    </div>
  );
}
