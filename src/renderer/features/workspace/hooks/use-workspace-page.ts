import { useState, useCallback, useEffect } from "react";
import { toast, type UploadedFile } from "@/components/ui";
import { useSelector, useDispatch } from "react-redux";
import {
  setWorkspaceModel,
  setActiveTab,
  clearSelectedFile,
  removeContextFile,
  clearContextFiles,
  removeContextIssue,
  clearContextIssues,
  removeContextSignal,
  clearContextSignals,
  clearIssueTabs,
  clearSignalTabs,
  clearNoteTabs,
  setActiveWorkspaceId,
  setActiveWorkspaceForProvider,
  clearPendingGoal,
} from "@/lib/redux/slices/workspaceSlice";
import { isRunTab, isNewRunTab } from "@/features/workspace/utils/repo-utils";
import type { RootState } from "@/lib/redux";
import { useWorkspaceData } from "./use-workspace-data";
import { useWorkspaceRuns } from "./use-workspace-runs";
import { useFileContentLoader } from "./use-file-content-loader";
import { useTabHandlers } from "./use-tab-handlers";
import { serializeAttachments } from "@/features/workspace/utils/run-helpers";

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
  const contextSignals = useSelector(
    (state: RootState) => state.workspace.contextSignals,
  );
  const openIssueTabs = useSelector(
    (state: RootState) => state.workspace.openIssueTabs,
  );
  const openSignalTabs = useSelector(
    (state: RootState) => state.workspace.openSignalTabs,
  );
  const openNoteTabs = useSelector(
    (state: RootState) => state.workspace.openNoteTabs,
  );
  const pendingGoal = useSelector(
    (state: RootState) => state.workspace.pendingGoal,
  );
  const pendingAutoExecute = useSelector(
    (state: RootState) => state.workspace.pendingAutoExecute,
  );

  const [goal, setGoal] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [canResume, setCanResume] = useState(false);
  const [autoExecute, setAutoExecute] = useState(false);

  const handleModelChange = useCallback(
    (model: string) => {
      dispatch(setWorkspaceModel({ providerId, model }));
    },
    [dispatch, providerId],
  );

  const { workspaceId, selectedWorkspace, currentWorkspace } =
    useWorkspaceData(providerId);

  useEffect(() => {
    dispatch(setActiveWorkspaceId(workspaceId ?? null));
    if (workspaceId) {
      dispatch(setActiveWorkspaceForProvider({ providerId, workspaceId }));
    }
  }, [workspaceId, providerId, dispatch]);

  useEffect(() => {
    dispatch(clearSelectedFile());
    dispatch(clearContextFiles());
    dispatch(clearContextIssues());
    dispatch(clearContextSignals());
    dispatch(clearIssueTabs());
    dispatch(clearSignalTabs());
    dispatch(clearNoteTabs());
    dispatch(setActiveTab("editor"));
  }, [workspaceId, dispatch]);

  // Sync pendingGoal from Redux to local state
  useEffect(() => {
    if (pendingGoal) {
      setGoal(pendingGoal);
      if (pendingAutoExecute) {
        setAutoExecute(true);
      }
      dispatch(clearPendingGoal());
    }
  }, [pendingGoal, pendingAutoExecute, dispatch]);

  const {
    runs,
    activeRun,
    currentEvents,
    currentTurns,
    isLoading,
    eventsEndRef,
    setActiveRunId,
    executeRun,
    continueRun,
    forkRun,
    checkCanResume,
    closeTab,
    selectTab,
    setRuns,
  } = useWorkspaceRuns(workspaceId, providerId);

  useEffect(() => {
    if (runs.length > 0 && !selectedFile && activeTab === "editor") {
      const firstRun = runs[0];
      dispatch(setActiveTab(firstRun.id));
      selectTab(firstRun.id);
    }
  }, [runs, selectedFile, activeTab, dispatch, selectTab]);

  useFileContentLoader(selectedFile, currentWorkspace?.rootPath);

  const tabHandlers = useTabHandlers({
    activeTab,
    runs,
    closeTab,
    selectTab,
    setActiveRunId,
    forkRun,
    setGoal,
    setRuns,
  });

  const activeRunId = isRunTab(activeTab) ? activeTab : null;

  useEffect(() => {
    const checkResume = async () => {
      if (
        activeRunId &&
        activeRun &&
        activeRun.status !== "running" &&
        activeRun.status !== "queued"
      ) {
        const resumable = await checkCanResume(activeRunId);
        setCanResume(resumable);
      } else {
        setCanResume(false);
      }
    };
    checkResume();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeRun?.status, checkCanResume]);

  const clearInputState = useCallback(() => {
    setGoal("");
    setUploadedFiles([]);
    dispatch(clearContextFiles());
    dispatch(clearContextIssues());
    dispatch(clearContextSignals());
  }, [dispatch]);

  const handleExecute = useCallback(async () => {
    if (!workspaceId) {
      toast.error("Select a workspace before sending a prompt.");
      return;
    }

    const attachments = uploadedFiles.length > 0
      ? await serializeAttachments(uploadedFiles)
      : undefined;

    if (activeRunId && canResume && activeRun && activeRun.status !== "running") {
      const success = (await continueRun(activeRunId, goal, attachments, contextIssues, contextFiles, contextSignals, selectedModel)) ?? false;
      if (success) clearInputState();
    } else {
      const newRunId = await executeRun(
        goal,
        selectedWorkspace,
        providerId,
        selectedModel,
        attachments,
        contextIssues,
        contextFiles,
        contextSignals,
      );
      if (newRunId) {
        clearInputState();
        dispatch(setActiveTab(newRunId));
      }
    }
  }, [
    goal,
    uploadedFiles,
    contextFiles,
    contextIssues,
    contextSignals,
    workspaceId,
    selectedWorkspace,
    selectedModel,
    executeRun,
    continueRun,
    activeRunId,
    activeRun,
    canResume,
    clearInputState,
    dispatch,
    providerId,
  ]);

  // Auto-execute when pendingAutoExecute was set (e.g. "Review Changes" button, suggestion chips)
  useEffect(() => {
    if (autoExecute && goal) {
      setAutoExecute(false);
      if (!workspaceId) return;
      const run = async () => {
        if (activeRunId && canResume && activeRun && activeRun.status !== "running") {
          const success = (await continueRun(activeRunId, goal, undefined, undefined, undefined, undefined, selectedModel)) ?? false;
          if (success) clearInputState();
        } else {
          const newRunId = await executeRun(goal, selectedWorkspace, providerId, selectedModel);
          if (newRunId) {
            clearInputState();
            dispatch(setActiveTab(newRunId));
          }
        }
      };
      run();
    }
  }, [autoExecute, goal, executeRun, continueRun, workspaceId, selectedWorkspace, providerId, selectedModel, dispatch, activeRunId, canResume, activeRun, clearInputState]);

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

  const handleRemoveContextSignal = useCallback(
    (entityId: string) => {
      dispatch(removeContextSignal(entityId));
    },
    [dispatch],
  );

  const showNewRunTab = isNewRunTab(activeTab);

  const showEmptyState =
    runs.length === 0 &&
    !selectedFile &&
    openIssueTabs.length === 0 &&
    openSignalTabs.length === 0 &&
    openNoteTabs.length === 0 &&
    !showNewRunTab;

  const showInput =
    showEmptyState || isRunTab(activeTab) || isNewRunTab(activeTab);

  return {
    // State
    goal,
    setGoal,
    uploadedFiles,
    setUploadedFiles,
    canResume,
    selectedModel,
    activeTab,
    selectedFile,
    contextFiles,
    contextIssues,
    contextSignals,
    openIssueTabs,
    openSignalTabs,
    openNoteTabs,
    runs,
    activeRun,
    activeRunId,
    currentEvents,
    currentTurns,
    isLoading,
    eventsEndRef,
    currentWorkspace,
    showEmptyState,
    showInput,
    showNewRunTab,
    // Handlers
    handleModelChange,
    handleExecute,
    handleRemoveContextFile,
    handleRemoveContextIssue,
    handleRemoveContextSignal,
    setAutoExecute,
    ...tabHandlers,
  };
}
