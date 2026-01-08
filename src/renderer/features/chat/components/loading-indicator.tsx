import { memo } from "react";

const DOT_DELAYS = [0] as const;

const LoadingIndicator = memo(() => (
  <div
    className="mr-auto inline-flex items-center gap-2 px-4 py-3 "
    role="status"
    aria-label="Loading response"
  >
    {DOT_DELAYS.map((delay) => (
      <span
        key={delay}
        className=" w-3 h-3 rounded-full dark:bg-primary-300 bg-primary-400 animate-bounce"
        style={{ animationDelay: `${delay}ms` }}
        aria-hidden="true"
      />
    ))}
  </div>
));

LoadingIndicator.displayName = "LoadingIndicator";

export { LoadingIndicator };
