import { useMemo, useState, useEffect, useCallback } from "react";
import { useDispatch } from "react-redux";
import { PatchDiff, type DiffLineAnnotation } from "@pierre/diffs/react";
import {
  useGetReviewFindingsByWorkspaceQuery,
  useGetWorkspaceByIdQuery,
  useUpdateReviewFindingMutation,
} from "@/lib/redux/api";
import { setPendingGoal, setPendingAutoExecute } from "@/lib/redux/slices/workspaceSlice";
import { expandDiffForFindings } from "../utils/expand-diff";
import { normalizePatchForPatchDiff } from "../utils/patch-utils";
import { normalizePath, pathsMatch } from "../utils/path-utils";
import type { FileContentResponse, ServiceResponse } from "@/features/workspace/types/file-explorer";
import { ImagePreviewModal } from "./image-preview-modal";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

function isImagePath(filePath: string | undefined): boolean {
  if (!filePath) return false;
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

function localImageUrl(absPath: string): string {
  return `mains-localimg://img/?path=${encodeURIComponent(absPath)}`;
}

function ImageDiffView({ absPath, fileName }: { absPath: string; fileName: string }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = localImageUrl(absPath);

  return (
    <div className="h-full overflow-auto px-2  ">
      <div className="mx-auto ">
        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-300 break-all">
            <div className="font-medium mb-1">Image failed to load</div>
            <div className="opacity-70">{error}</div>
            <div className="mt-1 font-mono opacity-60">{absPath}</div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="block w-full overflow-hidden  cursor-pointer"
            title={absPath}
          >
            <img
              src={url}
              alt={fileName}
              className="w-full max-h-[70vh] object-contain"
              loading="lazy"
              onError={(e) => {
                setError(`Failed to load (src=${(e.currentTarget as HTMLImageElement).src})`);
              }}
            />
          </button>
        )}
        {previewOpen && (
          <ImagePreviewModal name={fileName} src={url} onClose={() => setPreviewOpen(false)} />
        )}
      </div>
    </div>
  );
}

interface Finding {
  id: string;
  lineStart: number | null;
  lineEnd: number | null;
  severity: string;
  file: string;
  message: string;
  reason: string;
  suggestion: string | null;
  isApproved: boolean;
}

interface FindingMeta {
  findings: Finding[];
}

interface DiffViewerProps {
  diffText: string;
  filename?: string;
  className?: string;
  workspaceId?: string;
  filePath?: string;
}

// ── Severity helpers ─────────────────────────────────────

type Severity = "critical" | "warning" | "info";

function asSeverity(s: string): Severity {
  if (s === "critical" || s === "warning" || s === "info") return s;
  return "info";
}

const severityColors: Record<Severity, { pill: string; pillBg: string; line: string }> = {
  critical: { pill: "#dc2626", pillBg: "#ef444426", line: "#ef444414" },
  warning: { pill: "#d97706", pillBg: "#f59e0b26", line: "#f59e0b14" },
  info: { pill: "#2563eb", pillBg: "#3b82f626", line: "#3b82f60f" },
};

const severityColorsDark: Record<Severity, { pill: string; pillBg: string; line: string }> = {
  critical: { pill: "#f44336", pillBg: "#f4433633", line: "#1a1a1a" },
  warning: { pill: "#fcd34d", pillBg: "#f59e0b33", line: "#1a1a1a" },
  info: { pill: "#93c5fd", pillBg: "#3b82f633", line: "#1a1a1a" },
};

// ── FindingAnnotation (module-scope) ─────────────────────

interface FindingAnnotationOptions {
  colors: Record<Severity, { pill: string; pillBg: string; line: string }>;
  textColor: string;
  mutedColor: string;
  suggestionColor: string;
  onApprove: (id: string) => void;
  onFix: (finding: Finding) => void;
}

