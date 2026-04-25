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
    <div className="">
      <button
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-primary-400 dark:text-primary-500 text-s font-sans ${hasContent ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && <Mains className="size-3.5 text-primary-400 dark:text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary" />}
        {!isCompact && (
          <span className="text-primary-400 dark:text-primary-500 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            GetDiff
          </span>
        )}
        {stats && (
          <span className="flex items-center gap-1.5 text-primary-400 dark:text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
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
          <span className="text-primary-400 dark:text-primary-500 truncate text-xs font-mono group-hover:text-primary-950 group-hover:dark:text-primary">
            {files.length <= 3 ? files.map(shortName).join(", ") : `${shortName(files[0])} +${files.length - 1}`}
          </span>
        )}
        {!stats && !files?.length && (
          <span className="text-primary-400 dark:text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
            {params.runId ? `run: ${params.runId.slice(0, 8)}` : "workspace diff"}
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
              <pre className="noscrollbar text-s font-mono text-primary-600 dark:text-primary-400 whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-64 overflow-y-auto">
                {diffText}
              </pre>
            </div>
          </div>
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
