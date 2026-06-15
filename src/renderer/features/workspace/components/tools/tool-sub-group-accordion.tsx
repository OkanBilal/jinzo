import { useState } from "react";
import type { ToolSubGroup } from "../../utils/group-tool-calls";
import { ToolCallItem } from "./tool-call-item";
import { ToolHeader, ToolCollapse, ToolStatusProvider, aggregateToolStatus } from "./_shared";

interface ToolSubGroupAccordionProps {
  subGroup: ToolSubGroup;
}

export function ToolSubGroupAccordion({ subGroup }: ToolSubGroupAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // If only one event, render directly without accordion - show full details
  if (subGroup.events.length === 1) {
    return <ToolCallItem event={subGroup.events[0]} isCompact={false} />;
  }

  // Collapsed header reflects the rolled-up status of every call in the group:
  // spinner + present tense while any are running, red while any failed.
  const status = aggregateToolStatus(subGroup.events);

  return (
    <ToolStatusProvider value={status}>
      <div>
        <ToolHeader
          icon={subGroup.icon}
          verb={subGroup.displayName}
          hasDetails
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded((v) => !v)}
        >
          <span className="text-primary-500 text-xs group-hover:text-primary-950 group-hover:dark:text-primary">
            ({subGroup.events.length})
          </span>
        </ToolHeader>

        <ToolCollapse isExpanded={isExpanded}>
          <div className="space-y-0.5">
            {subGroup.events.map((event) => (
              <ToolCallItem key={event.id} event={event} isCompact={true} />
            ))}
          </div>
        </ToolCollapse>
      </div>
    </ToolStatusProvider>
  );
}
