import { useState } from "react";
import { ArrowUp, Notes } from "@/components/ui/icons";

export interface IntentParams {
  intent?: string;
}

export function IntentDisplay({ params }: { params: IntentParams }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="px-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans cursor-pointer"
      >
        <ArrowUp
          className={`size-3 text-primary-800  dark:text-primary-300 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        <Notes className="size-4 dark:text-primary-300 text-primary-700" />
        <span className="dark:text-primary-300 text-primary-700 font-medium">
          Intent
        </span>
        <span className="text-primary-500 truncate">
          {params.intent || "Unknown intent"}
        </span>
      </button>

      {isExpanded && params.intent && (
        <div className="mt-2 ml-5 space-y-2 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          <div className="noscrollbar text-s text-primary-700 dark:text-primary-300 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded p-2 max-h-48 overflow-y-auto">
            {params.intent}
          </div>
        </div>
      )}
    </div>
  );
}
