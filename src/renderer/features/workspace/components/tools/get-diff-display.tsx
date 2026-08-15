import { useState } from "react";
import { Text } from "@/components/ui";
import { Mains } from "@/components/ui/icons";
import { TOOL_ROW_TEXT, ToolCollapse, ToolHeader } from "./_shared";
import { coerceToolOutput } from "../../lib/parse-tool-content";

export interface GetDiffParams {
  runId?: string;
}

interface DiffStats {
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
  shortstat?: string;
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
    <div>
      <ToolHeader
        icon={<Mains className="size-4" />}
        verb="Checked diff"
        hasDetails={hasContent}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded((v) => !v)}
        isCompact={isCompact}
      >
        {files && files.length > 0 && (
          <span className={`truncate ${TOOL_ROW_TEXT}`}>
            {files.length <= 3 ? files.map(shortName).join(", ") : `${shortName(files[0])} +${files.length - 1}`}
          </span>
        )}
        {!stats && !files?.length && (
          <span className={`truncate ${TOOL_ROW_TEXT}`}>
            {params.runId ? `run: ${params.runId.slice(0, 8)}` : "workspace diff"}
          </span>
        )}
      </ToolHeader>

      {hasContent && (
        <ToolCollapse isExpanded={isExpanded}>
          <Text as="pre" size="s" tone="contrast" className="noscrollbar font-mono whitespace-pre-wrap bg-primary-50 dark:bg-primary/5 rounded-md p-2 max-h-64 overflow-y-auto">
            {diffText}
          </Text>
        </ToolCollapse>
      )}
    </div>
  );
}

/**
 * Agent tool output is sometimes a content array, e.g.
 * `[{ "type": "text", "text": "{ \"diffText\": \"...\", \"files\": [...], \"stats\": {...} }" }]`
 */
function tryExtractWorkspaceDiffPayload(output: unknown): unknown | undefined {
  if (!Array.isArray(output)) return undefined;
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (rec.type === "text" && typeof rec.text === "string") {
      try {
        const inner = JSON.parse(rec.text) as unknown;
        if (
          inner !== null &&
          typeof inner === "object" &&
          ("diffText" in (inner as object) || "files" in (inner as object))
        ) {
          return inner;
        }
      } catch {
        /* next */
      }
    }
    if ("diffText" in rec || ("files" in rec && "stats" in rec)) {
      return item;
    }
  }
  return undefined;
}

function normalizeStats(raw: unknown): DiffStats | null {
  if (raw === null || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const out: DiffStats = {};

  if (typeof s.filesChanged === "number") out.filesChanged = s.filesChanged;
  else if (typeof s.files === "number") out.filesChanged = s.files;
  if (typeof s.insertions === "number") out.insertions = s.insertions;
  if (typeof s.deletions === "number") out.deletions = s.deletions;
  if (typeof s.shortstat === "string") {
    out.shortstat = s.shortstat;
    if (out.filesChanged == null) {
      const mFiles = /(\d+)\s+files?\s+changed/.exec(s.shortstat);
      if (mFiles) out.filesChanged = Number(mFiles[1]);
    }
    if (out.insertions == null) {
      const mIns = /(\d+)\s+insertions?\(\+\)/.exec(s.shortstat);
      if (mIns) out.insertions = Number(mIns[1]);
    }
    if (out.deletions == null) {
      const mDel = /(\d+)\s+deletions?\(-\)/.exec(s.shortstat);
      if (mDel) out.deletions = Number(mDel[1]);
    }
  }

  return Object.keys(out).length > 0 ? out : null;
}

function parseDiffOutput(output: unknown): {
  diffText: string | null;
  files: string[] | null;
  stats: DiffStats | null;
} {
  if (!output) return { diffText: null, files: null, stats: null };

  const extracted = tryExtractWorkspaceDiffPayload(output);
  let parsed: unknown = extracted !== undefined ? extracted : output;

  if (Array.isArray(parsed) && extracted === undefined) {
    return { diffText: null, files: null, stats: null };
  }

  parsed = coerceToolOutput(parsed);
  if (typeof parsed === "string") {
    return { diffText: parsed, files: null, stats: null };
  }

  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const diffText = typeof obj.diffText === "string" ? obj.diffText : null;
    const files = Array.isArray(obj.files) ? (obj.files as string[]) : null;
    const stats = normalizeStats(obj.stats);
    return { diffText, files, stats };
  }

  return { diffText: null, files: null, stats: null };
}

function shortName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}
