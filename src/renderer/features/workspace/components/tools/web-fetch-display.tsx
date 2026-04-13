import { useState } from "react";
import { ArrowUp, Web } from "@/components/ui/icons";

export interface WebFetchParams {
  url?: string;
  max_length?: number;
}

export function WebFetchDisplay({ params, output, isCompact = false }: { params: WebFetchParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const content = parseWebFetchOutput(output);
  const hasContent = !!content;

  return (
    <div className="px-2">
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasContent && (
        <ArrowUp
          className={`size-3 text-primary-800  dark:text-primary-300 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        )}
        {!isCompact && <Web className="size-4 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            WebFetch
          </span>
        )}
        <code className="text-primary-500 font-mono text-xs truncate">
          {truncateUrl(params.url || "")}
        </code>
      </button>

      {isExpanded && hasContent && (
        <div className="mt-2 ml-5 space-y-1 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          <pre className="noscrollbar text-s font-mono text-primary-600 dark:text-primary-400 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded p-2 max-h-48 overflow-y-auto">
            {content}
          </pre>
        </div>
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
