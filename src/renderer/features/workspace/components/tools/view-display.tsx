import { useState } from "react";
import { ArrowUp, Read } from "@/components/ui/icons";

export interface ViewParams {
  path?: string;
}

export function ViewDisplay({ params, output, isCompact = false }: { params: ViewParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { content, numLines } = parseViewOutput(output);
  const hasContent = !!content;
  const filePath = params.path ?? "";
  const fileName = filePath.split("/").pop() || filePath;

  return (
    <div className="px-2">
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasContent && (
          <ArrowUp
            className={`size-3 text-primary-500 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
        {!isCompact && <Read className="size-4 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            View
          </span>
        )}
        {numLines > 0 && (
          <span className="text-primary-400 dark:text-primary-500">
            {numLines} lines
          </span>
        )}
        <span className="text-primary-700 dark:text-primary-200 font-medium truncate">
          {fileName}
        </span>
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

function parseViewOutput(output: unknown): { content: string | null; numLines: number } {
  if (!output) return { content: null, numLines: 0 };

  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { content: parsed as string, numLines: (parsed as string).split("\n").filter(l => l.length > 0).length };
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const content = typeof obj.content === "string" ? obj.content : null;
    const numLines = content ? content.split("\n").filter(l => l.length > 0).length : 0;
    return { content, numLines };
  }

  return { content: null, numLines: 0 };
}
