import { useState } from "react";
import { ExitPlan } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";

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
    <div>
      <ToolHeader
        icon={<ExitPlan className="size-4" />}
        verb="Plan"
        hasDetails={hasPlan}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
      >
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {charCount > 0 ? `(${charCount} chars)` : "No plan content"}
        </span>
      </ToolHeader>

      {hasPlan && (
        <ToolCollapse isExpanded={isExpanded}>
          <div className="noscrollbar text-sm text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-3 max-h-80 overflow-y-auto">
            {plan}
          </div>
        </ToolCollapse>
      )}
    </div>
  );
}
