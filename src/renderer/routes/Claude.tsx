import { useCallback, useMemo } from "react";
import {
  WorkspaceEmptyState,
  WorkspaceEvents,
  WorkspaceInput,
  WorkspaceQuickActions,
  WorkspaceTabs,
} from "@/features/workspace/components";
import { useWorkspacePage, useToolApproval } from "@/features/workspace/hooks";
import { useAbortRunMutation } from "@/lib/redux/api";
import { useSetMainHeader } from "@/hooks/use-main-header";

const CLAUDE_PROVIDER_ID = "claude_code";

export default function ClaudePage() {
  const ws = useWorkspacePage(CLAUDE_PROVIDER_ID);
  const [abortRun] = useAbortRunMutation();

  const { pendingApprovals, respond: respondToolApproval } = useToolApproval();

  const currentApproval = ws.activeRunId
    ? pendingApprovals.find((a) => a.runId === ws.activeRunId)
    : undefined;

  const handleStop = useCallback(() => {
    if (ws.activeRunId) {
      abortRun(ws.activeRunId);
    }
  }, [ws.activeRunId, abortRun]);

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      ws.setGoal(suggestion);
      ws.setAutoExecute(true);
    },
    [ws],
  );

  const tabBar = useMemo(
    () =>
      ws.showEmptyState ? null : (
        <WorkspaceTabs
          variant="claude"
          runs={ws.runs}
          activeTab={ws.activeTab}
          hasSelectedFile={!!ws.selectedFile}
          fileName={ws.selectedFile?.name}
          issueTabs={ws.openIssueTabs}
          noteTabs={ws.openNoteTabs}
          onSelectEditorTab={ws.handleSelectEditorTab}
          onSelectRunTab={ws.handleSelectRunTab}
          onCloseTab={ws.handleCloseTab}
          onNewRun={ws.handleNewRun}
          onSelectIssueTab={ws.handleSelectIssueTab}
          onCloseIssueTab={ws.handleCloseIssueTab}
          onSelectNoteTab={ws.handleSelectNoteTab}
          onCloseNoteTab={ws.handleCloseNoteTab}
          onCloseEditorTab={ws.handleCloseEditorTab}
          showNewRunTab={ws.showNewRunTab}
          onSelectNewRunTab={ws.handleSelectNewRunTab}
          onCloseNewRunTab={ws.handleCloseNewRunTab}
        />
      ),
    [
      ws.showEmptyState, ws.runs, ws.activeTab, ws.selectedFile,
      ws.openIssueTabs, ws.openNoteTabs,
      ws.handleSelectEditorTab, ws.handleSelectRunTab, ws.handleCloseTab,
      ws.handleNewRun, ws.handleSelectIssueTab, ws.handleCloseIssueTab,
      ws.handleSelectNoteTab, ws.handleCloseNoteTab, ws.handleCloseEditorTab,
      ws.showNewRunTab, ws.handleSelectNewRunTab, ws.handleCloseNewRunTab,
    ],
  );

  const isFirstTabActive = ws.selectedFile
    ? ws.activeTab === "editor"
    : ws.runs.length > 0
      ? ws.activeTab === ws.runs[0]?.id
      : false;

  useSetMainHeader(tabBar, !ws.showEmptyState && isFirstTabActive);

  return (
    <div className="flex flex-col h-full dark:bg-primary-950 rounded-t-2xl overflow-hidden">
      <div className="flex-1 overflow-hidden noscrollbar">
        {ws.showEmptyState ? (
          <WorkspaceEmptyState workspace={ws.currentWorkspace} />
        ) : (
          <WorkspaceEvents
            runs={ws.runs}
            activeTab={ws.activeTab}
            currentEvents={ws.currentEvents}
            currentWorkspace={ws.currentWorkspace}
            eventsEndRef={ws.eventsEndRef as React.RefObject<HTMLDivElement>}
            issueTabs={ws.openIssueTabs}
            turns={ws.currentTurns}
            variant="claude"
            pendingApproval={currentApproval}
            onApprovalRespond={respondToolApproval}
            onForkRun={ws.handleForkRun}
            onSuggestionSelect={handleSuggestionSelect}
          />
        )}
      </div>
      <WorkspaceQuickActions
        onSetGoal={ws.setGoal}
        projectId={ws.currentWorkspace?.projectId ?? undefined}
        providerId={CLAUDE_PROVIDER_ID}
      />
      <WorkspaceInput
        goal={ws.goal}
        onGoalChange={ws.setGoal}
        onSubmit={ws.handleExecute}
        isLoading={ws.isLoading}
        activeRun={ws.activeRun}
        canResume={ws.canResume ?? false}
        providerId={CLAUDE_PROVIDER_ID}
        selectedModel={ws.selectedModel}
        onModelChange={ws.handleModelChange}
        contextFiles={ws.contextFiles}
        onRemoveContextFile={ws.handleRemoveContextFile}
        contextIssues={ws.contextIssues}
        onRemoveContextIssue={ws.handleRemoveContextIssue}
        workspacePath={ws.currentWorkspace?.rootPath}
        projectId={ws.currentWorkspace?.projectId ?? undefined}
        uploadedFiles={ws.uploadedFiles}
        onUploadedFilesChange={ws.setUploadedFiles}
        onStop={handleStop}
      />
    </div>
  );
}
