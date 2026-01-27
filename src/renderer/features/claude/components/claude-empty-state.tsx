import { useClaudeAnimation } from "@/features/workspace";

export function ClaudeEmptyState() {
  const { symbol, word } = useClaudeAnimation(true);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* <ClaudeIcon
            className="mb-2 text-primary-300 dark:text-primary-800"
            size={80}
            animate
          />
          <p className=" font-medium text-primary-300 dark:text-primary-800 mb-2 font-mono tracking-tight">
            Hi! How can I help you today?
          </p> */}
      <div className="flex items-center gap-2 font-medium font-mono tracking-tight">
        <span
          id="symbol"
          className="text-[#da9779] text-2xl leading-6 h-6 text-center"
        >
          {symbol}
        </span>
        <span id="word" className="text-[#da9779] text-2xl leading-6 h-6 ">
          {word}…
        </span>
      </div>
    </div>
  );
}
