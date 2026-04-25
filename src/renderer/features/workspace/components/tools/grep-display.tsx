import { useState } from "react";
import { ArrowUp, Grep } from "@/components/ui/icons";

export interface GrepParams {
  pattern?: string;
  query?: string;
  regex?: string;
  path?: string;
  output_mode?: string;
  glob?: string;
  type?: string;
  include_pattern?: string;
  exclude_pattern?: string;
}

export function GrepDisplay({ params, output, isCompact = false }: { params: GrepParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { content, numFiles, numLines, totalMatches, truncated } = parseGrepOutput(output);
  const hasContent = !!content;
  const showLines = numLines > 0 && (totalMatches <= 0 || numLines !== totalMatches);
  const hasStats =
    numFiles > 0 || showLines || totalMatches > 0 || truncated;

  return (
    <div className="">
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-primary-400 dark:text-primary-500 text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && <Grep className="size-4 text-primary-400 dark:text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary" />}
        {!isCompact && (
          <span className="text-primary-400 dark:text-primary-500 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            Grep
          </span>
        )}
        <code className="text-primary-400 dark:text-primary-500 font-mono text-xs truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {params.pattern || params.query || params.regex || ""}
        </code>
        {hasStats && (
          <span className="text-primary-400 dark:text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
            ({[
              totalMatches > 0 ? `${totalMatches} matches` : null,
              showLines ? `${numLines} lines` : null,
              numFiles > 0 ? `${numFiles} files` : null,
              truncated ? "truncated" : null,
            ].filter(Boolean).join(", ")})
          </span>
        )}
        {hasContent && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-400 dark:text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasContent && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className=" ">
              <pre className="noscrollbar text-xs font-mono text-primary-600 dark:text-primary-400 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
                {content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseGrepOutput(output: unknown): {
  content: string | null;
  numFiles: number;
  numLines: number;
  totalMatches: number;
  truncated: boolean;
} {
  const empty = { content: null, numFiles: 0, numLines: 0, totalMatches: 0, truncated: false };
  if (!output) return empty;

  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {
        content: parsed as string,
        numFiles: 0,
        numLines: (parsed as string).split("\n").length,
        totalMatches: 0,
        truncated: false,
      };
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const content = typeof obj.content === "string" ? obj.content : null;
    const numFiles =
      typeof obj.numFiles === "number"
        ? obj.numFiles
        : typeof obj.totalFiles === "number"
          ? obj.totalFiles
          : 0;
    const numLines = typeof obj.numLines === "number" ? obj.numLines : 0;
    const totalMatches = typeof obj.totalMatches === "number" ? obj.totalMatches : 0;
    const truncated = obj.truncated === true;
    const filenames = Array.isArray(obj.filenames) ? obj.filenames as string[] : [];

    // If mode is files_with_matches and we have filenames, show them as content
    if (!content && filenames.length > 0) {
      return {
        content: filenames.map(f => shortPath(f)).join("\n"),
        numFiles: filenames.length,
        numLines,
        totalMatches,
        truncated,
      };
    }

    return { content, numFiles: numFiles || filenames.length, numLines, totalMatches, truncated };
  }

  return empty;
}

function shortPath(fullPath: string): string {
  const parts = fullPath.split("/");
  return parts.length > 3 ? ".../" + parts.slice(-3).join("/") : fullPath;
}
