import { useMemo, useState } from "react";
import { ArrowUp, Edit } from "@/components/ui/icons";
import { PatchDiff } from "@pierre/diffs/react";

export interface EditParams {
  // Claude params
  file_path?: string;
  old_string?: string;
  new_string?: string;
  replace_all?: boolean;
  // Copilot params
  path?: string;
  old_str?: string;
  new_str?: string;
}

interface DiffLine {
  type: "add" | "remove" | "context";
  text: string;
}

export function EditDisplay({
  params,
  output,
  isCompact = false,
}: {
  params: EditParams;
  output?: unknown;
  isCompact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDarkMode = document.documentElement.classList.contains("dark");

  const filePath = params.file_path ?? params.path ?? "";
  const fileName = filePath.split("/").pop() || filePath;
  const {
    lines: patchLines,
    added,
    removed,
  } = useMemo(() => parsePatch(output, params), [output, params]);
  const hasDiff = patchLines.length > 0;

  const unifiedDiff = useMemo(() => {
    if (!hasDiff) return "";
    return buildUnifiedDiff(patchLines, fileName);
  }, [patchLines, hasDiff, fileName]);

  return (
    <div className="">
      <button
        onClick={() => hasDiff && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1 text-primary-400 dark:text-primary-500 text-s font-sans ${hasDiff ? "cursor-pointer" : "cursor-default"}`}
      >
        {!isCompact && (
          <Edit className="size-4 text-primary-400 dark:text-primary-500 group-hover:text-primary-950 group-hover:dark:text-primary" />
        )}
        {!isCompact && (
          <span className="text-primary-400 dark:text-primary-500 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
            Edit
          </span>
        )}
        <span className="text-primary-400 dark:text-primary-500 font-medium truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {fileName}
        </span>
        {(added > 0 || removed > 0) && (
          <span className="text-primary-400 dark:text-primary-500 text-xs shrink-0 group-hover:text-primary-950 group-hover:dark:text-primary">
            {added > 0 && (
              <span className="text-green-600 dark:text-green-400">
                +{added}
              </span>
            )}
            {added > 0 && removed > 0 && " "}
            {removed > 0 && (
              <span className="text-red-500 dark:text-red-400">-{removed}</span>
            )}
          </span>
        )}
        {hasDiff && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-800 dark:text-primary-300 opacity-0 transition-all duration-200 group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {hasDiff && (
        <div
          className={`grid transition-all duration-200 rounded-md  border border-primary-200/50 dark:border-primary-700/30 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className=" max-h-80 overflow-y-auto noscrollbar p-0.5">
              <PatchDiff
                patch={unifiedDiff}
                style={
                  {
                    "--diffs-font-size": "12px",
                    "--diffs-font-family": "'Geist Mono', monospace",
                  } as React.CSSProperties
                }
                options={{
                  theme: isDarkMode ? "pierre-dark" : "pierre-light",
                  themeType: isDarkMode ? "dark" : "light",
                  diffStyle: "unified",
                  overflow: "wrap",
                  disableFileHeader: true,
                  unsafeCSS: `:host, [data-diffs], [data-diffs-header], [data-error-wrapper], [data-line], [data-column-number], [data-code] { --diffs-bg: var(--color-${isDarkMode ? "primary-950" : "primary"}); background-color: var(--color-${isDarkMode ? "primary-950" : "primary"}); }`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildUnifiedDiff(lines: DiffLine[], fileName: string): string {
  const oldCount = lines.filter((l) => l.type !== "add").length;
  const newCount = lines.filter((l) => l.type !== "remove").length;
  const hunkLines = lines.map((l) =>
    l.type === "add"
      ? `+${l.text}`
      : l.type === "remove"
        ? `-${l.text}`
        : ` ${l.text}`,
  );
  return [
    `--- a/${fileName}`,
    `+++ b/${fileName}`,
    `@@ -1,${oldCount} +1,${newCount} @@`,
    ...hunkLines,
  ].join("\n");
}

function parsePatch(
  output: unknown,
  params: EditParams,
): { lines: DiffLine[]; added: number; removed: number } {
  // Try structuredPatch from output first (Claude)
  const patch = extractPatchLines(output);
  if (patch.length > 0) {
    return parsePatchLines(patch);
  }

  // Try detailedContent unified diff from output (Copilot)
  const unifiedLines = extractUnifiedDiff(output);
  if (unifiedLines.length > 0) {
    return parsePatchLines(unifiedLines);
  }

  // Fallback: build diff from old_string/new_string (Claude) or old_str/new_str (Copilot)
  const oldStr = params.old_string ?? params.old_str;
  const newStr = params.new_string ?? params.new_str;
  if (oldStr || newStr) {
    const oldLines = (oldStr || "").split("\n");
    const newLines = (newStr || "").split("\n");
    const lines: DiffLine[] = [];
    for (const l of oldLines) lines.push({ type: "remove", text: l });
    for (const l of newLines) lines.push({ type: "add", text: l });
    return { lines, added: newLines.length, removed: oldLines.length };
  }

  return { lines: [], added: 0, removed: 0 };
}

function extractPatchLines(output: unknown): string[] {
  if (!output) return [];

  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const sp = obj.structuredPatch;
    if (Array.isArray(sp)) {
      const allLines: string[] = [];
      for (const hunk of sp) {
        if (
          typeof hunk === "object" &&
          hunk !== null &&
          Array.isArray((hunk as any).lines)
        ) {
          allLines.push(...(hunk as any).lines);
        }
      }
      return allLines;
    }
  }

  return [];
}

function extractUnifiedDiff(output: unknown): string[] {
  if (!output) return [];

  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.detailedContent === "string") {
      // Parse unified diff — skip header lines (---, +++, @@) and keep +/-/context lines
      return obj.detailedContent.split("\n").filter((l) => {
        if (
          l.startsWith("diff ") ||
          l.startsWith("index ") ||
          l.startsWith("--- ") ||
          l.startsWith("+++ ") ||
          l.startsWith("@@")
        )
          return false;
        if (l === "") return false;
        return true;
      });
    }
  }

  return [];
}

function parsePatchLines(raw: string[]): {
  lines: DiffLine[];
  added: number;
  removed: number;
} {
  const lines: DiffLine[] = [];
  let added = 0;
  let removed = 0;

  for (const l of raw) {
    if (l.startsWith("+")) {
      lines.push({ type: "add", text: l.slice(1) });
      added++;
    } else if (l.startsWith("-")) {
      lines.push({ type: "remove", text: l.slice(1) });
      removed++;
    } else {
      lines.push({ type: "context", text: l.startsWith(" ") ? l.slice(1) : l });
    }
  }

  return { lines, added, removed };
}
