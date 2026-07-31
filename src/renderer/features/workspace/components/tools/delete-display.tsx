import { useState } from "react";
import { Trash } from "@/components/ui/icons";
import { ToolHeader, ToolCollapse, ToolOutputBody } from "./_shared";
import { coerceToolOutput } from "../../utils/parse-tool-content";
import { shortFileName } from "../../utils/path-utils";

/** Cursor ACP / agent delete file tool — often mirrors edit-style fields with empty `new_string`. */
export interface DeleteParams {
  file_path?: string;
  path?: string;
  old_string?: string;
  new_string?: string;
  _title?: string;
}

function pathFromOutput(output: unknown): string | undefined {
  const o = coerceToolOutput(output);
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
  const displayPath = shortFileName(fullPath);
  const canExpand = fullPath.length > 0 && fullPath !== displayPath;

  return (
    <div>
      <ToolHeader
        icon={<Trash className="size-4" />}
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
          <ToolOutputBody className="text-xs font-mono whitespace-pre-wrap break-all">
            {fullPath}
          </ToolOutputBody>
        </ToolCollapse>
      )}
    </div>
  );
}
