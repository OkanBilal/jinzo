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
    <div className="">
      <button
        onClick={() => hasFiles && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-s font-sans ${hasFiles ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && <Glob className="size-4 text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary" />}
        {!isCompact && (
          <span className="text-primary-500 dark:text-primary-300 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            Searched
          </span>
        )}
        {numFiles > 0 && (
          <span className="text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary">
            {numFiles} files
          </span>
        )}
        <code className="text-primary-500 font-mono text-xs truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {params.pattern || "?"}
        </code>
        {hasFiles && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasFiles && (
        <div className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className="">
              <div className="noscrollbar text-xs font-mono text-primary-950 dark:text-primary bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto">
                {filenames.map((f) => (
                  <div key={f} className="truncate">{shortPath(f)}</div>
                ))}
              </div>
            </div>
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
