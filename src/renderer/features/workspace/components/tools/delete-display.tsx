import { useState } from "react";
import { ArrowUp, Trash } from "@/components/ui/icons";

/** Cursor ACP / agent delete file tool — often mirrors edit-style fields with empty `new_string`. */
export interface DeleteParams {
  file_path?: string;
  path?: string;
  old_string?: string;
  new_string?: string;
  _title?: string;
}

function shortPathDisplay(fullPath: string): string {
  const parts = fullPath.split("/");
  return parts.length > 3 ? "" + parts.slice(-1).join("/") : fullPath;
}

function pathFromOutput(output: unknown): string | undefined {
  if (!output) return undefined;
  let o: unknown = output;
  if (typeof o === "string") {
    try {
      o = JSON.parse(o);
    } catch {
      return undefined;
    }
  }
  if (typeof o === "object" && o !== null) {
    const r = o as Record<string, unknown>;
    if (typeof r.file_path === "string") return r.file_path;
    if (typeof r.path === "string") return r.path;
    if (typeof r.old_string === "string" && (r.old_string as string).includes("/")) {
      return r.old_string as string;
    }
  }
  return undefined;
}

function resolveFilePath(params: DeleteParams, output?: unknown): string {
  return (
    params.file_path ??
    params.path ??
    (typeof params.old_string === "string" && params.old_string.trim().length > 0
      ? params.old_string
      : undefined) ??
    pathFromOutput(output) ??
    ""
  );
}

export function DeleteDisplay({
  params,
  output,
  isCompact = false,
}: {
  params: DeleteParams;
  output?: unknown;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const fullPath = resolveFilePath(params, output);
  const displayPath = shortPathDisplay(fullPath);
  const canExpand = fullPath.length > 0 && fullPath !== displayPath;

  return (
    <div className="">
      <button
        type="button"
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-s font-sans ${canExpand ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && (
          <Trash className="size-3.5 shrink-0 text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary" />
        )}
        {!isCompact && (
          <span className="text-primary-500 dark:text-primary-300 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            Deleted
          </span>
        )}
        <code className="text-primary-500 font-sans truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {displayPath || fullPath || "file"}
        </code>
        {canExpand && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {canExpand && (
        <div
          className={`grid transition-all duration-200 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <pre className="noscrollbar text-xs font-mono text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto break-all">
              {fullPath}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
