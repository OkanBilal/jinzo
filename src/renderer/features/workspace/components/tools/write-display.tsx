import { useMemo, useState } from "react";
import { ArrowUp, Edit } from "@/components/ui/icons";
import { PatchDiff } from "@pierre/diffs/react";

export interface WriteParams {
  file_path?: string;
  path?: string;
  content?: string;
}

interface StructuredHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

function extractDetailedContent(output: unknown): string | undefined {
  if (!output) return undefined;
  let parsed = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return undefined;
    }
  }
  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.content === "string") return obj.content;
    if (typeof obj.detailedContent === "string") return obj.detailedContent;
  }
  return undefined;
}

function parseStructuredPatchOutput(output: unknown): {
  hunks: StructuredHunk[];
  outputFilePath?: string;
} | null {
  if (!output) return null;
  let parsed: unknown = output;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const sp = obj.structuredPatch;
  if (!Array.isArray(sp) || sp.length === 0) return null;

  const hunks: StructuredHunk[] = [];
  for (const h of sp) {
    if (typeof h !== "object" || h === null) continue;
    const hunk = h as Record<string, unknown>;
    const lines = hunk.lines;
    if (!Array.isArray(lines)) continue;
    hunks.push({
      oldStart: Number(hunk.oldStart) || 0,
      oldLines: Number(hunk.oldLines) || 0,
      newStart: Number(hunk.newStart) || 0,
      newLines: Number(hunk.newLines) || 0,
      lines: lines.map((l) => (typeof l === "string" ? l : String(l))),
    });
  }
  if (hunks.length === 0) return null;

  return {
    hunks,
    outputFilePath: typeof obj.filePath === "string" ? obj.filePath : undefined,
  };
}

function hunkLineToUnified(line: string): string {
  if (line.startsWith("-")) return line;
  if (line.startsWith("+")) return line;
  return line === "" ? " " : ` ${line}`;
}

function structuredPatchToUnifiedDiff(hunks: StructuredHunk[], fileName: string): string {
  const parts = [`--- a/${fileName}`, `+++ b/${fileName}`];
  for (const h of hunks) {
    parts.push(`@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`);
    for (const line of h.lines) {
      parts.push(hunkLineToUnified(line));
    }
  }
  return parts.join("\n");
}

function countStructuredPatchChanges(hunks: StructuredHunk[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const h of hunks) {
    for (const line of h.lines) {
      if (line.startsWith("+")) added++;
      else if (line.startsWith("-")) removed++;
    }
  }
  return { added, removed };
}

export function WriteDisplay({ params, output }: { params: WriteParams; output?: unknown }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDarkMode = document.documentElement.classList.contains("dark");

  const parsedPatch = useMemo(() => parseStructuredPatchOutput(output), [output]);

  const filePath =
    params.file_path ??
    params.path ??
    parsedPatch?.outputFilePath ??
    "";
  const content =
    params.content ?? extractDetailedContent(output) ?? "";
  const fileName = filePath.split("/").pop() || filePath || "file";

  const { unifiedDiff, added, removed, lineCount, hasDiff } = useMemo(() => {
    if (parsedPatch) {
      const { added: a, removed: r } = countStructuredPatchChanges(parsedPatch.hunks);
      return {
        unifiedDiff: structuredPatchToUnifiedDiff(parsedPatch.hunks, fileName),
        added: a,
        removed: r,
        lineCount: 0,
        hasDiff: true,
      };
    }
    if (!content) {
      return { unifiedDiff: "", added: 0, removed: 0, lineCount: 0, hasDiff: false };
    }
    const lines = content.split("\n");
    return {
      unifiedDiff: [
        `--- /dev/null`,
        `+++ b/${fileName}`,
        `@@ -0,0 +1,${lines.length} @@`,
        ...lines.map((l) => `+${l}`),
      ].join("\n"),
      added: lines.length,
      removed: 0,
      lineCount: lines.length,
      hasDiff: true,
    };
  }, [parsedPatch, content, fileName]);

  return (
    <div className="">
      <button
        onClick={() => hasDiff && setIsExpanded(!isExpanded)}
        className={`group w-full flex items-center gap-1 py-1  text-s font-sans ${hasDiff ? "cursor-pointer" : "cursor-default"}`}
      >
        <Edit className="size-3.5 text-primary-500 dark:text-primary-300 group-hover:text-primary-950 group-hover:dark:text-primary" />
        <span className="text-primary-500 dark:text-primary-300 font-medium group-hover:text-primary-950 group-hover:dark:text-primary">
          Edited
        </span>
        <span className="text-primary-500 truncate group-hover:text-primary-950 group-hover:dark:text-primary">
          {fileName}
        </span>
        {parsedPatch ? (
          (added > 0 || removed > 0) && (
            <span className="text-primary-500 text-xs shrink-0 group-hover:text-primary-950 group-hover:dark:text-primary">
              {added > 0 && (
                <span className="text-green-600 dark:text-green-400">+{added}</span>
              )}
              {added > 0 && removed > 0 && " "}
              {removed > 0 && (
                <span className="text-red-500 dark:text-red-400">-{removed}</span>
              )}
            </span>
          )
        ) : (
          lineCount > 0 && (
            <span className="text-green-600 text-xs shrink-0">
              +{lineCount}
            </span>
          )
        )}
        {hasDiff && (
          <ArrowUp
            className={`size-3.5 shrink-0 text-primary-500 opacity-0 transition-all duration-200 group-hover:text-primary-950 group-hover:dark:text-primary group-hover:opacity-100 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
      </button>

      {unifiedDiff && (
        <div className={`grid transition-all duration-200 rounded-md border border-primary-200/50 dark:border-primary-700/30 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">
            <div className=" max-h-80 overflow-y-auto noscrollbar p-0.5">
              <PatchDiff
                patch={unifiedDiff}
                style={{ "--diffs-font-size": "12px", "--diffs-font-family": "'Geist Mono', monospace" } as React.CSSProperties}
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
