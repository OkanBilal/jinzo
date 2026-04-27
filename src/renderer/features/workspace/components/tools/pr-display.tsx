import { useState } from "react";
import { ArrowUp, Mains } from "@/components/ui/icons";

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
    <div className="">
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1  text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && <Mains className="size-3.5 text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary" />}
        {!isCompact && (
          <span className="text-primary-500 dark:text-primary-300 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            PR
          </span>
        )}
        {params.draft && (
          <span className="text-yellow-500 dark:text-yellow-400 text-xs shrink-0">
            draft
          </span>
        )}
        {params.base && (
          <span className="text-primary-500 shrink-0 group-hover:text-primary-950 group-hover:dark:text-primary">
            → {params.base}
          </span>
        )}
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {titleText}
        </span>
        {hasContent && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasContent && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-2">
              {params.labels?.length ? (
                <div className="flex flex-wrap gap-1">
                  {params.labels.map((label) => (
                    <span
                      key={label}
                        className="text-xs font-mono text-primary-950 dark:text-primary bg-primary-50 dark:bg-primary/5 rounded px-1.5 py-0.5"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
              {params.body && (
                <p className="text-s text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2">
                  {params.body}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
