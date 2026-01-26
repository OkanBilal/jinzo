import { useState, useCallback, useEffect } from "react";
import {
  WorkspaceEmptyState,
  WorkspaceEvents,
  WorkspaceInput,
  WorkspaceQuickActions,
} from "@/features/workspace/components";
import { useWorkspaceData, useWorkspaceRuns } from "@/features/workspace/hooks";

export default function WorkspacePage() {
  const [goal, setGoal] = useState("");
  const [canResume, setCanResume] = useState(false);

  const {
    workspaceId,
    selectedWorkspace,
    selectedProvider,
    currentWorkspace,
  } = useWorkspaceData();

  const {
    runs,
    activeRunId,
    activeRun,
    currentEvents,
    isLoading,
    error,
    eventsEndRef,
    setActiveRunId,
    executeRun,
    continueRun,
    checkCanResume,
    closeTab,
    selectTab,
  } = useWorkspaceRuns(workspaceId);

  // Check if active run can be resumed when it changes or completes
  useEffect(() => {
    const checkResume = async () => {
      if (activeRunId && activeRun && activeRun.status !== "running" && activeRun.status !== "queued") {
        const resumable = await checkCanResume(activeRunId);
        setCanResume(resumable);
      } else {
        setCanResume(false);
      }
    };
    checkResume();
  }, [activeRunId, activeRun?.status, checkCanResume]);

  const handleExecute = useCallback(async () => {
    let success = false;

    // If there's an active completed run that can be resumed, continue it
    if (activeRunId && canResume && activeRun && activeRun.status !== "running") {
      success = (await continueRun(activeRunId, goal)) ?? false;
    } else {
      // Otherwise start a new run
      success = (await executeRun(goal, selectedWorkspace, selectedProvider)) ?? false;
    }

    if (success) {
      setGoal("");
    }
  }, [goal, selectedWorkspace, selectedProvider, executeRun, continueRun, activeRunId, activeRun, canResume]);

  const handleCloseTab = useCallback(
    (runId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      closeTab(runId);
    },
    [closeTab],
  );

  const handleNewRun = useCallback(() => {
    setActiveRunId(null);
  }, [setActiveRunId]);

  return (
    <div className="flex flex-col h-full dark:bg-[#03060B] bg-primary">
      {/* Events Panel */}
      <div className="flex-1 overflow-y-auto">
        {(!activeRunId || currentEvents.length === 0) ? (
          <WorkspaceEmptyState workspace={currentWorkspace} />
        ) : (
          <WorkspaceEvents
            runs={runs}
            activeRunId={activeRunId}
            currentEvents={currentEvents}
            currentWorkspace={currentWorkspace}
            eventsEndRef={eventsEndRef as React.RefObject<HTMLDivElement>}
            onSelectTab={selectTab}
            onCloseTab={handleCloseTab}
            onNewRun={handleNewRun}
          />
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-3 bg-red-100/80 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800/50">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Quick Actions */}
      {/* <WorkspaceQuickActions onSetGoal={setGoal} /> */}

      {/* Input Form */}
      <WorkspaceInput
        goal={goal}
        onGoalChange={setGoal}
        onSubmit={handleExecute}
        isLoading={isLoading}
        activeRun={activeRun}
        canResume={canResume ?? false}
      />
    </div>
  );
}
