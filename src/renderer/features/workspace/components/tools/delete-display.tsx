import { useState } from "react";
import { Trash } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse } from "./_shared";

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
    <div>
      <ToolHeader
        icon={<Trash className="size-3.5" />}
        verb="Deleted"
        hasDetails={canExpand}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        <code className="text-primary-500 font-sans truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {displayPath || fullPath || "file"}
        </code>
      </ToolHeader>

      {canExpand && (
        <ToolCollapse isExpanded={isExpanded}>
          <pre className="noscrollbar text-xs font-mono text-primary-950 dark:text-primary whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-48 overflow-y-auto break-all">
            {fullPath}
          </pre>
        </ToolCollapse>
      )}
    </div>
  );
}
