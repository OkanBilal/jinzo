import { useState } from "react";
import { Task } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";

export interface TaskParams {
  description?: string;
  prompt?: string;
  subagent_type?: string;
}

export function TaskDisplay({ params, isCompact = false }: { params: TaskParams; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasPrompt = !!params.prompt;

  return (
    <div>
      <ToolHeader
        icon={<Task className="size-4" />}
        verb="Task"
        hasDetails={hasPrompt}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {params.description || "Subagent task"}
        </span>
      </ToolHeader>

      {hasPrompt && (
        <ToolCollapse isExpanded={isExpanded}>
          <div className="noscrollbar text-sm text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
            {params.prompt}
          </div>
        </ToolCollapse>
      )}
    </div>
  );
}
