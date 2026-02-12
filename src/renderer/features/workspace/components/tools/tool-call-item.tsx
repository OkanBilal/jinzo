import type { RunEvent } from "../../types";
import { getToolInfo } from "../../utils/tool-categories";
import { parseToolContent } from "../../utils/parse-tool-content";
import { getToolType } from "../../utils/group-tool-calls";
import { TodoListDisplay, type TodoItem } from "./todo-list-display";
import { TaskDisplay, type TaskParams } from "./task-display";

interface ToolCallItemProps {
  event: RunEvent;
  isCompact?: boolean;
}

export function ToolCallItem({ event, isCompact = true }: ToolCallItemProps) {
  const { toolName, params, summary } = parseToolContent(event.content);
  const displayName = getToolType(event.content);
  const { icon } = getToolInfo(displayName);

  if (toolName.toLowerCase() === "todowrite") {
    // First try to get todos from metadata (raw input from hook)
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const todos = metadataInput?.todos ?? params?.todos;
    if (todos && Array.isArray(todos)) {
      return <TodoListDisplay todos={todos as TodoItem[]} />;
    }
  }

  // Show TaskDisplay for task tool calls - prefer metadata.input over parsed content
  if (toolName.toLowerCase() === "task") {
    // First try to get params from metadata (raw input from hook)
    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const taskParams: TaskParams = metadataInput
      ? (metadataInput as TaskParams)
      : params
        ? (params as TaskParams)
        : { description: summary };
    return <TaskDisplay params={taskParams} />;
  }

  if (isCompact) {
    return (
      <div className="flex items-center gap-2 py-0.5 ml-5 px-2 hover:bg-primary-100/50 dark:hover:bg-primary-800/20 rounded text-[13px] font-sans">
        <span className="text-primary-500 truncate">{summary}</span>
      </div>
    );
  }

  return (
    <div className="py-0.5 px-2 hover:bg-primary-100/50 dark:hover:bg-primary-800/20 rounded">
      <div className="flex items-center gap-2 text-[13px] font-sans">
        <span className="dark:text-primary-300">{icon}</span>
        <span className="dark:text-primary-300 font-medium">{displayName}</span>
        <span className="text-primary-500 truncate">{summary}</span>
      </div>
    </div>
  );
}
