import { useState } from "react";
import { ArrowUp } from "@/components/ui/icons";
import { groupConsecutiveToolCalls } from "../../utils/group-tool-calls";
import { ToolSubGroupAccordion } from "./tool-sub-group-accordion";
import type { EventGroup } from "../../utils/group-events";

interface ToolCallGroupProps {
  group: EventGroup;
  defaultExpanded?: boolean;
  variant?: "copilot" | "claude" | "codex" | "cursor";
}

export function ToolCallGroup({
  group,
  defaultExpanded = false,
}: ToolCallGroupProps) {
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null);
  const isExpanded = expandedOverride ?? defaultExpanded;

  const subGroups = groupConsecutiveToolCalls(group.events);
  const toolCount = subGroups.reduce((acc, sg) => acc + sg.events.length, 0);

  // Single tool call: skip the outer group wrapper entirely and render the
  // item directly (ToolSubGroupAccordion already collapses 1-event subgroups).
  if (toolCount === 1 && subGroups.length === 1) {
    return (
      <div>
        <ToolSubGroupAccordion subGroup={subGroups[0]} />
      </div>
    );
  }

  const toolTypes = new Set(subGroups.map((sg) => sg.displayName));
  const toolSummary = Array.from(toolTypes).slice(0, 3).join(", ");
  const moreCount = toolTypes.size > 3 ? ` +${toolTypes.size - 3}` : "";

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpandedOverride(!isExpanded)}
        className="group w-full flex items-center gap-1 mb-1 text-s font-sans cursor-pointer"
      >
        <div className="flex items-center gap-1 transition-all duration-200">
          <span className="text-primary-500  group-hover:text-primary-950 group-hover:dark:text-primary">
            {toolCount} tool call{toolCount !== 1 ? "s" : ""}
          </span>
          <span className=" text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
            ({toolSummary}
            {moreCount})
          </span>
        </div>
        <ArrowUp
          className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
{/*
        {group.isRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-xs dark:text-primary-200 text-primary-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Running
          </span>
        )} */}
      </button>

      <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-0.5 max-h-160 overflow-y-auto">
            {subGroups.map((subGroup) => (
              <ToolSubGroupAccordion key={subGroup.id} subGroup={subGroup} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export for backwards compatibility
export { InfoGroup } from "./info-group";
export { groupEvents, isPlanToolCallGroup, type EventGroup } from "../../utils/group-events";
