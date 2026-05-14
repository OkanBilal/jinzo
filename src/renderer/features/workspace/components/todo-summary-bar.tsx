import { useMemo, useState } from "react";
import type { RunEvent } from "../types";
import { resolveTool } from "../utils/resolve-tool";
import { ArrowUp, Check } from "@/components/ui/icons";
import type { TodoItem } from "./tools/todo-list-display";

interface TodoSummaryBarProps {
  events: RunEvent[];
}

/**
 * Pull the most recent TodoWrite snapshot from the timeline.
 *
 * Each TodoWrite call carries a full plan snapshot in `metadata.input.todos`
 * (or `params.todos` when adapters parse via content). The latest entry wins.
 */
function findLatestTodoSnapshot(events: RunEvent[]): TodoItem[] | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type !== "tool_call") continue;
    if (resolveTool(event.content).groupKey !== "todowrite") continue;

    const metadataInput = event.metadata?.input as
      | Record<string, unknown>
      | undefined;
    const todosFromMeta = metadataInput?.todos;
    if (Array.isArray(todosFromMeta) && todosFromMeta.length > 0) {
      return todosFromMeta as TodoItem[];
    }

    // Fallback: parse `TodoWrite: { ... }` content payload when metadata is missing.
    const colonIdx = event.content.indexOf(":");
    if (colonIdx > 0) {
      try {
        const parsed = JSON.parse(event.content.slice(colonIdx + 1).trim());
        if (Array.isArray(parsed?.todos) && parsed.todos.length > 0) {
          return parsed.todos as TodoItem[];
        }
      } catch {
        // ignore — no parseable todos
      }
    }
  }
  return null;
}

/**
 * Sticky widget rendered above the input that mirrors Codex's "X out of Y
 * tasks completed" card. Replaces the per-call TodoWrite cards in the message
 * timeline (those are filtered out by `groupConsecutiveToolCalls`) so users
 * see one continuously-updated plan instead of repeating snapshots.
 */
export function TodoSummaryBar({ events }: TodoSummaryBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const todos = useMemo(() => findLatestTodoSnapshot(events), [events]);

  if (!todos || todos.length === 0) return null;

  const completedCount = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.find((t) => t.status === "in_progress");

  return (
    <div className="w-200 mx-auto mb-1">
      <div className="rounded-2xl glass-morphism overflow-hidden">
        <button
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
        </button>

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
