import type { RunEvent } from "../types";

export interface ToolSubGroup {
  id: string;
  toolType: string;
  events: RunEvent[];
}

export function groupConsecutiveToolCalls(events: RunEvent[]): ToolSubGroup[] {
  const subGroups: ToolSubGroup[] = [];
  let currentGroup: RunEvent[] = [];
  let currentToolType: string | null = null;

  const getToolType = (content: string): string => {
    const colonIdx = content.indexOf(":");
    const toolName =
      colonIdx > 0 ? content.substring(0, colonIdx).trim() : content;
    const lower = toolName.toLowerCase();
    if (lower === "todowrite") return "TodoWrite";
    if (lower === "task") return "Task";
    if (lower === "read" || lower === "view" || lower.includes("read"))
      return "Read";
    if (lower === "bash" || lower === "shell" || lower === "terminal")
      return "Bash";
    if (lower === "edit" || lower.includes("edit")) return "Edit";
    if (lower === "write" || lower.includes("write")) return "Write";
    if (lower === "search" || lower === "find") return "Search";
    if (lower === "glob") return "Glob";
    if (lower === "grep") return "Grep";
    return toolName;
  };

  const flushGroup = () => {
    if (currentGroup.length > 0 && currentToolType) {
      subGroups.push({
        id: `subgroup-${currentGroup[0].id}`,
        toolType: currentToolType,
        events: [...currentGroup],
      });
      currentGroup = [];
      currentToolType = null;
    }
  };

  for (const event of events) {
    const toolType = getToolType(event.content);

    const lowerToolType = toolType.toLowerCase();
    const isSpecial = lowerToolType === "task" || lowerToolType === "todowrite";

    if (isSpecial) {
      flushGroup();
      subGroups.push({
        id: `subgroup-${event.id}`,
        toolType: toolType,
        events: [event],
      });
    } else if (toolType === currentToolType) {
      currentGroup.push(event);
    } else {
      flushGroup();
      currentToolType = toolType;
      currentGroup = [event];
    }
  }

  flushGroup();
  return subGroups;
}
