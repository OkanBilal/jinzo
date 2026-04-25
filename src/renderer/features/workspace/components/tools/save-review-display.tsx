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
    <div className="">
      <button
        onClick={() => hasSummary && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-primary-400 dark:text-primary-500 text-s font-sans ${hasSummary ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && <Mains className="w-2 h-4 text-primary-400 dark:text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary" />}
        {!isCompact && (
          <span className="text-primary-400 dark:text-primary-500 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            Review
          </span>
        )}

        <span className="text-primary-400 dark:text-primary-500 truncate font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
          {params.title || "Untitled review"}
        </span>
        {hasSummary && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-400 dark:text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasSummary && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className=" ">
              <p className="text-s text-primary-600 dark:text-primary-400 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2">
                {params.summary}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
