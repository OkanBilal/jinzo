import { useState } from "react";
import { ArrowUp, Grep } from "@/components/ui/icons";

export interface GrepParams {
  pattern?: string;
  path?: string;
  output_mode?: string;
  glob?: string;
  type?: string;
}

export function GrepDisplay({ params, output, isCompact = false }: { params: GrepParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { content, numFiles, numLines } = parseGrepOutput(output);
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
        {!isCompact && <Grep className="size-4 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            Grep
          </span>
        )}
        <code className="text-primary-500 font-mono text-xs truncate">
          {params.pattern || "?"}
        </code>
        {(numFiles > 0 || numLines > 0) && (
          <span className="text-primary-400 dark:text-primary-500">
            ({numLines} lines{numFiles > 0 ? `, ${numFiles} files` : ""})
          </span>
        )}
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

function parseGrepOutput(output: unknown): { content: string | null; numFiles: number; numLines: number } {
  if (!output) return { content: null, numFiles: 0, numLines: 0 };

  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { content: parsed as string, numFiles: 0, numLines: (parsed as string).split("\n").length };
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const content = typeof obj.content === "string" ? obj.content : null;
    const numFiles = typeof obj.numFiles === "number" ? obj.numFiles : 0;
    const numLines = typeof obj.numLines === "number" ? obj.numLines : 0;
    const filenames = Array.isArray(obj.filenames) ? obj.filenames as string[] : [];

    // If mode is files_with_matches and we have filenames, show them as content
    if (!content && filenames.length > 0) {
      return {
        content: filenames.map(f => shortPath(f)).join("\n"),
        numFiles: filenames.length,
        numLines,
      };
    }

    return { content, numFiles: numFiles || filenames.length, numLines };
  }

  return { content: null, numFiles: 0, numLines: 0 };
}

function shortPath(fullPath: string): string {
  const parts = fullPath.split("/");
  return parts.length > 3 ? ".../" + parts.slice(-3).join("/") : fullPath;
}
