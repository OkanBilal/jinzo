import { useCallback, useMemo, useState } from "react";
import { getProviderVariant } from "@/lib/provider-variants";
import type { ProviderVariant } from "@/lib/provider-variants";
import type { RefObject } from "react";
import {
  WorkspaceEmptyState,
  WorkspaceEvents,
  WorkspaceInput,
  WorkspaceTabs,
  TerminalSection,
  DiffSummaryBar,
  GoalSummaryBar,
  TodoSummaryBar,
} from "@/features/workspace/components";
import { ToolApprovalDialog } from "@/features/workspace/components/tools/tool-approval-dialog";
import { parseStructuralPlanSnapshot } from "@/features/workspace/components/todo-summary-bar";
import {
  useWorkspacePage,
  useToolApproval,
  PluginLogoProvider,
} from "@/features/workspace/hooks";
import { isFirstWorkspaceTabActive } from "@/features/workspace/utils/is-first-workspace-tab-active";
import {
  useAbortRunMutation,
  useGetProviderByIdQuery,
  useUpdateProviderMutation,
} from "@/lib/redux/api";
import { useAppSelector } from "@/lib/redux/hooks";
import { useSetMainHeader } from "@/hooks/use-main-header";
import { useWorkspaceRouteTopRounding } from "@/hooks/use-workspace-route-top-rounding";
import { useBottomTerminal } from "@/hooks/use-bottom-terminal";
import {
  isExitPlanApproval,
  respondToExitPlanApproval,
} from "@/features/workspace/lib/plan-approval";

interface WorkspaceProviderPageProps {
  providerId: string;
  variant: ProviderVariant;
}

