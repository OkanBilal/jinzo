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
  const hasParams = !!params && paramKeys.length > 0;
  const summary =
    paramKeys.length > 0
      ? `{${paramKeys.join(", ")}} (${JSON.stringify(params).length} chars)`
      : "No params";

  return (
    <div className="">
      <button
        onClick={() => hasParams && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1  text-s font-sans ${hasParams ? "cursor-pointer" : "cursor-default"}`}
      >
        <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">{icon}</span>
        <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
          {displayName}
        </span>
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">{summary}</span>
        {hasParams && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasParams && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-1.5">
              {paramKeys.map((key) => (
                <div key={key}>
                  <span className="text-xs font-medium text-primary-500">{key}</span>
                  <div className="noscrollbar text-sm text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
                    {formatValue(params[key])}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
