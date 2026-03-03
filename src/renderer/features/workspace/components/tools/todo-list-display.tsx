import { useState } from "react";
import { ArrowUp, Check } from "@/components/ui/icons";

export interface TodoItem {
  content: string;
  status: "completed" | "in_progress" | "pending";
  activeForm?: string;
}

export function TodoListDisplay({ todos }: { todos: TodoItem[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const completedCount = todos.filter((t) => t.status === "completed").length;
  const inProgressItem = todos.find((t) => t.status === "in_progress");

  return (
    <div className="py-1 px-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans cursor-pointer"
      >
        <ArrowUp
          className={`size-3 text-primary-500 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        <Check className="size-3.5 text-primary-300" />
        <span className="text-primary-300 font-medium">Todo</span>
        <span className="text-primary-500">
          {completedCount}/{todos.length} completed
        </span>
        {inProgressItem && (
          <span className="text-amber-500 dark:text-amber-400 truncate">
            • {inProgressItem.content}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 ml-5 space-y-1 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          {todos.map((todo) => (
            <div key={todo.content} className="flex items-start gap-2 text-s">
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
      )}
    </div>
  );
}
