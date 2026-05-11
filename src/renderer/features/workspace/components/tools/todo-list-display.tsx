import { useState } from "react";
import { Check } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";

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
    <div>
      <ToolHeader
        icon={<Check className="size-3.5" />}
        verb="Todo"
        hasDetails
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
      >
        <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
          {completedCount}/{todos.length} completed
        </span>
        {inProgressItem && (
          <span className="text-amber-600 dark:text-amber-400 truncate">
            • {inProgressItem.content}
          </span>
        )}
      </ToolHeader>

      <ToolCollapse isExpanded={isExpanded}>
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
      </ToolCollapse>
    </div>
  );
}
