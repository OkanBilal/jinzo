import { useState, useCallback, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  WorkspaceEmptyState,
  WorkspaceEvents,
  WorkspaceInput,
  WorkspaceQuickActions,
} from "@/features/workspace/components";
import { useWorkspaceData, useWorkspaceRuns } from "@/features/workspace/hooks";
import {
  setWorkspaceModel,
  setActiveTab,
  setSelectedFileContent,
  setFileContentLoading,
  setFileContentError,
  clearSelectedFile,
} from "@/lib/redux/slices/workspaceSlice";
import type { RootState } from "@/lib/redux";
import type { FileContentResponse, ServiceResponse } from "@/features/file-explorer";

export default function WorkspacePage() {
  const dispatch = useDispatch();
  const selectedModel = useSelector((state: RootState) => state.workspace.selectedModel);
  const activeTab = useSelector((state: RootState) => state.workspace.activeTab);
  const selectedFile = useSelector((state: RootState) => state.workspace.selectedFile);
  const [goal, setGoal] = useState("");
  const [canResume, setCanResume] = useState(false);

  const handleModelChange = useCallback((model: string) => {
    dispatch(setWorkspaceModel(model));
  }, [dispatch]);

  const {
    workspaceId,
    selectedWorkspace,
    selectedProvider,
    currentWorkspace,
  } = useWorkspaceData();

  // Clear selected file when workspace changes
  useEffect(() => {
    dispatch(clearSelectedFile());
    dispatch(setActiveTab("editor"));
  }, [workspaceId, dispatch]);

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

  // Select first run tab if runs exist and no file is selected
  useEffect(() => {
    if (runs.length > 0 && !selectedFile && activeTab === "editor") {
      const firstRun = runs[0];
      dispatch(setActiveTab(firstRun.id));
      selectTab(firstRun.id);
    }
  }, [runs, selectedFile, activeTab, dispatch, selectTab]);

  // Load file content when selectedFile changes
  useEffect(() => {
    if (!selectedFile || selectedFile.type !== "file" || !currentWorkspace?.rootPath) {
      return;
    }

    let cancelled = false;
    const filePath = selectedFile.fullPath;

    async function loadFileContent() {
      dispatch(setFileContentLoading(true));
      dispatch(setFileContentError(null));

      try {
        const result: ServiceResponse<FileContentResponse> =
          await window.api.fileExplorer.readFileText({
            filePath,
            workspaceRoot: currentWorkspace!.rootPath,
          });

        if (cancelled) return;

        if (result.success && result.data) {
          dispatch(setSelectedFileContent(result.data));
        } else {
          dispatch(setFileContentError(result.error || "Failed to load file"));
        }
      } catch (err) {
        if (cancelled) return;
        dispatch(setFileContentError(err instanceof Error ? err.message : "Unknown error"));
      }
    }

    loadFileContent();

    return () => {
      cancelled = true;
    };
  }, [selectedFile, currentWorkspace?.rootPath, dispatch]);

  // Check if active run can be resumed when it changes or completes
  useEffect(() => {
    const checkResume = async () => {
      // Only check resume for the actual run, not when on editor tab
      const runId = activeTab !== "editor" ? activeTab : null;
      if (runId && activeRun && activeRun.status !== "running" && activeRun.status !== "queued") {
        const resumable = await checkCanResume(runId);
        setCanResume(resumable);
      } else {
        setCanResume(false);
      }
    };
    checkResume();
  }, [activeTab, activeRun?.status, checkCanResume]);

  const handleExecute = useCallback(async () => {
    let success = false;
    const currentRunId = activeTab !== "editor" ? activeTab : null;

    // If there's an active completed run that can be resumed, continue it
    if (currentRunId && canResume && activeRun && activeRun.status !== "running") {
      success = (await continueRun(currentRunId, goal)) ?? false;
    } else {
      // Otherwise start a new run
      success = (await executeRun(goal, selectedWorkspace, selectedProvider, selectedModel)) ?? false;
    }

    if (success) {
      setGoal("");
    }
  }, [goal, selectedWorkspace, selectedProvider, selectedModel, executeRun, continueRun, activeTab, activeRun, canResume]);

  const handleCloseTab = useCallback(
    (runId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      closeTab(runId);
      // If closing the active run tab, switch to editor
      if (runId === activeTab) {
        dispatch(setActiveTab("editor"));
      }
    },
    [closeTab, activeTab, dispatch],
  );

  const handleNewRun = useCallback(() => {
    setActiveRunId(null);
    // Switch to editor tab when starting new run
    dispatch(setActiveTab("editor"));
  }, [setActiveRunId, dispatch]);

  const handleSelectEditorTab = useCallback(() => {
    dispatch(setActiveTab("editor"));
  }, [dispatch]);

  const handleSelectRunTab = useCallback((runId: string) => {
    dispatch(setActiveTab(runId));
    selectTab(runId);
  }, [dispatch, selectTab]);

  // Determine if we should show empty state (no runs and no file selected)
  const showEmptyState = runs.length === 0 && !selectedFile;

  return (
    <div className="flex flex-col h-full dark:bg-[#080a0f] ">
      {/* Events Panel */}
      <div className="flex-1 overflow-hidden">
        {showEmptyState ? (
          <WorkspaceEmptyState workspace={currentWorkspace} />
        ) : (
          <WorkspaceEvents
            runs={runs}
            activeTab={activeTab}
            currentEvents={currentEvents}
            currentWorkspace={currentWorkspace}
            eventsEndRef={eventsEndRef as React.RefObject<HTMLDivElement>}
            hasSelectedFile={!!selectedFile}
            fileName={selectedFile?.name}
            onSelectEditorTab={handleSelectEditorTab}
            onSelectRunTab={handleSelectRunTab}
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
        providerId={selectedProvider}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
      />
    </div>
  );
}
