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
  removeContextFile,
  clearContextFiles,
  removeContextIssue,
  clearContextIssues,
  closeIssueTab,
  clearIssueTabs,
} from "@/lib/redux/slices/workspaceSlice";
import { isIssueTab } from "@/features/workspace/utils/repo-utils";
import type { RootState } from "@/lib/redux";
import type {
  FileContentResponse,
  ServiceResponse,
} from "@/features/file-explorer";
import { toast } from "@/components/toast";

// Claude provider ID
const CLAUDE_PROVIDER_ID = "claude_code";

export default function ClaudePage() {
  const dispatch = useDispatch();
  const selectedModel = useSelector(
    (state: RootState) =>
      state.workspace.selectedModelByProvider[CLAUDE_PROVIDER_ID] || "",
  );
  const activeTab = useSelector(
    (state: RootState) => state.workspace.activeTab,
  );
  const selectedFile = useSelector(
    (state: RootState) => state.workspace.selectedFile,
  );
  const contextFiles = useSelector(
    (state: RootState) => state.workspace.contextFiles,
  );
  const contextIssues = useSelector(
    (state: RootState) => state.workspace.contextIssues,
  );
  const openIssueTabs = useSelector(
    (state: RootState) => state.workspace.openIssueTabs,
  );

  const [goal, setGoal] = useState("");
  const [canResume, setCanResume] = useState(false);

  const handleModelChange = useCallback(
    (model: string) => {
      dispatch(setWorkspaceModel({ providerId: CLAUDE_PROVIDER_ID, model }));
    },
    [dispatch],
  );

  const { workspaceId, selectedWorkspace, currentWorkspace } =
    useWorkspaceData();

  // Clear selected file, context files, and issue tabs when workspace changes
  useEffect(() => {
    dispatch(clearSelectedFile());
    dispatch(clearContextFiles());
    dispatch(clearContextIssues());
    dispatch(clearIssueTabs());
    dispatch(setActiveTab("editor"));
  }, [workspaceId, dispatch]);

  const {
    runs,
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
  } = useWorkspaceRuns(workspaceId, CLAUDE_PROVIDER_ID);

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
    if (
      !selectedFile ||
      selectedFile.type !== "file" ||
      !currentWorkspace?.rootPath
    ) {
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
        dispatch(
          setFileContentError(
            err instanceof Error ? err.message : "Unknown error",
          ),
        );
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
      // Only check resume for run tabs, not editor or issue tabs
      const runId =
        activeTab !== "editor" && !isIssueTab(activeTab) ? activeTab : null;
      if (
        runId &&
        activeRun &&
        activeRun.status !== "running" &&
        activeRun.status !== "queued"
      ) {
        const resumable = await checkCanResume(runId);
        setCanResume(resumable);
      } else {
        setCanResume(false);
      }
    };
    checkResume();
  }, [activeTab, activeRun?.status, checkCanResume]);

  const handleExecute = useCallback(async () => {
    const currentRunId =
      activeTab !== "editor" && !isIssueTab(activeTab) ? activeTab : null;

    // Build the final goal with context files and issues
    let finalGoal = goal;
    if (contextFiles.length > 0) {
      const filesList = contextFiles.map((f) => f.fullPath).join("\n");
      finalGoal = `Use these files as context:\n${filesList}\n\n${finalGoal}`;
    }
    if (contextIssues.length > 0) {
      const issuesList = contextIssues
        .map((i) => {
          const issueLabel = `[${i.provider.toUpperCase()}${i.number ? ` #${i.number}` : ""}] ${i.title}`;
          const issueBody = i.body ? `\n${i.body}` : "";
          return `${issueLabel}${issueBody}`;
        })
        .join("\n\n---\n\n");
      finalGoal = `Use these issues as context:\n\n${issuesList}\n\n${finalGoal}`;
    }

    // If there's an active completed run that can be resumed, continue it
    if (
      currentRunId &&
      canResume &&
      activeRun &&
      activeRun.status !== "running"
    ) {
      const success = (await continueRun(currentRunId, finalGoal)) ?? false;
      if (success) {
        setGoal("");
        dispatch(clearContextFiles());
        dispatch(clearContextIssues());
      }
    } else {
      // Otherwise start a new run - always use Claude provider
      const newRunId = await executeRun(
        finalGoal,
        selectedWorkspace,
        CLAUDE_PROVIDER_ID,
        selectedModel,
      );

      if (newRunId) {
        setGoal("");
        dispatch(clearContextFiles());
        dispatch(clearContextIssues());
        // Switch to the new run tab
        dispatch(setActiveTab(newRunId));
      }
    }
  }, [
    goal,
    contextFiles,
    contextIssues,
    selectedWorkspace,
    selectedModel,
    executeRun,
    continueRun,
    activeTab,
    activeRun,
    canResume,
    dispatch,
  ]);

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
    setGoal("");
  }, [setActiveRunId]);

  const handleSelectEditorTab = useCallback(() => {
    dispatch(setActiveTab("editor"));
  }, [dispatch]);

  const handleSelectRunTab = useCallback(
    (runId: string) => {
      dispatch(setActiveTab(runId));
      selectTab(runId);
    },
    [dispatch, selectTab],
  );

  const handleRemoveContextFile = useCallback(
    (filePath: string) => {
      dispatch(removeContextFile(filePath));
    },
    [dispatch],
  );

  const handleRemoveContextIssue = useCallback(
    (entityId: string) => {
      dispatch(removeContextIssue(entityId));
    },
    [dispatch],
  );

  const handleSelectIssueTab = useCallback(
    (entityId: string) => {
      dispatch(setActiveTab(`issue:${entityId}`));
    },
    [dispatch],
  );

  const handleCloseIssueTab = useCallback(
    (entityId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(closeIssueTab(entityId));
    },
    [dispatch],
  );

  const handleCloseEditorTab = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(clearSelectedFile());
      // Switch to first run tab if available
      if (runs.length > 0) {
        dispatch(setActiveTab(runs[0].id));
      }
    },
    [dispatch, runs],
  );

  const showEmptyState =
    runs.length === 0 && !selectedFile && openIssueTabs.length === 0;

  return (
    <div className="flex flex-col h-full dark:bg-claude-dark">
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
            issueTabs={openIssueTabs}
            variant="claude"
            onSelectEditorTab={handleSelectEditorTab}
            onSelectRunTab={handleSelectRunTab}
            onCloseTab={handleCloseTab}
            onNewRun={handleNewRun}
            onSelectIssueTab={handleSelectIssueTab}
            onCloseIssueTab={handleCloseIssueTab}
            onCloseEditorTab={handleCloseEditorTab}
          />
        )}
      </div>
      {/* <WorkspaceQuickActions onSetGoal={setGoal} /> */}
      <WorkspaceInput
        goal={goal}
        onGoalChange={setGoal}
        onSubmit={handleExecute}
        isLoading={isLoading}
        activeRun={activeRun}
        canResume={canResume ?? false}
        providerId={CLAUDE_PROVIDER_ID}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        contextFiles={contextFiles}
        onRemoveContextFile={handleRemoveContextFile}
        contextIssues={contextIssues}
        onRemoveContextIssue={handleRemoveContextIssue}
      />
    </div>
  );
}
