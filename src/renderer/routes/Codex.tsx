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

const CODEX_PROVIDER_ID = "codex";

export default function CodexPage() {
  const ws = useWorkspacePage(CODEX_PROVIDER_ID);
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

  const tabBar = useMemo(
    () =>
      ws.showEmptyState ? null : (
        <WorkspaceTabs
          variant="codex"
          runs={ws.runs}
          activeTab={ws.activeTab}
          hasSelectedFile={!!ws.selectedFile}
          fileName={ws.selectedFile?.name}
          issueTabs={ws.openIssueTabs}
          signalTabs={ws.openSignalTabs}
          noteTabs={ws.openNoteTabs}
          onSelectEditorTab={ws.handleSelectEditorTab}
          onSelectRunTab={ws.handleSelectRunTab}
          onCloseTab={ws.handleCloseTab}
          onRenameRun={ws.handleRenameRun}
          onNewRun={ws.handleNewRun}
          onSelectIssueTab={ws.handleSelectIssueTab}
          onCloseIssueTab={ws.handleCloseIssueTab}
          onSelectSignalTab={ws.handleSelectSignalTab}
          onCloseSignalTab={ws.handleCloseSignalTab}
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
      ws.openIssueTabs, ws.openSignalTabs, ws.openNoteTabs,
      ws.handleSelectEditorTab, ws.handleSelectRunTab, ws.handleCloseTab, ws.handleRenameRun,
      ws.handleNewRun, ws.handleSelectIssueTab, ws.handleCloseIssueTab,
      ws.handleSelectSignalTab, ws.handleCloseSignalTab,
      ws.handleSelectNoteTab, ws.handleCloseNoteTab, ws.handleCloseEditorTab,
      ws.showNewRunTab, ws.handleSelectNewRunTab, ws.handleCloseNewRunTab,
    ],
  );

  const isFirstTabActive = ws.selectedFile
    ? ws.activeTab === "editor"
    : ws.runs.length > 0
      ? ws.activeTab === ws.runs[0]?.id
      : ws.openIssueTabs.length > 0
        ? ws.activeTab === `issue:${ws.openIssueTabs[0]?.issue.entityId}`
        : ws.openSignalTabs.length > 0
          ? ws.activeTab === `signal:${ws.openSignalTabs[0]?.signal.entityId}`
          : ws.openNoteTabs.length > 0
            ? ws.activeTab === `note:${ws.openNoteTabs[0]?.id}`
            : ws.showNewRunTab
              ? ws.activeTab === "new-run"
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
            signalTabs={ws.openSignalTabs}
            variant="codex"
            turns={ws.currentTurns}
            pendingApproval={currentApproval}
            onApprovalRespond={respondToolApproval}
          />
        )}
      </div>
      <WorkspaceQuickActions
        onSetGoal={ws.setGoal}
        projectId={ws.currentWorkspace?.projectId ?? undefined}
        providerId={CODEX_PROVIDER_ID}
      />
      <WorkspaceInput
        goal={ws.goal}
        onGoalChange={ws.setGoal}
        onSubmit={ws.handleExecute}
        isLoading={ws.isLoading}
        activeRun={ws.activeRun}
        canResume={ws.canResume ?? false}
        providerId={CODEX_PROVIDER_ID}
        selectedModel={ws.selectedModel}
        onModelChange={ws.handleModelChange}
        contextFiles={ws.contextFiles}
        onRemoveContextFile={ws.handleRemoveContextFile}
        contextIssues={ws.contextIssues}
        onRemoveContextIssue={ws.handleRemoveContextIssue}
        contextSignals={ws.contextSignals}
        onRemoveContextSignal={ws.handleRemoveContextSignal}
        workspacePath={ws.currentWorkspace?.rootPath}
        projectId={ws.currentWorkspace?.projectId ?? undefined}
        uploadedFiles={ws.uploadedFiles}
        onUploadedFilesChange={ws.setUploadedFiles}
        onStop={handleStop}
      />
    </div>
  );
}
