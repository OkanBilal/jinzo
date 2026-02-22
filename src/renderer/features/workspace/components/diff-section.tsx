import { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import {
  useGetLatestWorkspaceDiffQuery,
  type WorkspaceDiff,
} from "@/lib/redux/api";
import { setPendingGoal } from "@/lib/redux/slices/workspaceSlice";
import { FileIconComponent } from "./file-explorer/components/file-icon";
import { Diff, Sparkles } from "@/components/ui/icons";
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
    <div className="flex items-center gap-1.5 text-[11px] tabular-nums">
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

  // Fetch the latest workspace diff directly
  const { currentData: diff, isFetching } = useGetLatestWorkspaceDiffQuery(
    workspaceId,
    { skip: !workspaceId },
  );

  const fileStats = useMemo(
    () => (diff?.diffText ? parsePerFileStats(diff.diffText) : {}),
    [diff?.diffText],
  );

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
  // TODO: check
  const handleReviewChanges = () => {
    dispatch(setPendingGoal("/review-code changes"));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Review Changes button */}
      <Button
        onClick={handleReviewChanges}
        className="shrink-0 flex items-center justify-center gap-1.5 mb-2 py-2 px-3 text-xs font-medium rounded-xl bg-primary-100 dark:bg-primary/5 hover:bg-primary-100 dark:hover:bg-primary/10 text-primary-900 dark:text-primary-200 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Review Changes
      </Button>

      {/* Stats header */}
      <div className="shrink-0 flex items-center justify-between px-1 py-1.5 mb-1">
        <span className="text-[11px] text-primary-900 dark:text-primary-200">
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
                <span className="text-sm font-medium text-primary-900 dark:text-primary-200 truncate">
                  {fileName}
                </span>
                {dirPath && (
                  <span className="text-[11px] text-primary-700 dark:text-primary-300 truncate">
                    {dirPath}
                  </span>
                )}
              </div>
              {fileStats[filePath] && (
                <div className="flex items-center gap-1 text-[11px] tabular-nums shrink-0">
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
            </Button>
          );
        })}
      </div>
    </div>
  );
}
