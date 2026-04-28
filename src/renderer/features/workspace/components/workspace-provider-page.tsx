import { useCallback, useMemo } from "react";
import type { RefObject } from "react";
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
import {
  useAbortRunMutation,
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
} from "@/lib/redux/api";
import { useSetMainHeader } from "@/hooks/use-main-header";
import { useWorkspaceRouteTopRounding } from "@/hooks/use-workspace-route-top-rounding";
import { useBottomTerminal } from "@/hooks/use-bottom-terminal";

type WorkspaceProviderVariant = "claude" | "copilot" | "codex" | "cursor";

type PlanExitConfig = {
  key: string;
  planValue: string;
  nextValue: string;
};

interface WorkspaceProviderPageProps {
  providerId: string;
  variant: WorkspaceProviderVariant;
  planExitConfig?: PlanExitConfig;
  enableForkRun?: boolean;
  enableSuggestions?: boolean;
}

export function WorkspaceProviderPage({
  providerId,
  variant,
  planExitConfig,
  enableForkRun = false,
  enableSuggestions = false,
}: WorkspaceProviderPageProps) {
  const ws = useWorkspacePage(providerId);
  const [abortRun] = useAbortRunMutation();
  const { data: providerData } = useGetProviderByIdQuery(providerId);
  const [updateProvider] = useUpdateProviderMutation();
  const bottomTerminal = useBottomTerminal();

  const { pendingApprovals, respond: respondToolApproval } = useToolApproval(ws.runs);

  const currentApproval = ws.activeRunId
    ? pendingApprovals.find((approval) => approval.runId === ws.activeRunId)
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

  const handleApplyPlan = useCallback(async () => {
    if (providerData && planExitConfig) {
      const currentConfig = providerData.config ?? {};
      if ((currentConfig as Record<string, unknown>)[planExitConfig.key] === planExitConfig.planValue) {
        await updateProvider({
          id: providerId,
          payload: {
            config: {
              ...currentConfig,
              [planExitConfig.key]: planExitConfig.nextValue,
            },
          },
        });
      }
    }

    ws.setGoal("Execute the plan above.");
    ws.setAutoExecute(true);
  }, [ws, providerData, planExitConfig, providerId, updateProvider]);

  const tabBar = useMemo(
    () =>
      ws.showEmptyState ? null : (
        <WorkspaceTabs
          variant={variant}
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
      variant,
      ws.showEmptyState,
      ws.runs,
      ws.activeTab,
      ws.selectedFile,
      ws.openIssueTabs,
      ws.openSignalTabs,
      ws.openNoteTabs,
      ws.handleSelectEditorTab,
      ws.handleSelectRunTab,
      ws.handleCloseTab,
      ws.handleRenameRun,
      ws.handleNewRun,
      ws.handleSelectIssueTab,
      ws.handleCloseIssueTab,
      ws.handleSelectSignalTab,
      ws.handleCloseSignalTab,
      ws.handleSelectNoteTab,
      ws.handleCloseNoteTab,
      ws.handleCloseEditorTab,
      ws.showNewRunTab,
      ws.handleSelectNewRunTab,
      ws.handleCloseNewRunTab,
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
            eventsEndRef={ws.eventsEndRef as RefObject<HTMLDivElement>}
            issueTabs={ws.openIssueTabs}
            signalTabs={ws.openSignalTabs}
            turns={ws.currentTurns}
            variant={variant}
            pendingApproval={currentApproval}
            onApprovalRespond={respondToolApproval}
            onForkRun={enableForkRun ? ws.handleForkRun : undefined}
            onSuggestionSelect={enableSuggestions ? handleSuggestionSelect : undefined}
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
        providerId={providerId}
        selectedModel={ws.selectedModel}
        onModelChange={ws.handleModelChange}
        contextFiles={ws.contextFiles}
        onRemoveContextFile={ws.handleRemoveContextFile}
        contextIssues={ws.contextIssues}
        onRemoveContextIssue={ws.handleRemoveContextIssue}
        contextSignals={ws.contextSignals}
        onRemoveContextSignal={ws.handleRemoveContextSignal}
        contextSkills={ws.contextSkills}
        onRemoveContextSkill={ws.handleRemoveContextSkill}
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
