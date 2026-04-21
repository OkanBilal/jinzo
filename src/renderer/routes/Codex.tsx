import { useCallback, useMemo } from "react";
import {
  WorkspaceEmptyState,
  WorkspaceEvents,
  WorkspaceInput,
  WorkspaceTabs,
  TerminalSection,
  DiffSummaryBar,
} from "@/features/workspace/components";
import { useWorkspacePage, useToolApproval } from "@/features/workspace/hooks";
import { isFirstWorkspaceTabActive } from "@/features/workspace/utils/is-first-workspace-tab-active";
import { useAbortRunMutation, useGetProviderByIdQuery, useUpdateProviderMutation } from "@/lib/redux/api";
import { useSetMainHeader } from "@/hooks/use-main-header";
import { useWorkspaceRouteTopRounding } from "@/hooks/use-workspace-route-top-rounding";
import { useBottomTerminal } from "@/hooks/use-bottom-terminal";

const CODEX_PROVIDER_ID = "codex";

export default function CodexPage() {
  const ws = useWorkspacePage(CODEX_PROVIDER_ID);
  const [abortRun] = useAbortRunMutation();
  const { data: providerData } = useGetProviderByIdQuery(CODEX_PROVIDER_ID);
  const [updateProvider] = useUpdateProviderMutation();
  const bottomTerminal = useBottomTerminal();

  const { pendingApprovals, respond: respondToolApproval } = useToolApproval();

  const currentApproval = ws.activeRunId
    ? pendingApprovals.find((a) => a.runId === ws.activeRunId)
    : undefined;

  const handleApplyPlan = useCallback(async () => {
    if (providerData) {
      const currentConfig = providerData.config ?? {};
      if ((currentConfig as any).sandboxMode === "plan") {
        await updateProvider({
          id: CODEX_PROVIDER_ID,
          payload: { config: { ...currentConfig, sandboxMode: "workspace-write" } },
        });
      }
    }
    ws.setGoal("Execute the plan above.");
    ws.setAutoExecute(true);
  }, [ws, providerData, updateProvider]);

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

  const isFirstTabActive = isFirstWorkspaceTabActive({
    selectedFile: ws.selectedFile,
    activeTab: ws.activeTab,
    openIssueTabs: ws.openIssueTabs,
    openSignalTabs: ws.openSignalTabs,
    openNoteTabs: ws.openNoteTabs,
    runs: ws.runs,
    showNewRunTab: ws.showNewRunTab,
  });

  useSetMainHeader(tabBar, !ws.showEmptyState && isFirstTabActive);

  const routeTopRounding = useWorkspaceRouteTopRounding();

  return (
    <div className={`flex flex-col h-full dark:bg-primary-950 ${routeTopRounding} overflow-hidden`}>
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
            onForkRun={ws.handleForkRun}
            onApplyPlan={handleApplyPlan}
          />
        )}
      </div>

      {ws.currentWorkspace && (
        <DiffSummaryBar
          workspaceId={ws.currentWorkspace.id}
          rootPath={ws.currentWorkspace.rootPath}
          isRunning={ws.isLoading}
          lastCompletedRunId={ws.activeRun?.status !== "running" ? ws.activeRunId : null}
        />
      )}
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
        contextBrowserSelections={ws.contextBrowserSelections}
        onRemoveContextBrowserSelection={ws.handleRemoveContextBrowserSelection}
        workspacePath={ws.currentWorkspace?.rootPath}
        projectId={ws.currentWorkspace?.projectId ?? undefined}
        uploadedFiles={ws.uploadedFiles}
        onUploadedFilesChange={ws.setUploadedFiles}
        onStop={handleStop}
      />
      {ws.currentWorkspace && (
        <TerminalSection
          workspaceId={ws.currentWorkspace.id}
          rootPath={ws.currentWorkspace.rootPath}
          isOpen={bottomTerminal.isOpen}
          onClose={bottomTerminal.close}
        />
      )}
    </div>
  );
}
