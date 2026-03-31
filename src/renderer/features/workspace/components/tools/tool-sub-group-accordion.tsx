import { useState } from "react";
import { ArrowUp } from "@/components/ui/icons";
import { getToolInfo } from "../../utils/tool-categories";
import type { ToolSubGroup } from "../../utils/group-tool-calls";
import { ToolCallItem } from "./tool-call-item";

interface ToolSubGroupAccordionProps {
  subGroup: ToolSubGroup;
}

export function ToolSubGroupAccordion({ subGroup }: ToolSubGroupAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { icon } = getToolInfo(subGroup.toolType);

  // If only one event, render directly without accordion - show full details
  if (subGroup.events.length === 1) {
    return <ToolCallItem event={subGroup.events[0]} isCompact={false} />;
  }

  return (
    <div className="rounded overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-0.5 px-2 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans cursor-pointer"
      >
        <ArrowUp
          className={`size-3 text-primary-800  dark:text-primary-300 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        <span className="dark:text-primary-300 shrink-0">{icon}</span>
        <span className="dark:text-primary-300 font-medium shrink-0">
          {subGroup.toolType}
        </span>
        <span className="text-primary-400 text-xs">
          ({subGroup.events.length})
        </span>
      </button>

      {isExpanded && (
        <div className="ml-4 border-l border-primary-200/50 dark:border-primary-700/30 pl-2 space-y-0.5">
          {subGroup.events.map((event) => (
            <ToolCallItem key={event.id} event={event} isCompact={true} />
          ))}
        </div>
      )}
    </div>
  );
}
