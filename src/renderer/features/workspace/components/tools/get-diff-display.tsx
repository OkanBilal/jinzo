import { useState } from "react";
import { ArrowUp, Mains } from "@/components/ui/icons";

export interface GetDiffParams {
  runId?: string;
}

interface DiffStats {
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
}

export function GetDiffDisplay({
  params,
  output,
  isCompact = false,
}: {
  params: GetDiffParams;
  output?: unknown;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { diffText, files, stats } = parseDiffOutput(output);
  const hasContent = !!diffText;

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
        {!isCompact && <Mains className="w-2 h-4 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            GetDiff
          </span>
        )}
        {stats && (
          <span className="flex items-center gap-1.5 text-primary-400 dark:text-primary-500">
            {stats.filesChanged != null && (
              <span>{stats.filesChanged} file{stats.filesChanged !== 1 ? "s" : ""}</span>
            )}
            {stats.insertions != null && (
              <span className="text-green-500">+{stats.insertions}</span>
            )}
            {stats.deletions != null && (
              <span className="text-red-400">-{stats.deletions}</span>
            )}
          </span>
        )}
        {files && files.length > 0 && (
          <span className="text-primary-500 truncate text-xs font-mono">
            {files.length <= 3 ? files.map(shortName).join(", ") : `${shortName(files[0])} +${files.length - 1}`}
          </span>
        )}
        {!stats && !files?.length && (
          <span className="text-primary-500 truncate">
            {params.runId ? `run: ${params.runId.slice(0, 8)}` : "workspace diff"}
          </span>
        )}
      </button>

      {isExpanded && hasContent && (
        <div className="mt-2 ml-5 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          <pre className="noscrollbar text-s font-mono text-primary-600 dark:text-primary-400 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded p-2 max-h-64 overflow-y-auto">
            {diffText}
          </pre>
        </div>
      )}
    </div>
  );
}

function parseDiffOutput(output: unknown): {
  diffText: string | null;
  files: string[] | null;
  stats: DiffStats | null;
} {
  if (!output) return { diffText: null, files: null, stats: null };

  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { diffText: parsed as string, files: null, stats: null };
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const diffText = typeof obj.diffText === "string" ? obj.diffText : null;
    const files = Array.isArray(obj.files) ? (obj.files as string[]) : null;
    const stats =
      typeof obj.stats === "object" && obj.stats !== null
        ? (obj.stats as DiffStats)
        : null;
    return { diffText, files, stats };
  }

  return { diffText: null, files: null, stats: null };
}

function shortName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}
