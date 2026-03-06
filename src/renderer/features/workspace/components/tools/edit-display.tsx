import { useMemo, useState } from "react";
import { ArrowUp, Edit } from "@/components/ui/icons";

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

export function EditDisplay({ params, output, isCompact = false }: { params: EditParams; output?: unknown; isCompact?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const filePath = params.file_path ?? params.path ?? "";
  const fileName = filePath.split("/").pop() || filePath;
  const { lines: patchLines, added, removed } = useMemo(() => parsePatch(output, params), [output, params]);
  const hasDiff = patchLines.length > 0;

  return (
    <div className="px-2">
      <button
        onClick={() => hasDiff && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 py-0.5 hover:bg-primary-50 dark:hover:bg-primary/5 rounded text-s font-sans ${hasDiff ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasDiff && (
          <ArrowUp
            className={`size-3 text-primary-500 transition-all duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
          />
        )}
        {!isCompact && <Edit className="size-4 dark:text-primary-300 text-primary-700" />}
        {!isCompact && (
          <span className="dark:text-primary-300 text-primary-700 font-medium">
            Edit
          </span>
        )}
        <span className="text-primary-700 dark:text-primary-200 font-medium truncate">
          {fileName}
        </span>
        {(added > 0 || removed > 0) && (
          <span className="text-primary-500 text-xs shrink-0">
            {added > 0 && <span className="text-green-600 dark:text-green-400">+{added}</span>}
            {added > 0 && removed > 0 && " "}
            {removed > 0 && <span className="text-red-500 dark:text-red-400">-{removed}</span>}
          </span>
        )}
      </button>

      {isExpanded && hasDiff && (
        <div className="mt-2 ml-5 border-l border-primary-200/50 dark:border-primary-700/30 pl-3">
          <div className="noscrollbar text-xs leading-relaxed font-mono bg-primary-50 dark:bg-primary/3 rounded-xl p-3 max-h-80 overflow-y-auto">
            {patchLines.map((line, lineNum) => (
              <div
                key={`${lineNum}:${line.type}`}
                className={
                  line.type === "add"
                    ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
                    : line.type === "remove"
                      ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
                      : "text-primary-600 dark:text-primary-400"
                }
              >
                {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function parsePatch(output: unknown, params: EditParams): { lines: DiffLine[]; added: number; removed: number } {
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
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    const sp = obj.structuredPatch;
    if (Array.isArray(sp)) {
      const allLines: string[] = [];
      for (const hunk of sp) {
        if (typeof hunk === "object" && hunk !== null && Array.isArray((hunk as any).lines)) {
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
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.detailedContent === "string") {
      // Parse unified diff — skip header lines (---, +++, @@) and keep +/-/context lines
      return obj.detailedContent
        .split("\n")
        .filter((l) => {
          if (l.startsWith("diff ") || l.startsWith("index ") || l.startsWith("--- ") || l.startsWith("+++ ") || l.startsWith("@@")) return false;
          if (l === "") return false;
          return true;
        });
    }
  }

  return [];
}

function parsePatchLines(raw: string[]): { lines: DiffLine[]; added: number; removed: number } {
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
