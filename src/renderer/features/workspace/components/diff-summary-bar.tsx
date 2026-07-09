import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import NumberFlow from "@number-flow/react";
import {
  useGetLatestWorkspaceDiffQuery,
  useDiscardWorkspaceChangesMutation,
  type WorkspaceDiff,
} from "@/lib/redux/api";
import { ArrowUp, Close } from "@/components/ui/icons";
import { Button, toast } from "@/components/ui";
import { FileIconComponent } from "./file-explorer/components/file-icon";
import { parseFileDiffSegment, parsePerFileStats } from "../utils/parse-diff";
import { DIFF_ADDED_TEXT, DIFF_REMOVED_TEXT } from "../lib/severity";

// DiffViewer pulls in `@pierre/diffs` (~hundreds of KB + heavy syntax parser).
// Defer the bundle until the summary bar is actually opened + a file picked.
const DiffViewer = lazy(() =>
  import("./diff-viewer").then((m) => ({ default: m.DiffViewer })),
);

interface DiffSummaryBarProps {
  workspaceId: string;
  rootPath: string;
  isRunning: boolean;
  lastCompletedRunId?: string | null;
}

function getTotalStats(diff: WorkspaceDiff | null | undefined) {
  if (!diff?.stats?.shortstat) return null;
  const insertions = diff.stats.shortstat.match(/(\d+) insertion/)?.[1];
  const deletions = diff.stats.shortstat.match(/(\d+) deletion/)?.[1];
  const filesCount = diff.files?.length ?? diff.stats.files ?? 0;
  return {
    files: filesCount,
    insertions: insertions ? parseInt(insertions) : 0,
    deletions: deletions ? parseInt(deletions) : 0,
  };
}