export function WorkspaceProviderPage({
  providerId,
  variant,
}: WorkspaceProviderPageProps) {
  // Per-variant page behavior comes straight from the descriptor table —
  // no props to forget or default divergently.
  const {
    planExit: planExitConfig,
    enableForkRun,
    enableSuggestions,
  } = getProviderVariant(variant);
  const onboardingCompleted = useAppSelector(
    (state) => state.appSettings.onboardingCompleted,
  );
  const ws = useWorkspacePage(providerId);
  const [customizeRequested, setCustomizeRequested] = useState(false);
  const [abortRun] = useAbortRunMutation();
  const { data: providerData } = useGetProviderByIdQuery(providerId);
  const [updateProvider] = useUpdateProviderMutation();
  const bottomTerminal = useBottomTerminal();

  const { pendingApprovals, respond: respondToolApproval } = useToolApproval(
    ws.runs,
  );

  const useCenteredPromptLayout =
    (ws.showEmptyState && onboardingCompleted) || ws.showNewRunTab;
  const customizing =
    customizeRequested && (ws.showEmptyState || ws.showNewRunTab);

  const currentApproval = ws.activeRunId
    ? pendingApprovals.find((approval) => approval.runId === ws.activeRunId)
    : undefined;
  const currentPlanApproval = isExitPlanApproval(currentApproval)
    ? currentApproval
    : undefined;
  const currentStructuralPlan = useMemo(() => {
    const activeTurn = ws.currentTurns.find(
      (turn) => turn.status === "active",
    );
    return parseStructuralPlanSnapshot(
      activeTurn?.metadata?.codexPlan,
    );
  }, [ws.currentTurns]);

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
      if (
        (currentConfig as Record<string, unknown>)[planExitConfig.key] ===
        planExitConfig.planValue
      ) {
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

    if (
      respondToExitPlanApproval(
        currentPlanApproval,
        true,
        respondToolApproval,
      )
    ) {
      return;
    }

    // A plan tool-call start can render a frame before its approval request
    // reaches renderer state. Never launch a second turn during that gap (or
    // while another tool approval is pending); the active run owns the plan.
    if (ws.activeRun?.status === "running" || ws.activeRun?.status === "queued") {
      return;
    }

    ws.setGoal("Execute the plan above.");
    ws.setAutoExecute(true);
  }, [
    ws,
    providerData,
    planExitConfig,
    providerId,
    updateProvider,
    currentPlanApproval,
    respondToolApproval,
  ]);

  const handleDismissPlan = useCallback(() => {
    respondToExitPlanApproval(
      currentPlanApproval,
      false,
      respondToolApproval,
    );
  }, [currentPlanApproval, respondToolApproval]);

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
    <PluginLogoProvider providerId={providerId}>
    <div
      className={`flex flex-col h-full dark:bg-primary-950 ${routeTopRounding} overflow-hidden`}
    >
      <div className="flex-1 overflow-hidden noscrollbar min-h-0">
        {useCenteredPromptLayout ? (
          <div className="flex h-full min-h-0 flex-col items-center justify-center-safe gap-8 overflow-y-auto px-4 py-10 noscrollbar">
            <WorkspaceEmptyState
              workspace={ws.currentWorkspace}
              presentation="headline"
              isCustomizing={customizing}
              onToggleCustomize={() => setCustomizeRequested((prev) => !prev)}
            />
            {customizing ? null : (
              <div className="w-full flex flex-col items-center gap-3">
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
                  contextBrowserSelections={ws.contextBrowserSelections}
                  onRemoveContextBrowserSelection={
                    ws.handleRemoveContextBrowserSelection
                  }
                  workspacePath={ws.currentWorkspace?.rootPath}
                  projectId={ws.currentWorkspace?.projectId ?? undefined}
                  uploadedFiles={ws.uploadedFiles}
                  onUploadedFilesChange={ws.setUploadedFiles}
                  onStop={handleStop}
                  isNewRunTabActive={ws.showNewRunTab}
                  layout="centered"
                />
              </div>
            )}
          </div>
        ) : ws.showEmptyState ? (
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
            onForkRun={enableForkRun ? ws.handleForkRun : undefined}
            onSuggestionSelect={
              enableSuggestions ? handleSuggestionSelect : undefined
            }
            onApplyPlan={handleApplyPlan}
            onDismissPlan={handleDismissPlan}
            hasPendingPlanApproval={!!currentPlanApproval}
          />
        )}
      </div>

      {/* Pinned just above the input rather than inline in the transcript:
          the transcript fills all remaining height, so an inline dialog left a
          large empty gap below it (short runs) or floated mid-scroll (long
          runs). Anchoring it here keeps it directly above the input and always
          reachable regardless of scroll position or conversation length. */}

      <div className="px-4">
      {currentApproval &&
        !currentPlanApproval &&
        !ws.showEmptyState &&
        !ws.showNewRunTab && (
        <div className="w-full max-w-200 mx-auto max-h-[55vh] overflow-y-auto noscrollbar">
          <ToolApprovalDialog
            request={currentApproval}
            onRespond={respondToolApproval}
            variant={variant}
          />
        </div>
      )}
      {/* Shown only while the active run is running, so it disappears on
          completion. Gated on the run's status (which stays "running" for the
          whole run) rather than `isLoading` (which only tracks the brief
          start/continue IPC call, making the bar flash and vanish mid-run). */}
      {ws.showEmptyState || ws.showNewRunTab || ws.activeRun?.status !== "running" ? null : (
        <TodoSummaryBar
          events={ws.currentEvents}
          structuralPlan={currentStructuralPlan}
        />
      )}

      {ws.currentWorkspace && !ws.showEmptyState && !ws.showNewRunTab && (
        <DiffSummaryBar
          workspaceId={ws.currentWorkspace.id}
          rootPath={ws.currentWorkspace.rootPath}
          isRunning={ws.isLoading}
          lastCompletedRunId={
            ws.activeRun?.status !== "running" ? ws.activeRunId : null
          }
        />
      )}

      {ws.currentWorkspace && !ws.showEmptyState && !ws.showNewRunTab && (
        <GoalSummaryBar
          providerId={providerId}
          runId={ws.activeRun?.id}
          isRunning={ws.activeRun?.status === "running"}
          enabled={getProviderVariant(variant).supportsGoalMode}
          rootPath={ws.currentWorkspace.rootPath}
        />
      )}

      {onboardingCompleted && !ws.showEmptyState && !ws.showNewRunTab ? (
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
          contextBrowserSelections={ws.contextBrowserSelections}
          onRemoveContextBrowserSelection={
            ws.handleRemoveContextBrowserSelection
          }
          workspacePath={ws.currentWorkspace?.rootPath}
          projectId={ws.currentWorkspace?.projectId ?? undefined}
          uploadedFiles={ws.uploadedFiles}
          onUploadedFilesChange={ws.setUploadedFiles}
          onStop={handleStop}
          isNewRunTabActive={ws.showNewRunTab}
        />
      ) : null}
      </div>

      {ws.currentWorkspace && (
        <TerminalSection
          workspaceId={ws.currentWorkspace.id}
          rootPath={ws.currentWorkspace.rootPath}
          isOpen={bottomTerminal.isOpen}
          onClose={bottomTerminal.close}
        />
      )}
    </div>
    </PluginLogoProvider>
  );
}
