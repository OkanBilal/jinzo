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
  const hasPlan = !!plan;

  return (
    <div className="">
      <button
        onClick={() => hasPlan && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-primary-400 dark:text-primary-500 text-s font-sans ${hasPlan ? "cursor-pointer" : "cursor-default"}`}
      >
        <ExitPlan className="size-4 text-primary-400 dark:text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary" />
        <span className="text-primary-400 dark:text-primary-500 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
          Plan
        </span>
        <span className="text-primary-400 dark:text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {charCount > 0 ? `(${charCount} chars)` : "No plan content"}
        </span>
        {hasPlan && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-400 dark:text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasPlan && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className=" ">
              <div className="noscrollbar text-sm text-primary-600 dark:text-primary-400 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-3 max-h-80 overflow-y-auto">
                {plan}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
