import { useState } from "react";
import { ArrowUp, ExitPlan } from "@/components/ui/icons";

export interface ExitPlanParams {
  plan?: string;
  allowedPrompts?: { tool: string; prompt: string }[];
}

export function ExitPlanDisplay({ params }: { params: ExitPlanParams }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const plan = params.plan || "";
  const charCount = plan.length;

  return (
    <div className="px-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans cursor-pointer"
      >
        <ArrowUp
          className={`size-3 text-primary-800  dark:text-primary-300 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        <ExitPlan className="size-4 dark:text-primary-300 text-primary-700" />
        <span className="dark:text-primary-300 text-primary-700 font-medium">
          Plan
        </span>
        <span className="text-primary-500 truncate">
          {charCount > 0 ? `(${charCount} chars)` : "No plan content"}
        </span>
      </button>

      {isExpanded && plan && (
        <div className="mt-2 ml-5 space-y-2 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          <div className="noscrollbar text-sm text-primary-700 dark:text-primary-300 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-xl p-3 max-h-80 overflow-y-auto">
            {plan}
          </div>
        </div>
      )}
    </div>
  );
}
