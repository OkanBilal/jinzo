import { useState } from "react";
import { Search } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse, ToolOutputBody } from "./_shared";
import { coerceToolOutput } from "../../utils/parse-tool-content";

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
        icon={<Search className="size-4" />}
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
          <ToolOutputBody as="div" className="text-s font-sans">
            {matches.map((m) => (
              <div key={m} className="truncate">{m}</div>
            ))}
          </ToolOutputBody>
        </ToolCollapse>
      )}
    </div>
  );
}

function parseToolSearchOutput(output: unknown): { matches: string[]; total: number } {
  const parsed = coerceToolOutput(output);

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const matches = Array.isArray(obj.matches) ? (obj.matches as string[]) : [];
    const total = typeof obj.total_deferred_tools === "number" ? obj.total_deferred_tools : 0;
    return { matches, total };
  }

  return { matches: [], total: 0 };
}
