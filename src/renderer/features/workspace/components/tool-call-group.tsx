import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { RunEvent } from "../types";
import {
  Document,
  Search,
  Branch,
  ArrowUp,
  Read,
  Edit,
  Bash,
  Check,
  ExitPlan,
  Task,
  Glob,
  Web,
} from "@/components/ui/icons";
import { markdownComponents } from "@/features/chat/components/markdown-components";

const TOOL_CATEGORIES: Record<
  string,
  { category: string; icon: React.ReactNode; color: string }
> = {
  read: {
    category: "File",
    icon: <Read className="size-4" />,
    color: "text-primary-300",
  },
  view: {
    category: "File",
    icon: <Document className="size-4" />,
    color: "text-primary-300",
  },
  write: {
    category: "File",
    icon: <Edit className="size-4" />,
    color: "text-primary-300",
  },
  edit: {
    category: "File",
    icon: <Edit className="size-3.5" />,
    color: "text-primary-300",
  },
  bash: {
    category: "Shell",
    icon: <Bash className="size-4" />,
    color: "text-primary-300",
  },
  grep: {
    category: "Search",
    icon: <Search className="size-3.5" />,
    color: "text-primary-300",
  },
  glob: {
    category: "File",
    icon: <Glob className="size-4" />,
    color: "text-primary-300",
  },
  websearch: {
    category: "Search",
    icon: <Web className="size-4" />,
    color: "text-primary-300",
  },
  webfetch: {
    category: "Search",
    icon: <Web className="size-4" />,
    color: "text-primary-300",
  },
  task: {
    category: "Agent",
    icon: <Task className="size-4" />,
    color: "text-primary-300",
  },
  todowrite: {
    category: "Todo",
    icon: <Check className="size-4" />,
    color: "text-primary-300",
  },
  enterplanmode: {
    category: "Todo",
    icon: <ExitPlan className="size-4" />,
    color: "text-primary-300",
  },
  exitplanmode: {
    category: "Todo",
    icon: <ExitPlan className="size-4" />,
    color: "text-primary-300",
  },
  write_file: {
    category: "File",
    icon: <Document className="size-4" />,
    color: "text-primary-300",
  },
  edit_file: {
    category: "File",
    icon: <Edit className="size-3.5" />,
    color: "text-primary-300",
  },
  create_file: {
    category: "File",
    icon: <Document className="size-4" />,
    color: "text-primary-300",
  },
  shell: {
    category: "Shell",
    icon: <Bash className="size-4" />,
    color: "text-primary-300",
  },
  terminal: {
    category: "Shell",
    icon: <Bash className="size-4" />,
    color: "text-primary-300",
  },
  search: {
    category: "Search",
    icon: <Search className="size-4" />,
    color: "text-primary-300",
  },

  find: {
    category: "Search",
    icon: <Search className="size-4" />,
    color: "text-primary-300",
  },
  git_status: {
    category: "Git",
    icon: <Branch className="size-4" />,
    color: "text-primary-300",
  },
  git_diff: {
    category: "Git",
    icon: <Branch className="size-4" />,
    color: "text-primary-300",
  },
};

function getToolInfo(toolName: string): {
  category: string;
  icon: React.ReactNode;
  color: string;
} {
  if (TOOL_CATEGORIES[toolName]) {
    return TOOL_CATEGORIES[toolName];
  }
  const lowerName = toolName.toLowerCase();
  for (const [key, value] of Object.entries(TOOL_CATEGORIES)) {
    if (lowerName.includes(key.toLowerCase())) {
      return value;
    }
  }

  return {
    category: "Tool",
    icon: <Glob className=" size-4" />,
    color: "text-primary-300",
  };
}

function parseToolContent(content: string): {
  toolName: string;
  params: Record<string, unknown> | null;
  summary: string;
} {
  const colonIdx = content.indexOf(":");
  if (colonIdx === -1) {
    return { toolName: content, params: null, summary: content };
  }

  const toolName = content.substring(0, colonIdx).trim();
  const rest = content.substring(colonIdx + 1).trim();

  try {
    const params = JSON.parse(rest);
    let summary = "";
    if (params.file_path) {
      summary = params.file_path.split("/").pop() || params.file_path;
    } else if (params.command) {
      summary =
        params.command.length > 50
          ? params.command.substring(0, 50) + "..."
          : params.command;
    } else if (params.description) {
      summary = params.description;
    } else {
      summary = `(${Object.keys(params).length} params)`;
    }
    return { toolName, params, summary };
  } catch {
    const summary = rest.length > 60 ? rest.substring(0, 60) + "..." : rest;
    return { toolName, params: null, summary };
  }
}

interface ToolCallItemProps {
  event: RunEvent;
  isCompact?: boolean;
}

