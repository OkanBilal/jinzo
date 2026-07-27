import { memo, useState } from "react";
import { ArrowUp } from "@/components/ui/icons";
import { groupConsecutiveToolCalls } from "../../utils/group-tool-calls";
import { resolveTool } from "../../utils/resolve-tool";
import {
  normalizeSlug,
  renderPluginIcon,
  usePluginLogoMap,
} from "../../hooks";
import { ToolSubGroupAccordion } from "./tool-sub-group-accordion";
import type { EventGroup } from "../../utils/group-events";
import { Button } from "@/components/ui";

interface ToolCallGroupProps {
  group: EventGroup;
  defaultExpanded?: boolean;
  variant?: "copilot" | "claude" | "codex" | "cursor";
}

function ToolCallGroupImpl({
  group,
  defaultExpanded = false,
}: ToolCallGroupProps) {
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null);
  const isExpanded = expandedOverride ?? defaultExpanded;
  const pluginLogos = usePluginLogoMap();

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
  const toolIcons = new Map<string, React.ReactNode>();

  for (const subGroup of subGroups) {
    const resolved = resolveTool(subGroup.events[0].content);
    const iconKey = resolved.vendorId
      ? `vendor:${normalizeSlug(resolved.vendorId)}`
      : `tool:${resolved.groupKey}`;

    if (toolIcons.has(iconKey)) continue;

    const pluginIcon = resolved.vendorId
      ? renderPluginIcon(
          pluginLogos.get(normalizeSlug(resolved.vendorId)),
          "size-4",
        )
      : null;
    toolIcons.set(iconKey, pluginIcon ?? subGroup.icon);
  }

  return (
    <div className="mb-2">
      <Button
        onClick={() => setExpandedOverride(!isExpanded)}
        className="group w-full flex items-center gap-1 mb-1 text-s font-sans cursor-pointer"
      >
        <div className="flex items-center transition-all duration-200">
          <span
            aria-hidden="true"
            className={`flex shrink-0 items-center gap-0.5 overflow-hidden text-primary-500 transition-[max-width,opacity,transform,margin] duration-200 ease-out group-hover:text-primary-950 group-hover:dark:text-primary ${
              isExpanded
                ? "mr-0 max-w-0 -translate-x-1 opacity-0"
                : "mr-1 max-w-20 translate-x-0 opacity-100"
            }`}
          >
            {Array.from(toolIcons.entries()).slice(0, 5).map(([key, icon]) => (
              <span
                key={key}
                className="flex size-4 items-center justify-center [&>svg]:size-3.5"
              >
                {icon}
              </span>
            ))}
          </span>
          <span className="text-primary-500  group-hover:text-primary-950 group-hover:dark:text-primary">
            {toolCount} tool call{toolCount !== 1 ? "s" : ""}
          </span>
          <span className=" text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
            ({toolSummary}
            {moreCount})
          </span>
        </div>
        <ArrowUp
          className={`size-3.5 shrink-0 text-primary-500 opacity-100 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
{/*
        {group.isRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-xs dark:text-primary-200 text-primary-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Running
          </span>
        )} */}
      </Button>

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

/**
 * Memoized so a streamed token re-renders only the live tool group, not every
 * historical one. Relies on `reconcileEventGroups` keeping `group` referentially
 * stable for unchanged groups (see `group-events.ts`).
 */
export const ToolCallGroup = memo(ToolCallGroupImpl);

// Re-export for backwards compatibility
export { InfoGroup } from "./info-group";
export {
  groupEvents,
  reconcileEventGroups,
  isPlanToolCallGroup,
  toolEventPlanName,
  type EventGroup,
} from "../../utils/group-events";
