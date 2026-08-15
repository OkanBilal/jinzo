import { useMemo, useState } from "react";
import { appApi } from "@/lib/transport";
import { useAppDispatch } from "@/lib/redux/hooks";
import {
  useGetLatestWorkspaceDiffQuery,
  useListReviewFindingsByWorkspaceQuery,
  useGetWorkspaceQuery,
  type WorkspaceDiff,
  type FindingSeverity,
} from "@/lib/redux/api";
import { setPendingGoal, setPendingAutoExecute, setPendingReviewTarget } from "@/lib/redux/slices/workspaceSlice";
import { useWorkspaceVariant } from "@/hooks/use-workspace-variant";
import { FileIconComponent } from "./file-explorer/components/file-icon";
import {
  Diff,
  CircleDot,
  Chat,
  Codex,
} from "@/components/ui/icons";
import { Button, Caption } from "@/components/ui";
import { DIFF_ADDED_TEXT, DIFF_REMOVED_TEXT, SEVERITY_TEXT } from "../lib/severity";
import { buildSyntheticDiff } from "../utils/expand-diff";
import {
  parseFileDiffSegment,
  parsePerFileStats,
  type FileChangeStatus,
} from "../utils/parse-diff";
import { normalizePath, pathsMatch } from "../utils/path-utils";

interface DiffSectionProps {
  workspaceId: string;
  onSelectDiffFile: (filePath: string, diffText: string) => void;
}

/** Status badge for the diff (insertions/deletions) */
function DiffStats({ stats }: { stats: WorkspaceDiff["stats"] }) {
  if (!stats?.shortstat) return null;

  const insertions = stats.shortstat.match(/(\d+) insertion/)?.[1];
  const deletions = stats.shortstat.match(/(\d+) deletion/)?.[1];

  return (
    <div className="flex items-center gap-1.5 text-xxs tabular-nums">
      {insertions && (
        <span className={DIFF_ADDED_TEXT}>
          +{insertions}
        </span>
      )}
      {deletions && (
        <span className={DIFF_REMOVED_TEXT}>-{deletions}</span>
      )}
    </div>
  );
}

/**
 * Single-letter git status per file row, in the slot the per-file +/- counts
 * used to occupy. Every row carries one, so it reads as a column rather than
 * an exception marker — the totals in the header cover the line arithmetic.
 */
const STATUS_LETTER: Record<
  FileChangeStatus,
  { label: string; title: string; className: string }
> = {
  added: {
    label: "A",
    title: "Added",
    className: "text-success",
  },
  untracked: {
    label: "U",
    title: "Untracked",
    className: "text-success",
  },
  modified: {
    label: "M",
    title: "Modified",
    className: "text-warning",
  },
  deleted: {
    label: "D",
    title: "Deleted",
    className: "text-danger",
  },
  renamed: {
    label: "R",
    title: "Renamed",
    className: "text-accent",
  },
};

function FileStatusLetter({
  status,
  title,
}: {
  status: FileChangeStatus;
  title?: string;
}) {
  const letter = STATUS_LETTER[status];
  return (
    <span
      title={title ?? letter.title}
      // Fixed width so the letters line up into a column regardless of name length.
      className={`shrink-0 w-3 text-center text-xxs font-semibold tabular-nums ${letter.className}`}
    >
      {letter.label}
    </span>
  );
}

/** Finding severity indicator dots */
function FindingBadges({ counts }: { counts: Record<FindingSeverity, number> }) {
  return (
    <div className="flex items-center gap-1 text-t tabular-nums shrink-0">
      {counts.critical > 0 && (
        <span className="flex items-center gap-0.5">
          <CircleDot className={`size-2 ${SEVERITY_TEXT.critical}`} />
          <span className={SEVERITY_TEXT.critical}>{counts.critical}</span>
        </span>
      )}
      {counts.warning > 0 && (
        <span className="flex items-center gap-0.5">
          <CircleDot className={`size-2 ${SEVERITY_TEXT.warning}`} />
          <span className={SEVERITY_TEXT.warning}>{counts.warning}</span>
        </span>
      )}
      {counts.info > 0 && (
        <span className="flex items-center gap-0.5">
          <CircleDot className={`size-2 ${SEVERITY_TEXT.info}`} />
          <span className={SEVERITY_TEXT.info}>{counts.info}</span>
        </span>
      )}
    </div>
  );
}

