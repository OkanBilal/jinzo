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
    <div className="">
      <button
        onClick={() => hasMatches && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-primary-400 dark:text-primary-500 text-s font-sans ${hasMatches ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && <Search className="size-3.5 text-primary-400 dark:text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary" />}
        {!isCompact && (
          <span className="text-primary-400 dark:text-primary-500 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            ToolSearch
          </span>
        )}

        {matches.length > 0 && (
          <span className="text-primary-400 text-xs dark:text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
            {matches.length} match{matches.length !== 1 ? "es" : ""}
            {total > 0 && ` / ${total} total`}
          </span>
        )}
        {hasMatches && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-400 dark:text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasMatches && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="">
              <div className="noscrollbar text-s font-sans text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
                {matches.map((m) => (
                  <div key={m} className="truncate">{m}</div>
                ))}
              </div>
            </div>
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
