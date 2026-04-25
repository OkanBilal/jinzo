import { useState } from "react";
import { ArrowUp, Notes } from "@/components/ui/icons";

export interface IntentParams {
  intent?: string;
}

export function IntentDisplay({ params, isCompact = false }: { params: IntentParams; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasIntent = !!params.intent;

  return (
    <div className="">
      <button
        onClick={() => hasIntent && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-primary-400 dark:text-primary-500 text-s font-sans ${hasIntent ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && <Notes className="size-4 text-primary-400 dark:text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary" />}
        {!isCompact && (
          <span className="text-primary-400 dark:text-primary-500 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            Intent
          </span>
        )}
        <span className="text-primary-400 dark:text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {params.intent || "Unknown intent"}
        </span>
        {hasIntent && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-400 dark:text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasIntent && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className=" ">
              <div className="noscrollbar text-s text-primary-600 dark:text-primary-400 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
                {params.intent}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