export function DiffSection({
  workspaceId,
  onSelectDiffFile,
}: DiffSectionProps) {
  const dispatch = useAppDispatch();
  const variant = useWorkspaceVariant();
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);

  const { currentData: diff, isFetching } = useGetLatestWorkspaceDiffQuery(
    workspaceId,
    { skip: !workspaceId },
  );

  const diffText = diff?.diffText;
  const untrackedFiles = diff?.untrackedFiles;
  const fileStats = useMemo(
    () => (diffText ? parsePerFileStats(diffText, untrackedFiles) : {}),
    [diffText, untrackedFiles],
  );

  const { data: allFindings } = useListReviewFindingsByWorkspaceQuery(
    { workspaceId },
    { skip: !workspaceId },
  );

  const { data: workspace } = useGetWorkspaceQuery(workspaceId, { skip: !workspaceId });

  const diffFiles = diff?.files;
  const findingsByFile = useMemo(() => {
    if (!allFindings)
      return {} as Record<string, Record<FindingSeverity, number>>;
    const map: Record<string, Record<FindingSeverity, number>> = {};
    for (const f of allFindings) {
      if (f.isApproved) continue;
      const fNorm = normalizePath(f.file);
      const matchedFile = diffFiles?.find((dp: string) => pathsMatch(normalizePath(dp), fNorm));
      const key = matchedFile ?? f.file;
      if (!map[key]) map[key] = { critical: 0, warning: 0, info: 0 };
      const sev = (
        ["critical", "warning", "info"].includes(f.severity)
          ? f.severity
          : "info"
      ) as FindingSeverity;
      map[key][sev]++;
    }
    return map;
  }, [allFindings, diffFiles]);

  const findingOnlyFiles = useMemo(() => {
    if (!allFindings) return [];
    const normalizedDiffFiles = (diffFiles ?? []).map(normalizePath);

    const filesWithFindings = new Set<string>();
    for (const f of allFindings) {
      if (f.isApproved) continue;
      const fNorm = normalizePath(f.file);
      const inDiff = normalizedDiffFiles.some((dp) => pathsMatch(dp, fNorm));
      if (!inDiff) filesWithFindings.add(f.file);
    }
    return [...filesWithFindings];
  }, [allFindings, diffFiles]);

  const handleReviewChanges = () => {
    if (variant === "codex") {
      dispatch(setPendingReviewTarget({ type: "uncommittedChanges" }));
      return;
    }
    dispatch(setPendingGoal("Review code changes in this workspace"));
    dispatch(setPendingAutoExecute(true));
  };

  const handleSelectFindingOnlyFile = async (filePath: string) => {
    if (!workspace?.rootPath || !allFindings) return;

    const target = normalizePath(filePath);
    const lines = allFindings
      .filter((f) => pathsMatch(normalizePath(f.file), target))
      .filter((f) => f.lineStart != null && f.lineStart >= 1)
      .map((f) => f.lineStart as number);

    if (lines.length === 0) return;

    try {
      const result = await appApi.fileExplorer.readFileText({
        filePath: `${workspace.rootPath}/${filePath}`,
      });
      if (!result.success || !result.data || result.data.isBinary) return;

      const fileLines = result.data.content.split("\n");
      const syntheticDiff = buildSyntheticDiff(filePath, lines, fileLines);
      if (syntheticDiff) {
        setSelectedDiffFile(filePath);
        onSelectDiffFile(filePath, syntheticDiff);
      }
    } catch {
      // File may not exist anymore
    }
  };

  if (isFetching) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs text-primary-600 dark:text-primary-400">
          Loading changes...
        </span>
      </div>
    );
  }

  if ((!diff || !diff.files || diff.files.length === 0) && findingOnlyFiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <Diff className="w-4 h-4 dark:text-primary-300 text-primary-700" />
          <Caption>
            No changes detected.
          </Caption>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Action buttons */}
      <div className="shrink-0 flex items-center gap-2 mb-2">
        <Button
          onClick={handleReviewChanges}
          className="flex-1 flex items-center glass-outline justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-xl bg-primary-100/50 dark:bg-primary/5 hover:bg-primary-100 dark:hover:bg-primary/10 text-primary-900 dark:text-primary-100 transition-colors"
        >
          {variant === "codex" ? <Codex className="w-3.5 h-3.5" /> : <Chat className="w-3.5 h-3.5" />}
          Review Changes
        </Button>
      </div>

      {/* Stats header */}
      {diff && diff.files && diff.files.length > 0 && (
        <div className="shrink-0 flex items-center justify-between px-1 py-1.5 mb-1">
          <span className="text-xxs text-primary-900 dark:text-primary-100">
            {diff.files.length} file{diff.files.length !== 1 ? "s" : ""} changed
          </span>
          <DiffStats stats={diff.stats} />
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto noscrollbar space-y-1">
        {(diff?.files ?? []).map((filePath, index) => {
          const fileName = filePath.split("/").pop() || filePath;
          const dirPath = filePath.includes("/")
            ? filePath.substring(0, filePath.lastIndexOf("/"))
            : "";
          const isSelected = selectedDiffFile === filePath;
          const stat = fileStats[filePath];
          const status = stat?.status ?? "modified";
          const isDeleted = status === "deleted";

          return (
            <Button
              key={filePath}
              // The path truncates in place, so the full one lives on hover.
              title={filePath}
              onClick={() => {
                const segment = diff ? parseFileDiffSegment(filePath, diff.diffText) : "";
                setSelectedDiffFile(filePath);
                onSelectDiffFile(filePath, segment || diff?.diffText || "");
              }}
              className={`w-full flex items-center gap-2 px-2 py-1 rounded-xl duration-200 text-left transition-all animate-slide-in ${
                isSelected
                  ? "bg-primary/80 dark:bg-primary/5 glass-outline"
                  : "bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
              }`}
              style={{ animationDelay: `${index * 0.02}s` }}
            >
              <FileIconComponent
                fileName={fileName}
                extension={fileName.split(".").pop()}
                className={`w-4 h-4 shrink-0 ${isDeleted ? "opacity-50" : ""}`}
              />
              <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                <span
                  // shrink-[0.25]: both children may truncate, but the path —
                  // longer and less identifying — gives up room first.
                  className={`min-w-0 shrink-[0.25] truncate text-xs font-medium ${
                    isDeleted
                      ? "line-through decoration-primary-800/50 dark:decoration-primary/50 text-primary-700 dark:text-primary-300"
                      : "text-primary-900 dark:text-primary-100"
                  }`}
                >
                  {fileName}
                </span>
                {dirPath && (
                  <span className="min-w-0 truncate text-xxs text-primary-600 dark:text-primary-400">
                    {dirPath}
                  </span>
                )}
              </div>
              {findingsByFile[filePath] && (
                <FindingBadges counts={findingsByFile[filePath]} />
              )}
              <FileStatusLetter
                status={status}
                title={stat?.oldPath ? `Renamed from ${stat.oldPath}` : undefined}
              />
            </Button>
          );
        })}

        {/* Files with findings but no changes in the diff */}
        {findingOnlyFiles.map((filePath, index) => {
          const fileName = filePath.split("/").pop() || filePath;
          const dirPath = filePath.includes("/")
            ? filePath.substring(0, filePath.lastIndexOf("/"))
            : "";
          const isSelected = selectedDiffFile === filePath;

          return (
            <Button
              key={`finding-${filePath}`}
              title={filePath}
              onClick={() => handleSelectFindingOnlyFile(filePath)}
              className={`w-full flex items-center gap-2 px-2 py-1 rounded-xl duration-200 text-left transition-all animate-slide-in ${
                isSelected
                  ? "bg-primary/80 dark:bg-primary/5"
                  : "bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
              }`}
              style={{ animationDelay: `${((diff?.files?.length ?? 0) + index) * 0.02}s` }}
            >
              <FileIconComponent
                fileName={fileName}
                extension={fileName.split(".").pop()}
                className="w-4 h-4 shrink-0"
              />
              <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                <span className="min-w-0 shrink-[0.25] truncate text-xs font-medium text-primary-900 dark:text-primary-100">
                  {fileName}
                </span>
                {dirPath && (
                  <span className="min-w-0 truncate text-xxs text-primary-600 dark:text-primary-400">
                    {dirPath}
                  </span>
                )}
              </div>
              {findingsByFile[filePath] && (
                <FindingBadges counts={findingsByFile[filePath]} />
              )}
              {/* These files aren't in the diff, so they have no status letter —
                  hold the column open so both lists share a right edge. */}
              <span className="w-3 shrink-0" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
