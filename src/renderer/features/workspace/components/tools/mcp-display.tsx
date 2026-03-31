import { useState } from "react";
import { ArrowUp } from "@/components/ui/icons";
import { getToolInfo } from "../../utils/tool-categories";

interface McpDisplayProps {
  displayName: string;
  params: Record<string, unknown> | null;
}

function formatValue(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    if (value.length > 300) return value.substring(0, 300) + "…";
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (depth > 1) return `[${value.length} items]`;
    return value.map((v) => formatValue(v, depth + 1)).join("\n");
  }
  if (typeof value === "object") {
    if (depth > 1) return JSON.stringify(value);
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.map(([k, v]) => `${k}: ${formatValue(v, depth + 1)}`).join("\n");
  }
  return String(value);
}

export function McpDisplay({ displayName, params }: McpDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { icon } = getToolInfo(displayName);

  const paramKeys = params ? Object.keys(params) : [];
  const summary =
    paramKeys.length > 0
      ? `{${paramKeys.join(", ")}} (${JSON.stringify(params).length} chars)`
      : "No params";

  return (
    <div className="px-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans cursor-pointer"
      >
        <ArrowUp
          className={`size-3 text-primary-800  dark:text-primary-300 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        <span className="dark:text-primary-300 text-primary-700">{icon}</span>
        <span className="dark:text-primary-300 text-primary-700 font-medium">
          {displayName}
        </span>
        <span className="text-primary-500 truncate">{summary}</span>
      </button>

      {isExpanded && params && paramKeys.length > 0 && (
        <div className="mt-2 ml-5 space-y-1.5 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          {paramKeys.map((key) => (
            <div key={key}>
              <span className="text-xs font-medium text-primary-500">{key}</span>
              <div className="noscrollbar text-sm text-primary-700 dark:text-primary-300 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded p-2 max-h-48 overflow-y-auto">
                {formatValue(params[key])}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
