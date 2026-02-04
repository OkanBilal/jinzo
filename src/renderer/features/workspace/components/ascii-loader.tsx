import { useEffect, useState } from "react";

const ASCII_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export const LOADER_WORDS = [
  "Brewing",
  "Steeping",
  "Blooming",
  "Infusing",
  "Settling",
  "Pouring",
  "Warming",
  "Stirring",
  "Slow-thinking",
  "Daydreaming",
  "Wandering",
  "Drift-sorting",
  "Quieting",
];

export function AsciiLoader({ className }: { className?: string }) {
  const [frameIndex, setFrameIndex] = useState(0);
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
      <span className="text-[#D97757] font-mono text-base">
        {ASCII_FRAMES[frameIndex]}
      </span>
      <span className="shine-text text-sm">{word}...</span>
    </div>
  );
}
