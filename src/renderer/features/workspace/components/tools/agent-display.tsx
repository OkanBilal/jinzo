import { useState } from "react";
import { Bot } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";

export interface AgentParams {
  subagent_type?: string;
  description?: string;
  prompt?: string;
}

export function AgentDisplay({ params, isCompact = false }: { params: AgentParams; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasPrompt = !!params.prompt;

  return (
    <div>
      <ToolHeader
        icon={<Bot className="size-4" />}
        verb="Ran subagent"
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
          <div className="noscrollbar text-s text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-lg p-3 max-h-48 overflow-y-auto">
            {params.prompt}
          </div>
        </ToolCollapse>
      )}
    </div>
  );
}
