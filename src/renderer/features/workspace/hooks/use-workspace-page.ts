import { useState, useCallback, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  setWorkspaceModel,
  setActiveTab,
  clearSelectedFile,
  removeContextFile,
  clearContextFiles,
  removeContextIssue,
  clearContextIssues,
  closeIssueTab,
  clearIssueTabs,
  closeNoteTab,
  clearNoteTabs,
  setActiveWorkspaceId,
  clearPendingGoal,
} from "@/lib/redux/slices/workspaceSlice";
import { isIssueTab, isNoteTab } from "@/features/workspace/utils/repo-utils";
import type { RootState } from "@/lib/redux";
import { toast } from "@/components/ui/toast/toast";
import { useWorkspaceData } from "./use-workspace-data";
import { useWorkspaceRuns } from "./use-workspace-runs";
import { useFileContentLoader } from "./use-file-content-loader";

export function useWorkspacePage(providerId: string) {
  const dispatch = useDispatch();

  const selectedModel = useSelector(
    (state: RootState) =>
      state.workspace.selectedModelByProvider[providerId] || "",
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
  const openNoteTabs = useSelector(
    (state: RootState) => state.workspace.openNoteTabs,
  );
  const pendingGoal = useSelector(
    (state: RootState) => state.workspace.pendingGoal,
  );

  const [goal, setGoal] = useState("");
  const [canResume, setCanResume] = useState(false);

  const handleModelChange = useCallback(
    (model: string) => {
      dispatch(setWorkspaceModel({ providerId, model }));
    },
    [dispatch, providerId],
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
    dispatch(clearNoteTabs());
    dispatch(setActiveTab("editor"));
  }, [workspaceId, dispatch]);

  // Sync pendingGoal from Redux to local state
  if (pendingGoal) {
    setGoal(pendingGoal);
    dispatch(clearPendingGoal());
  }

  const {
    runs,
    activeRun,
    currentEvents,
    isLoading,
    eventsEndRef,
    setActiveRunId,
    executeRun,
    continueRun,
    checkCanResume,
    closeTab,
    selectTab,
  } = useWorkspaceRuns(workspaceId, providerId);

  useEffect(() => {
    if (runs.length > 0 && !selectedFile && activeTab === "editor") {
      const firstRun = runs[0];
      dispatch(setActiveTab(firstRun.id));
      selectTab(firstRun.id);
    }
  }, [runs, selectedFile, activeTab, dispatch, selectTab]);

  useFileContentLoader(selectedFile, currentWorkspace?.rootPath);

  useEffect(() => {
    const checkResume = async () => {
      const runId =
        activeTab !== "editor" && !isIssueTab(activeTab) && !isNoteTab(activeTab)
          ? activeTab
          : null;
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
    if (!workspaceId) {
      toast.error("Select a workspace before sending a prompt.");
      return;
    }

    const currentRunId =
      activeTab !== "editor" && !isIssueTab(activeTab) && !isNoteTab(activeTab)
        ? activeTab
        : null;

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
        providerId,
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
    workspaceId,
    selectedWorkspace,
    selectedModel,
    executeRun,
    continueRun,
    activeTab,
    activeRun,
    canResume,
    dispatch,
    providerId,
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

  const handleSelectNoteTab = useCallback(
    (noteId: string) => {
      dispatch(setActiveTab(`note:${noteId}`));
    },
    [dispatch],
  );

  const handleCloseNoteTab = useCallback(
    (noteId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(closeNoteTab(noteId));
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

  const activeRunId =
    activeTab !== "editor" && !isIssueTab(activeTab) && !isNoteTab(activeTab)
      ? activeTab
      : null;

  const showEmptyState =
    runs.length === 0 &&
    !selectedFile &&
    openIssueTabs.length === 0 &&
    openNoteTabs.length === 0;

  // Show input only on run tabs or empty state (hide for editor/issue/note tabs)
  const showInput =
    showEmptyState ||
    (activeTab !== "editor" && !isIssueTab(activeTab) && !isNoteTab(activeTab));

  return {
    // State
    goal,
    setGoal,
    canResume,
    selectedModel,
    activeTab,
    selectedFile,
    contextFiles,
    contextIssues,
    openIssueTabs,
    openNoteTabs,
    runs,
    activeRun,
    activeRunId,
    currentEvents,
    isLoading,
    eventsEndRef,
    currentWorkspace,
    showEmptyState,
    showInput,
    // Handlers
    handleModelChange,
    handleExecute,
    handleCloseTab,
    handleNewRun,
    handleSelectEditorTab,
    handleSelectRunTab,
    handleRemoveContextFile,
    handleRemoveContextIssue,
    handleSelectIssueTab,
    handleCloseIssueTab,
    handleSelectNoteTab,
    handleCloseNoteTab,
    handleCloseEditorTab,
  };
}