function makeFindingAnnotation({ colors, textColor, mutedColor, suggestionColor, onApprove, onFix }: FindingAnnotationOptions) {
  return function FindingAnnotation({ metadata }: DiffLineAnnotation<FindingMeta>) {
    const { findings } = metadata!;

    return (
      <div className="finding-annotation" style={findings.length === 0 ? { display: "none" } : undefined}>
        {findings.map((f) => {
          const sev = asSeverity(f.severity);
          const c = colors[sev];
          return (
            <div
              key={`${sev}-${f.lineStart}-${f.message}`}
              className="finding-card py-2 my-2 mx-2 border-b last:border-b-0 dark:border-primary/10 border-primary/20"
              style={{ backgroundColor: c.line }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span
                    className="px-1 py-0.5 text-xxs rounded-sm capitalize mr-2"
                    style={{ backgroundColor: c.pillBg, color: c.pill }}
                  >
                    {sev}
                  </span>
                  <span className="finding-message" style={{ color: textColor }}>
                    {f.message}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onApprove(f.id)}
                    className="px-2 cursor-pointer py-0.5 text-xxs rounded-sm font-medium transition-colors"
                    style={{ backgroundColor: "#16a34a22", color: "#22c55e" }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => onFix(f)}
                    className="px-2 cursor-pointer py-0.5 text-xxs rounded-sm font-medium transition-colors"
                    style={{ backgroundColor: "#3b82f622", color: "#60a5fa" }}
                  >
                    Fix
                  </button>
                </div>
              </div>
              {f.reason && (
                <p className="finding-reason" style={{ color: mutedColor }}>
                  {f.reason}
                </p>
              )}
              {f.suggestion && (
                <p className="mt-2" style={{ color: suggestionColor }}>
                  <span className="">Suggestion: </span>
                  {f.suggestion}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };
}

// ── Component ─────────────────────────────────────────────

export function DiffViewer({
  diffText,
  className = "",
  workspaceId,
  filePath,
}: DiffViewerProps) {
  const isDarkMode = document.documentElement.classList.contains("dark");
  const dispatch = useDispatch();
  const [updateFinding] = useUpdateReviewFindingMutation();

  const { data: allFindings } = useGetReviewFindingsByWorkspaceQuery(
    { workspaceId: workspaceId! },
    { skip: !workspaceId },
  );

  const { data: workspace } = useGetWorkspaceByIdQuery(workspaceId!, { skip: !workspaceId });

  const fileFindings = useMemo(() => {
    if (!allFindings || !filePath) return [];
    const target = normalizePath(filePath);
    return allFindings.filter((f) => pathsMatch(normalizePath(f.file), target) && !f.isApproved);
  }, [allFindings, filePath]);

  // Keep the buffered source text keyed to the filePath it came from. Reading
  // at render time with `cache.path !== filePath` makes the previous file's
  // multi-MB split-lines array drop out automatically when the target
  // changes — no effect-setState churn and no stale retention.
  const [fileLinesCache, setFileLinesCache] = useState<{
    path: string | null;
    lines: string[] | null;
  }>({ path: null, lines: null });
  const fileLines =
    filePath && fileLinesCache.path === filePath ? fileLinesCache.lines : null;

  const findingLineNumbers = useMemo(
    () => fileFindings.map((f) => (f.lineStart != null && f.lineStart >= 1 ? f.lineStart : 1)),
    [fileFindings],
  );

  useEffect(() => {
    if (findingLineNumbers.length === 0 || !workspace?.rootPath || !filePath) return;

    let cancelled = false;
    window.api.fileExplorer
      .readFileText({ filePath: `${workspace.rootPath}/${filePath}`, workspaceRoot: workspace.rootPath })
      .then((result: ServiceResponse<FileContentResponse>) => {
        if (!cancelled && result.success && result.data && !result.data.isBinary) {
          setFileLinesCache({
            path: filePath,
            lines: result.data.content.split("\n"),
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [findingLineNumbers.length, workspace?.rootPath, filePath]);

  const singleFilePatch = useMemo(
    () => normalizePatchForPatchDiff(diffText, filePath),
    [diffText, filePath],
  );

  const expandedDiff = useMemo(() => {
    if (!fileLines || findingLineNumbers.length === 0) return singleFilePatch;
    return expandDiffForFindings(singleFilePatch, findingLineNumbers, fileLines);
  }, [singleFilePatch, findingLineNumbers, fileLines]);

  const lineAnnotations = useMemo(() => {
    if (fileFindings.length === 0) return undefined;

    const byLine = new Map<number, Finding[]>();
    for (const f of fileFindings) {
      const line = f.lineStart != null && f.lineStart >= 1 ? f.lineStart : 1;
      const arr = byLine.get(line) ?? [];
      arr.push(f);
      byLine.set(line, arr);
    }

    const annotations: DiffLineAnnotation<FindingMeta>[] = [];
    for (const [lineNumber, findings] of byLine) {
      annotations.push({
        side: "additions",
        lineNumber,
        metadata: { findings },
      });
    }
    return annotations;
  }, [fileFindings]);

  const colors = isDarkMode ? severityColorsDark : severityColors;
  const textColor = isDarkMode ? "#fff" : "#1c1917";
  const mutedColor = isDarkMode ? "#dad8ce" : "#78716c";
  const suggestionColor = isDarkMode ? "#86efac" : "#16a34a";

  const handleApprove = useCallback(
    (id: string) => {
      updateFinding({ id, payload: { isApproved: true } });
    },
    [updateFinding],
  );

  const handleFix = useCallback(
    (finding: Finding) => {
      const lines = [
        `Fix the following issue in \`${finding.file}\`${finding.lineStart ? ` (line ${finding.lineStart}${finding.lineEnd && finding.lineEnd !== finding.lineStart ? `-${finding.lineEnd}` : ""})` : ""}:`,
        ``,
        `**${finding.severity.toUpperCase()}**: ${finding.message}`,
        finding.reason ? `\nReason: ${finding.reason}` : "",
        finding.suggestion ? `\nSuggestion: ${finding.suggestion}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      dispatch(setPendingGoal(lines));
      dispatch(setPendingAutoExecute(true));
    },
    [dispatch],
  );

  const renderAnnotation = useMemo(
    () => makeFindingAnnotation({ colors, textColor, mutedColor, suggestionColor, onApprove: handleApprove, onFix: handleFix }),
    [colors, textColor, mutedColor, suggestionColor, handleApprove, handleFix],
  );

  if (isImagePath(filePath) && workspace?.rootPath && filePath) {
    const fileName = filePath.split("/").pop() ?? filePath;
    const absPath = `${workspace.rootPath.replace(/\/$/, "")}/${filePath}`;
    return (
      <div className={`h-full overflow-auto ${className}`}>
        <ImageDiffView absPath={absPath} fileName={fileName} />
      </div>
    );
  }

  return (
    <div className={`h-full overflow-auto ${className}`}>
      {!expandedDiff.trim() ? (
        <div className="px-4 py-3 text-xs text-primary-600 dark:text-primary-400">No diff content to display.</div>
      ) : (
        <PatchDiff
          patch={expandedDiff}
          style={{ "--diffs-font-size": "12px", "--diffs-font-family": "'Geist Mono', monospace" } as React.CSSProperties}
          options={{
            theme: isDarkMode ? "pierre-dark" : "pierre-light",
            themeType: isDarkMode ? "dark" : "light",
            diffStyle: "unified",
            overflow: "wrap",
            disableFileHeader: true,
            unsafeCSS: `:host, [data-diffs], [data-diffs-header], [data-error-wrapper], [data-line], [data-column-number], [data-code] { --diffs-bg: var(--color-${isDarkMode ? "primary-950" : "primary"}); background-color: var(--color-${isDarkMode ? "primary-950" : "primary"}); }`,
          }}
          lineAnnotations={lineAnnotations}
          renderAnnotation={lineAnnotations ? renderAnnotation : undefined}
        />
      )}
    </div>
  );
}