// Todo item interface
interface TodoItem {
  content: string;
  status: "completed" | "in_progress" | "pending";
  activeForm?: string;
}
function TodoListDisplay({ todos }: { todos: TodoItem[] }) {
  const completedCount = todos.filter((t) => t.status === "completed").length;
  const inProgressItem = todos.find((t) => t.status === "in_progress");

  return (
    <div className="py-2 px-3 space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-primary-500 dark:text-primary-400 mb-2">
        <Check className="size-3.5" />
        <span>
          {completedCount}/{todos.length} completed
        </span>
        {inProgressItem && (
          <span className="text-amber-500 dark:text-amber-400">
            • {inProgressItem.activeForm || "In progress"}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {todos.map((todo, idx) => (
          <div key={idx} className="flex items-start gap-2 text-[13px]">
            <div
              className={`mt-0.5 size-4 rounded flex items-center justify-center shrink-0 ${
                todo.status === "completed"
                  ? "bg-green-500/20 text-green-500"
                  : todo.status === "in_progress"
                    ? "bg-amber-500/20 text-amber-500"
                    : "bg-primary-200 dark:bg-primary-700 text-primary-400"
              }`}
            >
              {todo.status === "completed" && <Check className="size-3" />}
              {todo.status === "in_progress" && (
                <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            <span
              className={`${
                todo.status === "completed"
                  ? "text-primary-400 line-through"
                  : todo.status === "in_progress"
                    ? "text-primary-700 dark:text-primary-200"
                    : "text-primary-500"
              }`}
            >
              {todo.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolCallItem({ event, isCompact = true }: ToolCallItemProps) {
  const { toolName, params, summary } = parseToolContent(event.content);
  const { icon, color } = getToolInfo(toolName);
  const time = event.timestamp.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (
    toolName.toLowerCase() === "todowrite" &&
    params?.todos &&
    Array.isArray(params.todos)
  ) {
    return <TodoListDisplay todos={params.todos as TodoItem[]} />;
  }

  if (isCompact) {
    return (
      <div className="flex items-center gap-2 py-0.5 px-2 hover:bg-primary-100/50 dark:hover:bg-primary-800/20 rounded text-[13px] font-mono">
        {/* <span className="text-primary-500 text-xs w-16 shrink-0">{time}</span> */}
        <span className={`${color} shrink-0`}>{icon}</span>
        <span className={`${color} font-medium shrink-0`}>{toolName}</span>
        <span className="text-primary-500 truncate">{summary}</span>
      </div>
    );
  }

  return (
    <div className="py-1 px-2 hover:bg-primary-100/50 dark:hover:bg-primary-800/20 rounded">
      <div className="flex items-center gap-2 text-[13px] font-mono">
        {/* <span className="text-primary-500 text-xs">{time}</span> */}
        <span className={`${color}`}>{icon}</span>
        <span className={`${color} font-medium`}>{toolName}</span>
      </div>
      {params && (
        <pre className="text-xs text-primary-300 mt-1 pl-6 overflow-x-auto">
          {JSON.stringify(params, null, 2)}
        </pre>
      )}
    </div>
  );
}

export interface EventGroup {
  id: string;
  type: "tool_calls" | "info" | "response";
  events: RunEvent[];
  startTime: Date;
  endTime: Date;
  isRunning?: boolean;
}

interface ToolCallGroupProps {
  group: EventGroup;
  defaultExpanded?: boolean;
  variant?: "workspace" | "claude";
}

export function ToolCallGroup({
  group,
  defaultExpanded = false,
  variant = "workspace",
}: ToolCallGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toolCount = group.events.length;
  const startTime = group.startTime.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const toolTypes = new Set(
    group.events.map((e) => {
      const colonIdx = e.content.indexOf(":");
      return colonIdx > 0 ? e.content.substring(0, colonIdx).trim() : "Tool";
    }),
  );
  const toolSummary = Array.from(toolTypes).slice(0, 3).join(",");
  const moreCount = toolTypes.size > 3 ? ` +${toolTypes.size - 3}` : "";

  return (
    <div
      className={`rounded-lg overflow-hidden ${variant === "claude" ? "glass-morphism-claude" : "glass-morphism-copilot"}`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-2 py-2 hover:bg-primary-100/50 dark:hover:bg-primary-800/40  transition-colors cursor-pointer"
      >
        <ArrowUp
          className={`size-3.5 dark:text-primary-200 text-primary-800 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />

        {/* <span className="text-primary-500 text-xs font-mono">{startTime}</span> */}

        <div className="flex items-center gap-2">
          <Bash className="size-4 dark:text-primary-200 text-primary-700" />
          <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
            {toolCount} tool call{toolCount !== 1 ? "s" : ""}
          </span>
        </div>

        <span className="text-xs dark:text-primary-400 text-primary-700 truncate">
          ({toolSummary}
          {moreCount})
        </span>

        {group.isRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-xs dark:text-primary-200 text-primary-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Running
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="border-t space-y-1 border-primary-200/50 dark:border-primary-700/30 max-h-80 overflow-y-auto bg-primary-100/30 dark:bg-primary-950/30">
          {group.events.map((event) => (
            <ToolCallItem key={event.id} event={event} isCompact={true} />
          ))}
        </div>
      )}
    </div>
  );
}

interface InfoGroupProps {
  group: EventGroup;
}

export function InfoGroup({ group }: InfoGroupProps) {
  const event = group.events[0];
  if (!event) return null;

  const time = event.timestamp.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (event.type === "artifact" && event.metadata?.kind === "user-prompt") {
    return (
      <div className="w-full overflow-hidden">
        <div className="w-full py-2 flex justify-end">
          <div className="flex items-end gap-2 max-w-[80%]">
            <div className="px-4 py-2.5 rounded-2xl  bg-primary-200 dark:bg-primary-300/15">
              <div className=" text-primary-950 dark:text-primary-50">
                <p className="text-sm">{event.content}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (event.type === "log" && event.metadata?.level === "sdk-user") {
    return (
      <div className="overflow-hidden">
        <div className=" py-2">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="text-xs text-[#D97757] mb-1 font-medium">
                Sent to Claude
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none text-primary-600 dark:text-primary-300">
                <ReactMarkdown components={markdownComponents}>
                  {event.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (event.type === "artifact") {
    const content = event.content;

    return (
      <div className=" overflow-hidden ">
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            {/* <span className="text-primary-500 text-xs font-mono">{time}</span> */}
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none relative ">
            <div className=" size-1.5 dark:bg-primary bg-primary-950 rounded-full absolute top-2 -left-4" />

            <ReactMarkdown components={markdownComponents}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-1.5 flex items-start gap-2 text-sm">
      {/* <span className="text-primary-500 text-xs font-mono shrink-0">{time}</span> */}
      <span className="text-primary-600 dark:text-primary-300">
        {event.content}
      </span>
    </div>
  );
}

// Group events into logical clusters
export function groupEvents(events: RunEvent[]): EventGroup[] {
  const groups: EventGroup[] = [];
  let currentToolGroup: RunEvent[] = [];

  const flushToolGroup = () => {
    if (currentToolGroup.length > 0) {
      groups.push({
        id: `tools-${currentToolGroup[0].id}`,
        type: "tool_calls",
        events: [...currentToolGroup],
        startTime: currentToolGroup[0].timestamp,
        endTime: currentToolGroup[currentToolGroup.length - 1].timestamp,
      });
      currentToolGroup = [];
    }
  };

  for (const event of events) {
    if (event.type === "tool_call") {
      currentToolGroup.push(event);
    } else if (event.type === "artifact") {
      flushToolGroup();
      // Determine if this is a user prompt or response
      const isUserPrompt = event.metadata?.kind === "user-prompt";
      groups.push({
        id: `${isUserPrompt ? "user" : "response"}-${event.id}`,
        type: isUserPrompt ? "info" : "response",
        events: [event],
        startTime: event.timestamp,
        endTime: event.timestamp,
      });
    } else if (event.type === "log") {
      // Skip start/resume level logs (internal system messages)
      const level = event.metadata?.level as string | undefined;
      if (level === "start" || level === "resume") {
        continue;
      }

      // SDK user messages - show as special info group
      if (level === "sdk-user") {
        flushToolGroup();
        groups.push({
          id: `sdk-user-${event.id}`,
          type: "info",
          events: [event],
          startTime: event.timestamp,
          endTime: event.timestamp,
        });
        continue;
      }

      // Check if this is a system/info log we want to show
      const content = event.content;
      const isImportant =
        content.includes("Session initialized") ||
        content.includes("Starting") ||
        content.includes("Resuming") ||
        (!content.startsWith("[") && content.length < 200);

      if (isImportant) {
        flushToolGroup();
        groups.push({
          id: `info-${event.id}`,
          type: "info",
          events: [event],
          startTime: event.timestamp,
          endTime: event.timestamp,
        });
      }
      // Skip non-important logs (they're internal)
    } else if (event.type === "status") {
      // Status events are important
      flushToolGroup();
      groups.push({
        id: `status-${event.id}`,
        type: "info",
        events: [event],
        startTime: event.timestamp,
        endTime: event.timestamp,
      });
    }
  }

  // Flush any remaining tool calls (and mark as running if at the end)
  if (currentToolGroup.length > 0) {
    groups.push({
      id: `tools-${currentToolGroup[0].id}`,
      type: "tool_calls",
      events: [...currentToolGroup],
      startTime: currentToolGroup[0].timestamp,
      endTime: currentToolGroup[currentToolGroup.length - 1].timestamp,
      isRunning: true, // Last group might still be running
    });
  }

  return groups;
}
