import { useState } from "react";
import { ArrowUp, Search } from "@/components/ui/icons";

export interface ToolSearchParams {
  query?: string;
  max_results?: number;
}

export function ToolSearchDisplay({ output, isCompact = false }: { params: ToolSearchParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { matches, total } = parseToolSearchOutput(output);
  const hasMatches = matches.length > 0;

  return (
    <div className="px-2">
      <button
        onClick={() => hasMatches && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans ${hasMatches ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasMatches && (
        <ArrowUp
          className={`size-3 text-primary-800  dark:text-primary-300 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        )}
        {!isCompact && <Search className="size-4 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            ToolSearch
          </span>
        )}

        {matches.length > 0 && (
          <span className="text-primary-400 text-xs dark:text-primary-500">
            {matches.length} match{matches.length !== 1 ? "es" : ""}
            {total > 0 && ` / ${total} total`}
          </span>
        )}
      </button>

      {isExpanded && hasMatches && (
        <div className="mt-2 ml-5 space-y-1 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          <div className="noscrollbar text-s font-sans text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary/5 rounded p-2 max-h-48 overflow-y-auto">
            {matches.map((m) => (
              <div key={m} className="truncate">{m}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function parseToolSearchOutput(output: unknown): { matches: string[]; total: number } {
  if (!output) return { matches: [], total: 0 };

  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { matches: [], total: 0 };
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const matches = Array.isArray(obj.matches) ? (obj.matches as string[]) : [];
    const total = typeof obj.total_deferred_tools === "number" ? obj.total_deferred_tools : 0;
    return { matches, total };
  }

  return { matches: [], total: 0 };
}
