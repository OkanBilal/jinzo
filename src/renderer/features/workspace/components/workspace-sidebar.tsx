import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  FileExplorer,
  type FileNode,
} from "@/features/workspace/components/file-explorer";
import {
  useGetWorkspaceByIdQuery,
  useGetLatestWorkspaceDiffQuery,
} from "@/lib/redux/api";
import type { ProjectIssue } from "@/lib/redux/api";
import {
  setSelectedFile,
  setActiveTab,
  setSelectedFileContent,
  addContextFile,
  addContextIssue,
  openIssueTab,
} from "@/lib/redux/slices/workspaceSlice";
import type { RootState } from "@/lib/redux";
import { FolderIcon } from "@/components/ui/icons/file-icons";
import { IssuesSection } from "@/features/workspace/components/issues-section";
import { TerminalSection } from "@/features/workspace/components/terminal-section";
import { DiffSection } from "@/features/workspace/components/diff-section";
import { ActivitySection } from "@/features/workspace/components/activity-section";
import {
  isIssueTab,
  getIssueEntityId,
} from "@/features/workspace/utils/repo-utils";
import { useActiveSpace } from "@/hooks/use-active-space";
import { Button } from "@/components/ui";

type SidebarTab = "files" | "changes" | "reviews";

export function WorkspaceSidebar() {
  const dispatch = useDispatch();
  const { activeSpaceId, spaceSlug } = useActiveSpace();
  const workspaceId = useSelector(
    (state: RootState) => state.workspace.activeWorkspaceId,
  );

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");


  // Get workspace data from the selected workspace ID
  const { data: workspace } = useGetWorkspaceByIdQuery(workspaceId || "", {
    skip: !workspaceId,
  });

  // Get diff data to show changed files count
  const { currentData: diff } = useGetLatestWorkspaceDiffQuery(workspaceId || "", {
    skip: !workspaceId,
  });

  const changedFilesCount = diff?.files?.length ?? 0;
  const rootPath = workspace?.rootPath;

  const handleFileSelect = useCallback(
    (node: FileNode) => {
      // Dispatch file selection to Redux
      dispatch(setSelectedFile(node));
      // Switch to Editor tab when a file is selected
      dispatch(setActiveTab("editor"));
    },
    [dispatch],
  );

  const handleAddToContext = useCallback(
    (node: FileNode) => {
      // Add file to context for the input
      dispatch(addContextFile(node));
    },
    [dispatch],
  );

  const handleSelectIssue = useCallback(
    (issue: ProjectIssue) => {
      dispatch(openIssueTab(issue));
    },
    [dispatch],
  );
  const handleAddIssueToContext = useCallback(
    (issue: ProjectIssue) => {
      dispatch(
        addContextIssue({
          entityId: issue.issue.entityId,
          title: issue.entity.title || `Issue #${issue.issue.number ?? "?"}`,
          body: issue.entity.body,
          provider: issue.issue.provider,
          number: issue.issue.number,
          labels: issue.issue.labels,
        }),
      );
    },
    [dispatch],
  );

  const handleSelectDiffFile = useCallback(
    (filePath: string, diffContent: string) => {
      // Show the diff in the editor by setting file + content
      const fileName = filePath.split("/").pop() || filePath;
      dispatch(
        setSelectedFile({
          name: fileName + ".diff",
          fullPath: filePath,
          type: "file",
          extension: "diff",
        }),
      );
      dispatch(
        setSelectedFileContent({
          content: diffContent,
          size: diffContent.length,
          isBinary: false,
          encoding: "utf-8",
        }),
      );
      dispatch(setActiveTab("editor"));
    },
    [dispatch],
  );

  const activeTab = useSelector(
    (state: RootState) => state.workspace.activeTab,
  );
  const activeIssueEntityId = isIssueTab(activeTab)
    ? getIssueEntityId(activeTab)
    : null;

  // If no workspace ID or rootPath provided, show empty state
  if (!workspaceId || !rootPath) {
    return (
      <div className="flex-1 flex flex-col h-[calc(100%-1rem)] mt-2 -pb-4 rounded-xl overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-primary-700 dark:text-primary-300">
            <FolderIcon className="size-10" />
            <span className="text-xs font-medium">No workspace selected</span>
          </div>
        </div>
      </div>
    );
  }

  const tabIndex =
    sidebarTab === "files" ? 0 : sidebarTab === "changes" ? 1 : 2;

  return (
    <div className="flex-1 flex flex-col h-[calc(100%-1rem)] mt-2 -pb-4 rounded-xl overflow-hidden">
      <div className="shrink-0 py-2 mt-8 px-3">
        <div className="relative flex items-center p-0.5 rounded-lg bg-primary-100/20  dark:bg-primary/4">
          <div
            className={`absolute top-0.5 bottom-0.5 rounded-lg dark:bg-primary/10 bg-primary  transition-transform duration-200 ease-out`}
            style={{
              width: "calc((100% - 0.75rem) / 3)",
              left: "0.125rem",
              transform: `translateX(calc(${tabIndex} * (100% + 0.25rem)))`,
            }}
          />
          <Button
            onClick={() => setSidebarTab("files")}
            className={`relative z-(--z-base) flex-1 text-xs font-medium py-1 px-2 rounded-lg transition-colors ${
              sidebarTab === "files"
                ? "text-primary-900 dark:text-primary-100"
                : "text-primary-800 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200"
            }`}
          >
            Files
          </Button>
          <Button
            onClick={() => setSidebarTab("changes")}
            className={`relative z-(--z-base) flex-1 text-xs font-medium py-1 px-2 rounded-lg transition-colors ${
              sidebarTab === "changes"
                ? "text-primary-900 dark:text-primary-100"
                : "text-primary-800 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200"
            }`}
          >
            Changes{changedFilesCount > 0 && ` (${changedFilesCount})`}
          </Button>
          <Button
            onClick={() => setSidebarTab("reviews")}
            className={`relative z-(--z-base) flex-1 text-xs font-medium py-1 px-2 rounded-lg transition-colors ${
              sidebarTab === "reviews"
                ? "text-primary-900 dark:text-primary-100"
                : "text-primary-800 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200"
            }`}
          >
            Activity
          </Button>
        </div>
      </div>

      {/* Tab content */}
      {sidebarTab === "files" ? (
        <>
          {/* File Explorer */}
          <div className="flex-1 px-3 flex flex-col min-h-0">
            <FileExplorer
              key={`${activeSpaceId}-${workspaceId || rootPath}`}
              rootPath={rootPath}
              onFileSelect={handleFileSelect}
              onAddToContext={handleAddToContext}
              initialDepth={2}
              className="flex-1 min-h-0"
            />
          </div>

          <IssuesSection
            projectId={workspace?.projectId ?? undefined}
            activeIssueEntityId={activeIssueEntityId}
            onSelectIssue={handleSelectIssue}
            onAddToContext={handleAddIssueToContext}
          />
          <TerminalSection
            variant={spaceSlug}
            workspaceId={workspaceId}
            rootPath={rootPath}
          />
        </>
      ) : sidebarTab === "changes" ? (
        /* Changes (diff) view */
        <div className="flex-1 px-3 flex flex-col min-h-0">
          <DiffSection
            key={workspaceId}
            workspaceId={workspaceId}
            onSelectDiffFile={handleSelectDiffFile}
          />
        </div>
      ) : (
        <ActivitySection workspaceId={workspaceId} />
      )}
    </div>
  );
}
