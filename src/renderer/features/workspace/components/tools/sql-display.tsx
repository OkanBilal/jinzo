import { useState } from "react";
import { Layers } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";

export interface SqlParams {
  query?: string;
  description?: string;
  args?: string;
}

/** Copilot's `sql` tool (session-state todo bookkeeping): { description, query }. */
export function SqlDisplay({
  params,
  isCompact = false,
}: {
  params: SqlParams;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { query, description } = normalize(params);
  const hasDetails = !!query;
  const summary = description || query.split("\n").find((l) => l.trim()) || "query";

  return (
    <div>
      <ToolHeader
        icon={<Layers className="size-4" />}
        verb="SQL"
        hasDetails={hasDetails}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {summary}
        </span>
      </ToolHeader>

      {hasDetails && (
        <ToolCollapse isExpanded={isExpanded}>
          <pre className="noscrollbar text-s font-mono text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
            {query}
          </pre>
        </ToolCollapse>
      )}
    </div>
  );
}

/** Tolerate the `{ args: "<json>" }` envelope the adapter wraps non-object tool args in. */
function normalize(params: SqlParams): { query: string; description: string } {
  let p: SqlParams = params;
  if (typeof params.args === "string") {
    try {
      const parsed = JSON.parse(params.args);
      if (parsed && typeof parsed === "object") p = { ...params, ...parsed };
    } catch {
      /* ignore */
    }
  }
  return {
    query: typeof p.query === "string" ? p.query : "",
    description: typeof p.description === "string" ? p.description : "",
  };
}
