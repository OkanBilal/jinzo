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
    <div className="">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group w-full flex items-center gap-1 py-1  text-s font-sans cursor-pointer"
      >
        <span className="text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary shrink-0">{icon}</span>
        <span className="text-primary-500 dark:text-primary-300 font-medium group-hover:text-primary-950 group-hover:dark:text-primary shrink-0">
          {subGroup.toolType}
        </span>
        <span className="text-primary-500 text-xs group-hover:text-primary-950 group-hover:dark:text-primary">
          ({subGroup.events.length})
        </span>
        <ArrowUp
          className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
      </button>

      <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-0.5">
            {subGroup.events.map((event) => (
              <ToolCallItem key={event.id} event={event} isCompact={true} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
