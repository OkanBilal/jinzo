import { useState } from "react";
import { ArrowUp, Bot } from "@/components/ui/icons";

export interface AgentParams {
  subagent_type?: string;
  description?: string;
  prompt?: string;
}

export function AgentDisplay({ params }: { params: AgentParams }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="px-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-0.5 hover:bg-primary-100/50 dark:hover:bg-primary-800/20 rounded text-s font-sans cursor-pointer"
      >
        <ArrowUp
          className={`size-3 text-primary-500 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        <Bot className="size-4 dark:text-primary-300 text-primary-700" />
        <span className="dark:text-primary-300 text-primary-700 font-medium">
          Agent
        </span>
        <span className="text-primary-500 truncate">
          {params.description || "Subagent task"}
        </span>
      </button>

      {isExpanded && params.prompt && (
        <div className="mt-2 ml-5 space-y-2 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          <div className="noscrollbar text-sm text-primary-700 dark:text-primary-300 whitespace-pre-wrap bg-primary-100/50 dark:bg-primary-900/50 rounded p-2 max-h-48 overflow-y-auto">
            {params.prompt}
          </div>
        </div>
      )}
    </div>
  );
}
