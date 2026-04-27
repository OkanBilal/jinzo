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
    <div className="">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group w-full flex items-center gap-1 py-1  text-s font-sans cursor-pointer"
      >
        <Check className="size-3.5 text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary" />
        <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">Todo</span>
        <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
          {completedCount}/{todos.length} completed
        </span>
        {inProgressItem && (
          <span className="text-amber-600 dark:text-amber-400 truncate">
            • {inProgressItem.content}
          </span>
        )}
        <ArrowUp
          className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
      </button>

      <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-1">
            {todos.map((todo) => (
              <div key={todo.content} className="flex items-start gap-2 text-s">
                <div
                  className={`mt-0.5 size-4 rounded flex items-center justify-center shrink-0 ${
                    todo.status === "completed"
                      ? "bg-green-600/20 text-green-600"
                      : todo.status === "in_progress"
                        ? "bg-amber-500/20 text-amber-500"
                        : "bg-primary-50 dark:bg-primary/5 text-primary-500"
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
                        ? "text-primary-500 line-through"
                      : todo.status === "in_progress"
                        ? "text-primary-950 dark:text-primary"
                        : "text-primary-500"
                  }`}
                >
                  {todo.content}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
