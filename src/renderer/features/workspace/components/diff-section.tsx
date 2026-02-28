import { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import {
  useGetLatestWorkspaceDiffQuery,
  useGetAppSettingsQuery,
  useGetReviewsByWorkspaceQuery,
  useGetReviewFindingsByReviewQuery,
  type WorkspaceDiff,
  type FindingSeverity,
} from "@/lib/redux/api";
import { setPendingGoal, setPendingAutoExecute } from "@/lib/redux/slices/workspaceSlice";
import { FileIconComponent } from "./file-explorer/components/file-icon";
import {
  Diff,
  Sparkles,
  Check,
  Commit,
  CircleDot,
} from "@/components/ui/icons";
import { Body } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

interface DiffSectionProps {
  workspaceId: string;
  onSelectDiffFile: (filePath: string, diffText: string) => void;
}

/** Status badge for the diff (insertions/deletions) */
function DiffStats({ stats }: { stats: WorkspaceDiff["stats"] }) {
  if (!stats?.shortstat) return null;

  // Parse shortstat like "3 files changed, 120 insertions(+), 15 deletions(-)"
  const insertions = stats.shortstat.match(/(\d+) insertion/)?.[1];
  const deletions = stats.shortstat.match(/(\d+) deletion/)?.[1];

  return (
    <div className="flex items-center gap-1.5 text-xxs tabular-nums">
      {insertions && (
        <span className="text-green-600 dark:text-green-400">
          +{insertions}
        </span>
      )}
      {deletions && (
        <span className="text-red-500 dark:text-red-400">-{deletions}</span>
      )}
    </div>
  );
}

/** Extract the diff section for a single file from the full unified diff */
function parseFileDiffSegment(filePath: string, fullDiff: string): string {
  const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:^|\\n)diff --git a\\/${escapedPath} b\\/${escapedPath}[\\s\\S]*?(?=\\ndiff --git|$)`,
  );
  const match = fullDiff.match(pattern);
  return match ? match[0].trim() : "";
}

/** Count insertions / deletions per file from the unified diff */
function parsePerFileStats(
  fullDiff: string,
): Record<string, { ins: number; del: number }> {
  const stats: Record<string, { ins: number; del: number }> = {};
  // Split into per-file sections (keep prefix for all sections)
  const fileSections = fullDiff.split(/(?=diff --git )/);
  for (const section of fileSections) {
    // Extract file path from "diff --git a/path b/path"
    const headerMatch = section.match(/^diff --git a\/(.+?) b\//);
    if (!headerMatch) continue;
    const filePath = headerMatch[1];
    let ins = 0;
    let del = 0;
    // Count lines starting with + or - (skip --- and +++ header lines)
    const lines = section.split("\n");
    for (const line of lines) {
      if (line.startsWith("+++") || line.startsWith("---")) continue;
      if (line.startsWith("+")) ins++;
      else if (line.startsWith("-")) del++;
    }
    stats[filePath] = { ins, del };
  }
  return stats;
}

export function DiffSection({
  workspaceId,
  onSelectDiffFile,
}: DiffSectionProps) {
  const dispatch = useDispatch();
  const [selectedDiffFile, setSelectedDiffFile] = useState<string | null>(null);
  const { data: appSettings } = useGetAppSettingsQuery();

  // Fetch the latest workspace diff directly
  const { currentData: diff, isFetching } = useGetLatestWorkspaceDiffQuery(
    workspaceId,
    { skip: !workspaceId },
  );

  const fileStats = useMemo(
    () => (diff?.diffText ? parsePerFileStats(diff.diffText) : {}),
    [diff?.diffText],
  );

  // Fetch latest review findings for badge display
  const { data: reviews } = useGetReviewsByWorkspaceQuery(
    { workspaceId },
    { skip: !workspaceId },
  );
  const latestReviewId = reviews?.[0]?.id;
  const { data: allFindings } = useGetReviewFindingsByReviewQuery(
    { reviewId: latestReviewId! },
    { skip: !latestReviewId },
  );

  // Group findings by file → { critical: n, warning: n, info: n }
  // Normalize paths so diff file paths and finding file paths match
  const findingsByFile = useMemo(() => {
    if (!allFindings || !diff?.files)
      return {} as Record<string, Record<FindingSeverity, number>>;
    const norm = (p: string) => p.replace(/^\.?\//, "");
    const map: Record<string, Record<FindingSeverity, number>> = {};
    for (const f of allFindings) {
      const fNorm = norm(f.file);
      // Match finding to a diff file path
      const matchedFile: string | undefined = diff.files.find((dp: string) => {
        const dpNorm = norm(dp);
        return (
          dpNorm === fNorm ||
          dpNorm.endsWith("/" + fNorm) ||
          fNorm.endsWith("/" + dpNorm)
        );
      });
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
  }, [allFindings, diff?.files]);

  if (isFetching) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs text-primary-500 dark:text-primary-400">
          Loading changes...
        </span>
      </div>
    );
  }

  if (!diff || !diff.files || diff.files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 px-4 text-center">
          <Diff className="w-6 h-6 dark:text-primary-500 text-primary-800" />
          <Body className="text-xs font-medium text-primary-800 dark:text-primary-300">
            No changes detected.
          </Body>
        </div>
      </div>
    );
  }
  const handleReviewChanges = () => {
    dispatch(setPendingGoal("review code changes in this workspace"));
    dispatch(setPendingAutoExecute(true));
  };

  const handleCommitChanges = () => {
    const instructions = appSettings?.commitInstructions;
    dispatch(
      setPendingGoal(
        instructions
          ? instructions + "\n\nCommit the changes."
          : "Commit the changes.",
      ),
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Action buttons */}
      <div className="shrink-0 flex items-center gap-2 mb-2">
        <Button
          onClick={handleReviewChanges}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-xl bg-primary-100 dark:bg-primary/5 hover:bg-primary-100 dark:hover:bg-primary/10 text-primary-900 dark:text-primary-200 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Review Changes
        </Button>
        <Button
          onClick={handleCommitChanges}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-xl bg-primary-100 dark:bg-primary/5 hover:bg-primary-100 dark:hover:bg-primary/10 text-primary-900 dark:text-primary-200 transition-colors"
        >
          <Commit className="w-3.5 h-3.5" />
          Commit Changes
        </Button>
      </div>

      {/* Stats header */}
      <div className="shrink-0 flex items-center justify-between px-1 py-1.5 mb-1">
        <span className="text-xxs text-primary-900 dark:text-primary-200">
          {diff.files.length} file{diff.files.length !== 1 ? "s" : ""} changed
        </span>
        <DiffStats stats={diff.stats} />
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto noscrollbar space-y-1">
        {diff.files.map((filePath, index) => {
          const fileName = filePath.split("/").pop() || filePath;
          const dirPath = filePath.includes("/")
            ? filePath.substring(0, filePath.lastIndexOf("/"))
            : "";
          const isSelected = selectedDiffFile === filePath;

          return (
            <Button
              key={filePath}
              onClick={() => {
                const segment = parseFileDiffSegment(filePath, diff.diffText);
                setSelectedDiffFile(filePath);
                onSelectDiffFile(filePath, segment || diff.diffText);
              }}
              className={`w-full active:scale-99  flex items-center gap-2 px-2 py-1 rounded-xl duration-200 text-left transition-all animate-slide-in ${
                isSelected
                  ? "bg-primary/80 dark:bg-primary/5"
                  : "bg-transparent hover:bg-primary/20 dark:hover:bg-primary/5"
              }`}
              style={{ animationDelay: `${index * 0.02}s` }}
            >
              <FileIconComponent
                fileName={fileName}
                extension={fileName.split(".").pop()}
                className="w-4 h-4 shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-medium text-primary-900 dark:text-primary-200 truncate">
                  {fileName}
                </span>
                {dirPath && (
                  <span className="text-xxs text-primary-700 dark:text-primary-300 truncate">
                    {dirPath}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end justify-center">
                {fileStats[filePath] && (
                  <div className="flex items-center gap-1 text-xxs tabular-nums shrink-0">
                    {fileStats[filePath].ins > 0 && (
                      <span className="text-green-600 dark:text-green-400">
                        +{fileStats[filePath].ins}
                      </span>
                    )}
                    {fileStats[filePath].del > 0 && (
                      <span className="text-red-500 dark:text-red-400">
                        -{fileStats[filePath].del}
                      </span>
                    )}
                  </div>
                )}
                {findingsByFile[filePath] && (
                  <div className="flex items-center gap-1 text-t tabular-nums shrink-0">
                    {findingsByFile[filePath].critical > 0 && (
                      <span className="flex items-center gap-0.5">
                        <CircleDot className="size-2 text-red-500 dark:text-red-400" />
                        <span className="text-red-500 dark:text-red-400">
                          {findingsByFile[filePath].critical}
                        </span>
                      </span>
                    )}
                    {findingsByFile[filePath].warning > 0 && (
                      <span className="flex items-center gap-0.5">
                        <CircleDot className="size-2 text-yellow-400" />
                        <span className="text-yellow-400">
                          {findingsByFile[filePath].warning}
                        </span>
                      </span>
                    )}
                    {findingsByFile[filePath].info > 0 && (
                      <span className="flex items-center gap-0.5">
                        <CircleDot className="size-2 text-blue-500 dark:text-blue-500" />
                        <span className="text-blue-500 dark:text-blue-500">
                          {findingsByFile[filePath].info}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
