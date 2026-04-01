import { useState } from "react";
import { ArrowUp, Jinzo } from "@/components/ui/icons";

export interface PRParams {
  title?: string;
  body?: string;
  base?: string;
  draft?: boolean;
  labels?: string[];
}

export function PRDisplay({
  params,
  isCompact = false,
}: {
  params: PRParams;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasContent = !!params.title || !!params.body;

  const titleText = params.title || "No title";

  return (
    <div className="px-2">
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasContent && (
        <ArrowUp
          className={`size-3 text-primary-800 dark:text-primary-300 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        )}
        {!isCompact && <Jinzo className="size-3.5 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            PR
          </span>
        )}
        {params.draft && (
          <span className="text-yellow-500 dark:text-yellow-400 text-xs shrink-0">
            draft
          </span>
        )}
        {params.base && (
          <span className="text-primary-400 dark:text-primary-500 shrink-0">
            → {params.base}
          </span>
        )}
        <span className="text-primary-500 truncate">
          {titleText}
        </span>
      </button>

      {isExpanded && hasContent && (
        <div className="mt-2 ml-5 border-l border-primary-200/50 dark:border-primary-700/30 pl-3 space-y-2">
          {params.labels?.length ? (
            <div className="flex flex-wrap gap-1">
              {params.labels.map((label) => (
                <span
                  key={label}
                  className="text-xs font-mono text-primary-500 bg-primary-100 dark:bg-primary-800/30 rounded px-1.5 py-0.5"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          {params.body && (
            <p className="text-s text-primary-600 dark:text-primary-400 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded p-2">
              {params.body}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