export function DiffSummaryBar({
  workspaceId,
  rootPath,
  isRunning,
  lastCompletedRunId,
}: DiffSummaryBarProps) {
  const [discardChanges] = useDiscardWorkspaceChangesMutation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  // Keep the last selected file rendered during collapse animation
  const [lastSelectedFile, setLastSelectedFile] = useState<string | null>(null);
  const renderedFile = selectedFile ?? lastSelectedFile;

  const { data: diff } = useGetLatestWorkspaceDiffQuery(workspaceId, {
    skip: !workspaceId || isRunning,
  });

  const stats = getTotalStats(diff);
  // Only parse the (potentially large) diff text when the bar is actually
  // expanded — collapsed state just needs the top-level counts.
  const perFileStats = useMemo(
    () => (isExpanded && diff?.diffText ? parsePerFileStats(diff.diffText) : {}),
    [isExpanded, diff],
  );

  const selectedFileDiff = useMemo(() => {
    if (!isExpanded || !renderedFile || !diff?.diffText) return "";
    return parseFileDiffSegment(renderedFile, diff.diffText);
  }, [isExpanded, renderedFile, diff]);

  const handleFileClick = useCallback((filePath: string) => {
    setLastSelectedFile(filePath);
    setSelectedFile((prev) => (prev === filePath ? null : filePath));
  }, []);

  const handleUndo = useCallback(async () => {
    if (!diff?.baseRef || !rootPath) return;
    setIsUndoing(true);
    try {
      // One workspace operation: reset to the diff's baseRef + drop the diff
      // row. See CONTEXT.md "Workspace git operations".
      await discardChanges(workspaceId).unwrap();
      toast.success("Changes reverted successfully");
    } catch {
      toast.error("Failed to revert changes");
    } finally {
      setIsUndoing(false);
    }
  }, [diff, rootPath, workspaceId, discardChanges]);

  // Don't show while running, when no diff, or when dismissed
  if (isRunning || !diff || !stats || stats.files === 0) return null;
  // Only show diff from the last completed run
  if (lastCompletedRunId && diff.runId && diff.runId !== lastCompletedRunId)
    return null;

  return (
    <div className="w-full max-w-200 mx-auto mb-1">
      <div className="rounded-2xl glass-morphism  overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-2 px-4 py-2">
          <Button
            onClick={() => {
              setIsExpanded((v) => {
                if (v) setSelectedFile(null);
                return !v;
              });
            }}
            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
          >
            <ArrowUp
              className={`size-3 text-primary-500 dark:text-primary-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : "rotate-90"}`}
            />
            <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
              <NumberFlow value={stats.files} /> file{stats.files !== 1 ? "s" : ""} changed
            </span>
            <span className="flex items-center gap-1.5 text-xs tabular-nums">
              {stats.insertions > 0 && (
                <NumberFlow
                  value={stats.insertions}
                  prefix="+"
                  className={`${DIFF_ADDED_TEXT} font-medium`}
                />
              )}
              {stats.deletions > 0 && (
                <NumberFlow
                  value={stats.deletions}
                  prefix="-"
                  className={`${DIFF_REMOVED_TEXT} font-medium`}
                />
              )}
            </span>
          </Button>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="primary"
              onClick={() => {
                setIsExpanded((v) => {
                  if (v) setSelectedFile(null);
                  return !v;
                });
              }}
            >
              {isExpanded ? "Hide" : "View Changes"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleUndo}
              disabled={isUndoing || !diff.baseRef}
            >
              {isUndoing ? "Undoing…" : "Undo"}
            </Button>
          </div>
        </div>

        {/* Expanded file list */}
        {diff.files && diff.files.length > 0 && (
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden min-h-0">
              <div className="border-t border-primary-200/40 dark:border-primary-700/30 px-4 py-2 space-y-0.5 max-h-48 overflow-y-auto">
                {diff.files.map((filePath) => {
                  const fStats = perFileStats[filePath];
                  const fileName = filePath.split("/").pop() || filePath;
                  const ext = fileName.includes(".") ? fileName.split(".").pop() : undefined;
                  const isSelected = selectedFile === filePath;
                  return (
                    <Button
                      key={filePath}
                      onClick={() => handleFileClick(filePath)}
                      className={`w-full flex items-center gap-2 py-0.5 px-1 rounded text-xs font-sans cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary-100 dark:bg-primary-800/60"
                          : "hover:bg-primary-50 dark:hover:bg-primary-800/30"
                      }`}
                    >
                      <FileIconComponent
                        fileName={fileName}
                        extension={ext}
                        className="size-3.5 shrink-0"
                      />
                      <span className="text-primary-700 dark:text-primary-300 truncate min-w-0 text-left">
                        {filePath}
                      </span>
                      {fStats && (
                        <span className="flex items-center gap-1 text-xxs tabular-nums ml-auto shrink-0">
                          {fStats.ins > 0 && (
                            <NumberFlow
                              value={fStats.ins}
                              prefix="+"
                              className={DIFF_ADDED_TEXT}
                            />
                          )}
                          {fStats.del > 0 && (
                            <NumberFlow
                              value={fStats.del}
                              prefix="-"
                              className={DIFF_REMOVED_TEXT}
                            />
                          )}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Inline diff viewer */}
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{
            gridTemplateRows: selectedFile && selectedFileDiff ? "1fr" : "0fr",
          }}
        >
          <div className="overflow-hidden min-h-0">
            <div className="border-t border-primary-200/40 dark:border-primary-700/30">
              <div className="flex items-center justify-between px-4 py-1.5">
                <span className="text-xs font-medium text-primary-600 dark:text-primary-400 truncate">
                  {renderedFile}
                </span>
                <Button
                  onClick={() => setSelectedFile(null)}
                  className="p-0.5 rounded hover:bg-primary-100 dark:hover:bg-primary-800 cursor-pointer"
                >
                  <Close className="size-3 text-primary-500" />
                </Button>
              </div>
              <div className="max-h-80 overflow-auto">
                {/* Only mount DiffViewer when the bar is actually open AND a
                    file is selected. Previously it stayed mounted during the
                    collapse animation, keeping the `@pierre/diffs` parser and
                    findings subscription alive for every completed run. */}
                {isExpanded && renderedFile && selectedFileDiff && (
                  <Suspense fallback={null}>
                    <DiffViewer
                      diffText={selectedFileDiff}
                      workspaceId={workspaceId}
                      filePath={renderedFile}
                    />
                  </Suspense>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
