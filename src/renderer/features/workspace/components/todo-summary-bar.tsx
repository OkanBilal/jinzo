import { useMemo, useState } from "react";
import type { RunEvent } from "../types";
import { resolveTool } from "../utils/resolve-tool";
import { ArrowUp, Check } from "@/components/ui/icons";
import { Button } from "@/components/ui";

interface TodoSummaryBarProps {
  events: RunEvent[];
}

interface TodoItem {
  content: string;
  status: "completed" | "in_progress" | "pending";
  activeForm?: string;
}

function parseEventInput(event: RunEvent): Record<string, unknown> | null {
  const raw = event.metadata?.input;
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // fall through to content parse
    }
  }
  const colonIdx = event.content.indexOf(":");
  if (colonIdx > 0) {
    try {
      return JSON.parse(event.content.slice(colonIdx + 1).trim()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Aggregate TaskCreate (one call per item) + TaskUpdate (taskId/status) calls
 * into a single `TodoItem[]` snapshot. The 1-based `taskId` indexes into the
 * accumulated array.
 */
function buildTaskSnapshot(events: RunEvent[]): TodoItem[] | null {
  const todos: TodoItem[] = [];

  for (const event of events) {
    if (event.type !== "tool_call") continue;
    const name = resolveTool(event.content).displayName;
    if (name !== "TaskCreate" && name !== "TaskUpdate") continue;

    const input = parseEventInput(event);
    if (!input) continue;

    if (name === "TaskCreate") {
      const subject = typeof input.subject === "string" ? input.subject : "";
      if (subject.length === 0) continue;
      const activeForm =
        typeof input.activeForm === "string" ? input.activeForm : undefined;
      todos.push({ content: subject, status: "pending", activeForm });
      continue;
    }

    const taskIdRaw = input.taskId;
    const idx =
      typeof taskIdRaw === "string"
        ? parseInt(taskIdRaw, 10) - 1
        : typeof taskIdRaw === "number"
          ? taskIdRaw - 1
          : NaN;
    if (!Number.isFinite(idx) || idx < 0 || idx >= todos.length) continue;

    const status = input.status;
    if (status === "in_progress" || status === "completed" || status === "pending") {
      todos[idx] = { ...todos[idx], status };
    }
  }

  return todos.length > 0 ? todos : null;
}

/**
 * Sticky widget rendered above the input that shows "X out of Y tasks
 * completed". Replaces the per-call TaskCreate/TaskUpdate cards in the message
 * timeline (those are filtered out by `groupConsecutiveToolCalls`) so users
 * see one continuously-updated plan instead of repeating snapshots.
 *
 * Lifecycle: the parent only mounts this bar while the active run is running.
 * When the run finishes, the bar unmounts on its own — no dismiss state needed.
 */
export function TodoSummaryBar({ events }: TodoSummaryBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const todos = useMemo(() => buildTaskSnapshot(events), [events]);

  if (!todos || todos.length === 0) return null;

  const completedCount = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.find((t) => t.status === "in_progress");

  return (
    <div className="w-full max-w-200 mx-auto mb-1">
      <div className="rounded-2xl glass-morphism overflow-hidden">
        <Button
          onClick={() => setIsExpanded((v) => !v)}
          className="group flex items-center gap-2 w-full px-4 py-3 cursor-pointer"
        >
          <ArrowUp
            className={`size-3 text-primary-500 dark:text-primary-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
          <Check className="size-3.5 text-primary-500 dark:text-primary-400 shrink-0" />
          <span className="text-xs font-medium text-primary-700 dark:text-primary-300 shrink-0">
            {completedCount} out of {todos.length} task{todos.length !== 1 ? "s" : ""} completed
          </span>
          {inProgress && !isExpanded && (
            <span className="text-xs text-amber-600 dark:text-amber-400 truncate min-w-0">
              • {inProgress.content}
            </span>
          )}
        </Button>

        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden min-h-0">
            <ol className="border-t border-primary-200/40 dark:border-primary-700/30 px-4 py-3 space-y-1.5 max-h-72 overflow-y-auto">
              {todos.map((todo, idx) => {
                const isDone = todo.status === "completed";
                const isActive = todo.status === "in_progress";
                return (
                  <li
                    key={`${idx}-${todo.content}`}
                    className="flex items-start gap-2.5 text-xs"
                  >
                    <span
                      className={`mt-0.5 size-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isDone
                          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : isActive
                            ? "border-amber-500/70 bg-amber-500/20"
                            : "border-primary-300/50 dark:border-primary-600/40"
                      }`}
                      aria-hidden
                    >
                      {isDone && <Check className="size-2.5" />}
                      {isActive && (
                        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                      )}
                    </span>
                    <span className="text-primary-500 dark:text-primary-400 tabular-nums shrink-0 w-4 text-right">
                      {idx + 1}.
                    </span>
                    <span
                      className={`min-w-0 flex-1 ${
                        isDone
                          ? "text-primary-500 dark:text-primary-500 line-through"
                          : isActive
                            ? "text-primary-900 dark:text-primary-100 font-medium"
                            : "text-primary-700 dark:text-primary-300"
                      }`}
                    >
                      {todo.content}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
