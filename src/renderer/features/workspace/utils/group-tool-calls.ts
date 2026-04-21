import type { RunEvent } from "../types";

export interface ToolSubGroup {
  id: string;
  toolType: string;
  events: RunEvent[];
}

/**
 * Collapse consecutive Edit events targeting the same file into one entry.
 * Cursor (and other agents) often emit multiple edits to the same file back-to-back;
 * each edit carries the full old→new snapshot, so showing them all as separate
 * rows is misleading. Keep the first `old_string` (original file state) and the
 * last `new_string` (final state) so the diff is cumulative.
 */
function getEventInput(event: RunEvent): Record<string, unknown> | null {
  const raw = event.metadata?.input;
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function collapseEditsByFilePath(events: RunEvent[]): RunEvent[] {
  const result: RunEvent[] = [];
  const indexByFile = new Map<string, number>();

  for (const event of events) {
    const input = getEventInput(event);
    if (!input || typeof input.file_path !== "string") {
      result.push(event);
      continue;
    }
    const filePath = input.file_path;

    const existingIdx = indexByFile.get(filePath);
    if (existingIdx === undefined) {
      indexByFile.set(filePath, result.length);
      result.push(event);
      continue;
    }

    const prev = result[existingIdx];
    const prevInput = getEventInput(prev) ?? {};
    const mergedInput: Record<string, unknown> = {
      ...input,
      file_path: filePath,
      old_string: prevInput.old_string ?? input.old_string,
      new_string: input.new_string ?? prevInput.new_string,
    };

    const toolName =
      (event.metadata?.toolName as string | undefined) ??
      event.content.split(":")[0];

    result[existingIdx] = {
      ...prev,
      content: `${toolName}: ${JSON.stringify(mergedInput)}`,
      timestamp: event.timestamp,
      metadata: {
        ...prev.metadata,
        input: mergedInput,
      },
    };
  }

  return result;
}

export function getToolType(content: string): string {
  const colonIdx = content.indexOf(":");
  const toolName =
    colonIdx > 0 ? content.substring(0, colonIdx).trim() : content;
  const lower = toolName.toLowerCase();

  // Jinzo tools: MCP prefix (mcp__jinzo__*) or direct name from bridge
  if (lower.startsWith("mcp__jinzo__") || lower.includes("__jinzo__")) {
    if (lower.includes("getworkspacediff")) return "GetDiff";
    if (lower.includes("savereview")) return "SaveReview";
    if (lower.includes("savefinding")) return "SaveFinding";
    if (lower.includes("commitchanges")) return "Commit";
    if (lower.includes("createpr")) return "CreatePR";
    if (lower.includes("checkpackage")) return "CheckPackage";
    return "Jinzo";
  }
  if (lower === "getworkspacediff") return "GetDiff";
  if (lower === "savereview") return "SaveReview";
  if (lower === "savefinding" || lower === "savefindings") return "SaveFinding";
  if (lower.includes("commitchanges")) return "Commit";
  if (lower.includes("createpr")) return "CreatePR";
  if (lower.includes("checkpackage")) return "CheckPackage";

  if (lower === "todowrite") return "TodoWrite";
  if (lower === "task") return "Task";
  if (lower === "read" ||  lower.includes("read"))
    return "Read";
  if (lower === "view" || lower.includes("view"))
    return "View";
  if (lower === "bash" || lower === "terminal")
    return "Bash";
  if (lower === "shell" || lower.includes("shell"))
    return "Shell";
  if (lower === "edit" || lower.includes("edit")) return "Edit";
  if (lower === "write" || lower.includes("write")) return "Write";
  if (lower === "websearch" || lower === "web_search") return "WebSearch";
  if (lower === "webfetch" || lower === "web_fetch") return "WebFetch";
  if (lower === "search" || lower === "find") return "Search";
  if (lower === "glob") return "Glob";
  if (lower === "grep") return "Grep";
  if (lower === "report_intent") return "Report Intent";
  if (lower === "toolsearch") return "ToolSearch";
  if (lower === "delete") return "Delete";

  return toolName;
}

export function groupConsecutiveToolCalls(events: RunEvent[]): ToolSubGroup[] {
  const subGroups: ToolSubGroup[] = [];
  let currentGroup: RunEvent[] = [];
  let currentToolType: string | null = null;

  const flushGroup = () => {
    if (currentGroup.length > 0 && currentToolType) {
      const events =
        currentToolType === "Edit" || currentToolType === "Write"
          ? collapseEditsByFilePath(currentGroup)
          : [...currentGroup];
      subGroups.push({
        id: `subgroup-${currentGroup[0].id}`,
        toolType: currentToolType,
        events,
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
