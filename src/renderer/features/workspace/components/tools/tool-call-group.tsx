import { useState } from "react";
import { ArrowUp, Apps } from "@/components/ui/icons";
import { groupConsecutiveToolCalls } from "../../utils/group-tool-calls";
import { ToolSubGroupAccordion } from "./tool-sub-group-accordion";
import type { EventGroup } from "../../utils/group-events";

interface ToolCallGroupProps {
  group: EventGroup;
  defaultExpanded?: boolean;
  variant?: "workspace" | "claude";
}

export function ToolCallGroup({
  group,
  defaultExpanded = false,
}: ToolCallGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toolCount = group.events.length;

  const toolTypes = new Set(
    group.events.map((e) => {
      const colonIdx = e.content.indexOf(":");
      return colonIdx > 0 ? e.content.substring(0, colonIdx).trim() : "Tool";
    }),
  );
  const toolSummary = Array.from(toolTypes).slice(0, 3).join(", ");
  const moreCount = toolTypes.size > 3 ? ` +${toolTypes.size - 3}` : "";

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-1 py-1 cursor-pointer"
      >
        <ArrowUp
          className={`size-3.5 dark:text-primary-200 text-primary-800 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        <div className="flex items-center gap-2 group transition-all duration-200">
          <Apps className="size-4 dark:text-primary-200 text-primary-700 group-hover:text-primary-950 group-hover:dark:text-primary" />
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary">
            {toolCount} tool call{toolCount !== 1 ? "s" : ""}
          </span>
          <span className="text-xs dark:text-primary-400 text-primary-700 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
            ({toolSummary}
            {moreCount})
          </span>
        </div>

        {group.isRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-xs dark:text-primary-200 text-primary-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Running
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="space-y-1 max-h-160 overflow-y-auto bg-primary-100/30 dark:bg-primary-950/30">
          {groupConsecutiveToolCalls(group.events).map((subGroup) => (
            <ToolSubGroupAccordion key={subGroup.id} subGroup={subGroup} />
          ))}
        </div>
      )}
    </div>
  );
}

// Re-export for backwards compatibility
export { InfoGroup } from "./info-group";
export { groupEvents, type EventGroup } from "../../utils/group-events";
