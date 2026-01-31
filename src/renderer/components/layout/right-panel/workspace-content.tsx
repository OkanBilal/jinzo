import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { FileExplorer, type FileNode } from "@/features/file-explorer";
import { Body } from "@/components/ui/text";
import { useGetWorkspaceByIdQuery } from "@/lib/redux/api";
import type { WorkspaceIssue } from "@/lib/redux/api";
import {
  setSelectedFile,
  setActiveTab,
  addContextFile,
  addContextIssue,
  openIssueTab,
} from "@/lib/redux/slices/workspaceSlice";
import type { RootState } from "@/lib/redux";
import { FolderIcon } from "@/components/ui/icons/file-icons";
import { IssuesSection } from "@/features/workspace/components/issues-section";
import {
  isIssueTab,
  getIssueEntityId,
} from "@/features/workspace/utils/repo-utils";

export function WorkspaceContent() {
  const location = useLocation();
  const dispatch = useDispatch();
  const selectedFile = useSelector(
    (state: RootState) => state.workspace.selectedFile,
  );

  // TODO: Refactor workspaceId extraction to a custom hook if used elsewhere
  const workspaceId = useMemo(() => {
    const match = location.pathname.match(/^\/(workspace|claude)\/([^/]+)/);
    return match ? match[2] : undefined;
  }, [location.pathname]);

  // Get workspace data from the selected workspace ID
  const { data: workspace } = useGetWorkspaceByIdQuery(workspaceId || "", {
    skip: !workspaceId,
  });

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
    (issue: WorkspaceIssue) => {
      dispatch(openIssueTab(issue));
    },
    [dispatch],
  );
  const handleAddIssueToContext = useCallback(
    (issue: WorkspaceIssue) => {
      dispatch(addContextIssue({
        entityId: issue.issue.entityId,
        title: issue.entity.title || `Issue #${issue.issue.number ?? "?"}`,
        body: issue.entity.body,
        provider: issue.issue.provider,
        number: issue.issue.number,
      }));
    },
    [dispatch],
  );

  const activeTab = useSelector(
    (state: RootState) => state.workspace.activeTab,
  );
  const activeIssueEntityId = isIssueTab(activeTab)
    ? getIssueEntityId(activeTab)
    : null;

  // If no rootPath provided, show empty state
  if (!rootPath) {
    return (
      <div className="flex-1 flex flex-col h-[calc(100%-1rem)] mt-2 -pb-4 rounded-2xl overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-primary-500 dark:text-primary-200">
            <FolderIcon className="w-12 h-12" />
            <span className="text-sm">No workspace selected</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100%-1rem)] mt-2 -pb-4 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="shrink-0 py-2 mt-4">
        <Body className="text-left text-base! text-primary-900 dark:text-primary font-medium px-3">
          Explorer
        </Body>
      </div>

      {/* File Explorer - full width, no split view */}
      <div className="flex-1 px-3 flex flex-col min-h-0">
        <FileExplorer
          rootPath={rootPath}
          onFileSelect={handleFileSelect}
          onAddToContext={handleAddToContext}
          initialDepth={2}
          className="flex-1 min-h-0"
        />
      </div>

      <IssuesSection
        workspaceId={workspaceId}
        activeIssueEntityId={activeIssueEntityId}
        onSelectIssue={handleSelectIssue}
        onAddToContext={handleAddIssueToContext}
      />
    </div>
  );
}
