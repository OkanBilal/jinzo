import { useState, useCallback, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  WorkspaceEmptyState,
  WorkspaceEvents,
  WorkspaceInput,
  WorkspaceQuickActions,
} from "@/features/workspace/components";
import {
  useWorkspaceData,
  useWorkspaceRuns,
  useToolApproval,
} from "@/features/workspace/hooks";
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
  setActiveWorkspaceId,
} from "@/lib/redux/slices/workspaceSlice";
import { isIssueTab } from "@/features/workspace/utils/repo-utils";
import type { RootState } from "@/lib/redux";
import type {
  FileContentResponse,
  ServiceResponse,
} from "@/features/workspace/components/file-explorer";

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

  useEffect(() => {
    dispatch(setActiveWorkspaceId(workspaceId ?? null));
  }, [workspaceId, dispatch]);

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

  const { pendingApprovals, respond: respondToolApproval, dismissForRun } =
    useToolApproval();

  useEffect(() => {
    if (runs.length > 0 && !selectedFile && activeTab === "editor") {
      const firstRun = runs[0];
      dispatch(setActiveTab(firstRun.id));
      selectTab(firstRun.id);
    }
  }, [runs, selectedFile, activeTab, dispatch, selectTab]);

  useEffect(() => {
    if (
      !selectedFile ||
      selectedFile.type !== "file" ||
      !currentWorkspace?.rootPath ||
      selectedFile.extension === "diff"
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

  useEffect(() => {
    const checkResume = async () => {
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
      if (runs.length > 0) {
        dispatch(setActiveTab(runs[0].id));
      }
    },
    [dispatch, runs],
  );

  // Get the first pending approval for the active run tab
  const activeRunId =
    activeTab !== "editor" && !isIssueTab(activeTab) ? activeTab : null;
  const currentApproval = activeRunId
    ? pendingApprovals.find((a) => a.runId === activeRunId)
    : undefined;

  const handleApprovalRespond = useCallback(
    (requestId: string, approved: boolean, answer?: string) => {
      respondToolApproval(requestId, approved, answer);
    },
    [respondToolApproval],
  );

  const showEmptyState =
    runs.length === 0 && !selectedFile && openIssueTabs.length === 0;

  return (
    <div className="flex flex-col h-full dark:bg-claude-dark">
      <div className="flex-1 overflow-hidden noscrollbar">
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
            pendingApproval={currentApproval}
            onApprovalRespond={handleApprovalRespond}
          />
        )}
      </div>
      {/* <WorkspaceQuickActions  onSetGoal={setGoal} /> */}
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
        workspacePath={currentWorkspace?.rootPath}
      />
    </div>
  );
}
