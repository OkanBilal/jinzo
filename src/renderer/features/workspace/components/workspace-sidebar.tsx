import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/redux/hooks";
import { FileExplorer } from "@/features/workspace/components/file-explorer";
import type { FileNode } from "@/features/workspace/types/file-explorer";
import {
  useGetWorkspaceQuery,
  useGetLatestWorkspaceDiffSummaryQuery,
} from "@/lib/redux/api";
import type { ProjectIssue, SignalWithEntity } from "@/lib/redux/api";
import {
  setSelectedFile,
  setActiveTab,
  addContextFile,
  addContextIssue,
  addContextSignal,
  openIssueTab,
  openSignalTab,
  toggleExplorerPath,
  expandExplorerPaths,
} from "@/lib/redux/slices/workspaceSlice";
import { setRightPanelOpen } from "@/lib/redux/slices/appSettingsSlice";
import { useIsMobile } from "@/lib/platform";
import { FolderIcon } from "@/components/ui/icons/file-icons";
import { TrackerSection } from "@/features/workspace/components/tracker-section";

import { DiffSection } from "@/features/workspace/components/diff-section";
import {
  isIssueTab,
  getIssueEntityId,
} from "@/features/workspace/utils/repo-utils";
import { useActiveSpace } from "@/hooks/use-active-space";
import { useOpenDiffInEditor } from "@/features/workspace/hooks/use-open-diff-in-editor";
import { Button } from "@/components/ui";
import { ActivitySection } from "./activity-section";

type SidebarTab = "files" | "changes" | "reviews";

export function WorkspaceSidebar() {
  const dispatch = useAppDispatch();
  // On mobile the panel is a full-screen overlay; opening a file/issue/signal
  // closes it so the resulting tab (in the main area) is visible.
  const isMobile = useIsMobile();
  const { activeSpaceId } = useActiveSpace();
  const workspaceId = useAppSelector(
    (state) => state.workspace.activeWorkspaceId,
  );

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const openDiffInEditor = useOpenDiffInEditor();

  // Get workspace data from the selected workspace ID
  const { data: workspace } = useGetWorkspaceQuery(workspaceId || "", {
    skip: !workspaceId,
  });

  // Get diff summary (no diffText) to show changed files count
  const { currentData: diff } = useGetLatestWorkspaceDiffSummaryQuery(
    workspaceId || "",
    {
      skip: !workspaceId,
    },
  );

  const changedFilesCount = diff?.files?.length ?? 0;
  const rootPath = workspace?.rootPath;

  // Explorer selection + expansion live in Redux so the tree keeps its shape
  // across tab switches and panel toggles (both unmount FileExplorer).
  const selectedFile = useAppSelector((state) => state.workspace.selectedFile);
  const explorerExpandedPaths = useAppSelector(
    (state) => state.workspace.explorerExpandedPaths,
  );
  const expandedPathSet = useMemo(
    () => new Set(explorerExpandedPaths),
    [explorerExpandedPaths],
  );
  const handleToggleExpand = useCallback(
    (path: string) => {
      dispatch(toggleExplorerPath(path));
    },
    [dispatch],
  );

  // Reveal the selected file: expand its ancestor folders no matter how it
  // was opened (tree click, file search, "@" menu, diff link).
  useEffect(() => {
    const fullPath = selectedFile?.fullPath;
    if (!fullPath || !rootPath) return;
    const root = rootPath.replace(/\/$/, "");
    if (!fullPath.startsWith(`${root}/`)) return;
    const parts = fullPath.slice(root.length + 1).split("/").slice(0, -1);
    if (parts.length === 0) return;
    const ancestors: string[] = [];
    let acc = root;
    for (const part of parts) {
      acc = `${acc}/${part}`;
      ancestors.push(acc);
    }
    dispatch(expandExplorerPaths(ancestors));
  }, [selectedFile?.fullPath, rootPath, dispatch]);

  const handleFileSelect = useCallback(
    (node: FileNode) => {
      // Dispatch file selection to Redux
      dispatch(setSelectedFile(node));
      // Switch to Editor tab when a file is selected
      dispatch(setActiveTab("editor"));
      if (isMobile) dispatch(setRightPanelOpen(false));
    },
    [dispatch, isMobile],
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
      if (isMobile) dispatch(setRightPanelOpen(false));
    },
    [dispatch, isMobile],
  );
  const handleSelectSignal = useCallback(
    (signal: SignalWithEntity) => {
      dispatch(openSignalTab(signal));
      if (isMobile) dispatch(setRightPanelOpen(false));
    },
    [dispatch, isMobile],
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
  const handleAddSignalToContext = useCallback(
    (signal: SignalWithEntity) => {
      dispatch(
        addContextSignal({
          entityId: signal.signal.entityId,
          title: signal.entity.title || "Untitled signal",
          body: signal.entity.body,
          source: signal.signal.source,
          level: signal.signal.level,
          category: signal.signal.category,
          stackTrace: signal.signal.stackTrace,
          eventCount: signal.signal.eventCount,
        }),
      );
    },
    [dispatch],
  );

  const handleSelectDiffFile = useCallback(
    (filePath: string, diffContent: string) => {
      openDiffInEditor(filePath, diffContent);
      if (isMobile) dispatch(setRightPanelOpen(false));
    },
    [openDiffInEditor, dispatch, isMobile],
  );

  const activeTab = useAppSelector(
    (state) => state.workspace.activeTab,
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
        <div className="glass-outline relative flex items-center p-0.5 rounded-xl ">
          <div
            className={`absolute top-0.5 bottom-0.5 rounded-[10px] glass-outline dark:bg-primary/10 bg-primary  transition-transform duration-200 ease-out`}
            style={{
              width: "calc((100% - 0.75rem) / 3)",
              left: "0.125rem",
              transform: `translateX(calc(${tabIndex} * (100% + 0.25rem)))`,
            }}
          />
          <Button
            onClick={() => setSidebarTab("files")}
            className={`relative z-(--z-base) flex-1 text-xs font-medium py-1 px-2 transition-colors ${
              sidebarTab === "files"
                ? "text-primary-900 dark:text-primary-100"
                : "text-primary-800 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200"
            }`}
          >
            Files
          </Button>
          <Button
            onClick={() => setSidebarTab("changes")}
            className={`relative z-(--z-base) flex-1 text-xs font-medium py-1 px-2  transition-colors ${
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
              selectedPath={selectedFile?.fullPath ?? null}
              expandedPaths={expandedPathSet}
              onToggleExpand={handleToggleExpand}
              initialDepth={2}
              className="flex-1 min-h-0"
            />
          </div>

          <TrackerSection
            projectId={workspace?.projectId ?? undefined}
            activeIssueEntityId={activeIssueEntityId}
            onSelectIssue={handleSelectIssue}
            onAddIssueToContext={handleAddIssueToContext}
            onSelectSignal={handleSelectSignal}
            onAddSignalToContext={handleAddSignalToContext}
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
      ) :  <ActivitySection workspaceId={workspaceId} />}
    </div>
  );
}
