import { useState } from "react";
import { Search } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";

export interface ToolSearchParams {
  query?: string;
  max_results?: number;
}

export function ToolSearchDisplay({ output, isCompact = false }: { params: ToolSearchParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { matches, total } = parseToolSearchOutput(output);
  const hasMatches = matches.length > 0;

  return (
    <div>
      <ToolHeader
        icon={<Search className="size-3.5" />}
        verb="Searched tools"
        hasDetails={hasMatches}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        {matches.length > 0 && (
          <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
            {matches.length} match{matches.length !== 1 ? "es" : ""}
            {total > 0 && ` / ${total} total`}
          </span>
        )}
      </ToolHeader>

      {hasMatches && (
        <ToolCollapse isExpanded={isExpanded}>
          <div className="noscrollbar text-s font-sans text-primary-950 dark:text-primary bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
            {matches.map((m) => (
              <div key={m} className="truncate">{m}</div>
            ))}
          </div>
        </ToolCollapse>
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
