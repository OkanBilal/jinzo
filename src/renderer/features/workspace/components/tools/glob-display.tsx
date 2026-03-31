import { useState } from "react";
import { ArrowUp, Glob } from "@/components/ui/icons";

export interface GlobParams {
  pattern?: string;
  path?: string;
}

export function GlobDisplay({ params, output, isCompact = false }: { params: GlobParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { filenames, numFiles } = parseGlobOutput(output);
  const hasFiles = filenames.length > 0;

  return (
    <div className="px-2">
      <button
        onClick={() => hasFiles && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans ${hasFiles ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasFiles && (
        <ArrowUp
          className={`size-3 text-primary-800  dark:text-primary-300 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
        />
        )}
        {!isCompact && <Glob className="size-4 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            Glob
          </span>
        )}
        <code className="text-primary-500 font-mono text-xs">
          {params.pattern || "?"}
        </code>
        {numFiles > 0 && (
          <span className="text-primary-400 dark:text-primary-500">
            ({numFiles} files)
          </span>
        )}
      </button>

      {isExpanded && hasFiles && (
        <div className="mt-2 ml-5 space-y-1 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          <div className="noscrollbar text-s font-mono text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary/5 rounded p-2 max-h-48 overflow-y-auto">
            {filenames.map((f) => (
              <div key={f} className="truncate">{shortPath(f)}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function parseGlobOutput(output: unknown): { filenames: string[]; numFiles: number } {
  if (!output) return { filenames: [], numFiles: 0 };

  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { filenames: [], numFiles: 0 };
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const filenames = Array.isArray(obj.filenames) ? obj.filenames as string[] : [];
    const numFiles = typeof obj.numFiles === "number" ? obj.numFiles : filenames.length;
    return { filenames, numFiles };
  }

  return { filenames: [], numFiles: 0 };
}

function shortPath(fullPath: string): string {
  const parts = fullPath.split("/");
  return parts.length > 3 ? ".../" + parts.slice(-3).join("/") : fullPath;
}
