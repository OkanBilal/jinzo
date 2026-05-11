import { useState } from "react";
import { Web } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";

export interface WebFetchParams {
  /** Copilot / Claude style */
  url?: string;
  /** Codex `WebSearch` and similar — URL or search string */
  query?: string;
  max_length?: number;
}

function targetFromParams(params: WebFetchParams): string {
  const u = params.url?.trim();
  if (u) return u;
  const q = params.query?.trim();
  if (q) return q;
  return "";
}

export function WebFetchDisplay({ params, output, isCompact = false }: { params: WebFetchParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const target = targetFromParams(params);
  const isQueryOnly = !params.url?.trim() && !!params.query?.trim();
  const label = isQueryOnly ? "Searched" : "Fetched";

  const content = parseWebFetchOutput(output);
  const hasContent = !!content;

  return (
    <div>
      <ToolHeader
        icon={<Web className="size-3.5" />}
        verb={label}
        hasDetails={hasContent}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        <code className="text-primary-500 font-sans truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {truncateUrl(target)}
        </code>
        {typeof params.max_length === "number" && (
          <span className="text-primary-500 shrink-0 group-hover:text-primary-950 group-hover:dark:text-primary">(max {params.max_length})</span>
        )}
      </ToolHeader>

      {hasContent && (
        <ToolCollapse isExpanded={isExpanded}>
          <pre className="noscrollbar text-s font-mono text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
            {content}
          </pre>
        </ToolCollapse>
      )}
    </div>
  );
}

function parseWebFetchOutput(output: unknown): string | null {
  if (!output) return null;

  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output);
      if (typeof parsed === "object" && parsed !== null) {
        return (parsed as Record<string, unknown>).content as string ?? JSON.stringify(parsed, null, 2);
      }
      return output;
    } catch {
      // Codex: "Searched: https://..."; plain text results
      return output;
    }
  }

  if (typeof output === "object" && output !== null) {
    const obj = output as Record<string, unknown>;
    if (typeof obj.content === "string") return obj.content;
    return JSON.stringify(obj, null, 2);
  }

  return null;
}

function truncateUrl(url: string): string {
  if (url.length <= 60) return url;
  try {
    const u = new URL(url);
    const path = u.pathname.length > 30 ? u.pathname.slice(0, 27) + "..." : u.pathname;
    return u.host + path;
  } catch {
    return url.slice(0, 57) + "...";
  }
}
