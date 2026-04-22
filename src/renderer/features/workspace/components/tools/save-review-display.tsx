import { useState } from "react";
import { ArrowUp, Mains } from "@/components/ui/icons";

export interface SaveReviewParams {
  title?: string;
  summary?: string;
  status?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
}


export function SaveReviewDisplay({
  params,
  isCompact = false,
}: {
  params: SaveReviewParams;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasSummary = !!params.summary;

  return (
    <div className="px-2">
      <button
        onClick={() => hasSummary && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans ${hasSummary ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasSummary && (
        <ArrowUp
          className={`size-3 text-primary-800  dark:text-primary-300 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        )}
        {!isCompact && <Mains className="w-2 h-4 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            Review
          </span>
        )}

        <span className="text-primary-500 truncate font-medium">
          {params.title || "Untitled review"}
        </span>
      </button>

      {isExpanded && hasSummary && (
        <div className="mt-2 ml-5 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          <p className="text-s text-primary-600 dark:text-primary-400 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded p-2">
            {params.summary}
          </p>
        </div>
      )}
    </div>
  );
}
