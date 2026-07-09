import { useState } from "react";
import { Task } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse, ToolOutputBody } from "./_shared";

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
          <ToolOutputBody as="div" className="text-sm whitespace-pre-wrap">
            {params.prompt}
          </ToolOutputBody>
        </ToolCollapse>
      )}
    </div>
  );
}
