import { useState, useCallback, useEffect } from "react";
import { toast, type UploadedFile } from "@/components/ui";
import { useAppSelector, useAppDispatch } from "@/lib/redux/hooks";
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
  removeContextSkill,
  clearContextSkills,
  removeContextBrowserSelection,
  clearContextBrowserSelections,
  removeContextCodeSelection,
  clearContextCodeSelections,
  clearIssueTabs,
  clearSignalTabs,
  clearNoteTabs,
  setActiveWorkspaceId,
  setActiveWorkspaceForProvider,
  clearPendingGoal,
  clearPendingReviewTarget,
} from "@/lib/redux/slices/workspaceSlice";
import { isRunTab, isNewRunTab } from "@/features/workspace/utils/repo-utils";
import { useWorkspaceData } from "./use-workspace-data";
import { useWorkspaceRuns } from "./use-workspace-runs";
import { useFileContentLoader } from "./use-file-content-loader";
import { useTabHandlers } from "./use-tab-handlers";
import { serializeAttachments } from "@/features/workspace/utils/run-helpers";

export function useWorkspacePage(providerId: string) {
  const dispatch = useAppDispatch();

  const selectedModel = useAppSelector(
    (state) =>
      state.workspace.selectedModelByProvider[providerId] || "",
  );
  const activeTab = useAppSelector(
    (state) => state.workspace.activeTab,
  );
  const selectedFile = useAppSelector(
    (state) => state.workspace.selectedFile,
  );
  const contextFiles = useAppSelector(
    (state) => state.workspace.contextFiles,
  );
  const contextIssues = useAppSelector(
    (state) => state.workspace.contextIssues,
  );
  const contextSignals = useAppSelector(
    (state) => state.workspace.contextSignals,
  );
  const contextSkills = useAppSelector(
    (state) => state.workspace.contextSkills,
  );
  const contextBrowserSelections = useAppSelector(
    (state) => state.workspace.contextBrowserSelections,
  );
  const contextCodeSelections = useAppSelector(
    (state) => state.workspace.contextCodeSelections,
  );
  const openIssueTabs = useAppSelector(
    (state) => state.workspace.openIssueTabs,
  );
  const openSignalTabs = useAppSelector(
    (state) => state.workspace.openSignalTabs,
  );
  const openNoteTabs = useAppSelector(
    (state) => state.workspace.openNoteTabs,
  );
  const pendingGoal = useAppSelector(
    (state) => state.workspace.pendingGoal,
  );
  const pendingAutoExecute = useAppSelector(
    (state) => state.workspace.pendingAutoExecute,
  );
  const pendingReviewTarget = useAppSelector(
    (state) => state.workspace.pendingReviewTarget,
  );
  const previousNonEditorTab = useAppSelector(
    (state) => state.workspace.previousNonEditorTab,
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
    dispatch(clearContextSkills());
    dispatch(clearContextBrowserSelections());
    dispatch(clearContextCodeSelections());
    dispatch(clearIssueTabs());
    dispatch(clearSignalTabs());
    dispatch(clearNoteTabs());
    dispatch(setActiveTab("editor"));
  }, [workspaceId, dispatch]);

  // Sync pendingGoal from Redux to local state
  useEffect(() => {
    if (!pendingGoal) return;
    const nextGoal = pendingGoal;
    const runAuto = pendingAutoExecute;
    dispatch(clearPendingGoal());
    queueMicrotask(() => {
      setGoal(nextGoal);
      if (runAuto) setAutoExecute(true);
    });
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
    executeReview,
    checkCanResume,
    closeTab,
    selectTab,
    setRuns,
  } = useWorkspaceRuns(workspaceId, providerId);

  // Handle pending review target (native code review)
  useEffect(() => {
    if (!pendingReviewTarget || !workspaceId || !selectedWorkspace) return;
    dispatch(clearPendingReviewTarget());

    const run = async () => {
      const newRunId = await executeReview(selectedWorkspace, providerId, pendingReviewTarget, selectedModel);
      if (newRunId) {
        dispatch(setActiveTab(newRunId));
      }
    };
    run();
  }, [pendingReviewTarget, workspaceId, selectedWorkspace, providerId, selectedModel, executeReview, dispatch]);

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

  // ── Composer send target ──
  // On the editor tab the composer has no run context of its own, so every
  // send used to start a fresh run. Default the target to the run tab the
  // user came from (previousNonEditorTab); the target pill in the composer
  // lets them retarget to another run or an explicit new chat. On run tabs
  // the target is simply that run, as before.
  // The override is stamped with the tab/workspace it was chosen on and
  // simply ignored once either changes — no reset effect needed.
  const [composeTargetOverride, setComposeTargetOverride] = useState<{
    tab: string;
    workspace: string | undefined;
    value: string | "new";
  } | null>(null);
  const overrideValue =
    composeTargetOverride &&
    composeTargetOverride.tab === activeTab &&
    composeTargetOverride.workspace === workspaceId
      ? composeTargetOverride.value
      : null;

  const isRetargetable = activeTab === "editor" && runs.length > 0;
  const fallbackTargetRunId =
    previousNonEditorTab &&
    isRunTab(previousNonEditorTab) &&
    runs.some((r) => r.id === previousNonEditorTab)
      ? previousNonEditorTab
      : null;
  const composeTargetRunId = isRunTab(activeTab)
    ? activeTab
    : !isRetargetable || overrideValue === "new"
      ? null
      : overrideValue && runs.some((r) => r.id === overrideValue)
        ? overrideValue
        : fallbackTargetRunId;
  const composeTargetRun = composeTargetRunId
    ? runs.find((r) => r.id === composeTargetRunId)
    : undefined;

  useEffect(() => {
    const checkResume = async () => {
      if (
        composeTargetRunId &&
        composeTargetRun &&
        composeTargetRun.status !== "running" &&
        composeTargetRun.status !== "queued"
      ) {
        const resumable = await checkCanResume(composeTargetRunId);
        setCanResume(resumable);
      } else {
        setCanResume(false);
      }
    };
    checkResume();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeTargetRunId, composeTargetRun?.status, checkCanResume]);

  const clearInputState = useCallback(() => {
    setGoal("");
    setUploadedFiles([]);
    dispatch(clearContextFiles());
    dispatch(clearContextIssues());
    dispatch(clearContextSignals());
    dispatch(clearContextSkills());
    dispatch(clearContextBrowserSelections());
    dispatch(clearContextCodeSelections());
  }, [dispatch]);

  const handleExecute = useCallback(async () => {
    if (!workspaceId) {
      toast.error("Select a workspace before sending a prompt.");
      return;
    }

    const attachments = uploadedFiles.length > 0
      ? await serializeAttachments(uploadedFiles)
      : undefined;

    if (
      composeTargetRunId &&
      canResume &&
      composeTargetRun &&
      composeTargetRun.status !== "running"
    ) {
      // Jump to the target chat right away so the message lands in view
      // (sending from the editor tab targets the run you came from).
      if (activeTab !== composeTargetRunId) {
        dispatch(setActiveTab(composeTargetRunId));
        selectTab(composeTargetRunId);
      }
      const success = (await continueRun(composeTargetRunId, goal, attachments, contextIssues, contextFiles, contextSignals, selectedModel, contextBrowserSelections, contextSkills, contextCodeSelections)) ?? false;
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
        contextBrowserSelections,
        contextSkills,
        contextCodeSelections,
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
    contextSkills,
    contextBrowserSelections,
    contextCodeSelections,
    workspaceId,
    selectedWorkspace,
    selectedModel,
    executeRun,
    continueRun,
    composeTargetRunId,
    composeTargetRun,
    activeTab,
    selectTab,
    canResume,
    clearInputState,
    dispatch,
    providerId,
  ]);

  // Auto-execute when pendingAutoExecute was set (e.g. "Review Changes" button, suggestion chips)
  useEffect(() => {
    if (autoExecute && goal) {
      queueMicrotask(() => setAutoExecute(false));
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

  const handleRemoveContextSkill = useCallback(
    (name: string) => {
      dispatch(removeContextSkill(name));
    },
    [dispatch],
  );

  const handleRemoveContextBrowserSelection = useCallback(
    (id: string) => {
      const sel = contextBrowserSelections.find((s) => s.id === id);
      dispatch(removeContextBrowserSelection(id));
      // Free the on-disk capture immediately to keep userData/browser-captures bounded.
      const api = (window as any).api?.browser;
      if (api?.deleteCapture) {
        if (sel?.screenshotCaptureName) {
          api.deleteCapture(sel.screenshotCaptureName).catch(() => {});
        }
        if (sel?.surroundingScreenshotCaptureName) {
          api.deleteCapture(sel.surroundingScreenshotCaptureName).catch(() => {});
        }
      }
    },
    [dispatch, contextBrowserSelections],
  );

  const handleRemoveContextCodeSelection = useCallback(
    (id: string) => {
      dispatch(removeContextCodeSelection(id));
    },
    [dispatch],
  );

  const runLabel = (r: { title?: string; goal: string }) =>
    r.title?.trim() ? r.title : r.goal;

  // Pill data for the composer: only when retargeting is possible (editor tab
  // with existing runs). Null hides the pill entirely.
  const sendTarget = isRetargetable
    ? {
        runId: composeTargetRunId,
        label: composeTargetRun ? runLabel(composeTargetRun) : "New chat",
        options: [
          { runId: null as string | null, label: "New chat" },
          ...runs
            .slice(0, 10)
            .map((r) => ({ runId: r.id as string | null, label: runLabel(r) })),
        ],
      }
    : null;

  const handleSendTargetChange = useCallback(
    (runId: string | null) => {
      setComposeTargetOverride({
        tab: activeTab,
        workspace: workspaceId,
        value: runId ?? "new",
      });
    },
    [activeTab, workspaceId],
  );

  // The run the composer acts on — the retarget target on the editor tab,
  // otherwise the active tab's run. Drives the input's running/stop state and
  // context-usage ring.
  const composerRun = isRetargetable ? composeTargetRun : activeRun;

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
    contextSkills,
    contextBrowserSelections,
    contextCodeSelections,
    openIssueTabs,
    openSignalTabs,
    openNoteTabs,
    runs,
    activeRun,
    activeRunId,
    composerRun,
    sendTarget,
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
    handleRemoveContextSkill,
    handleRemoveContextBrowserSelection,
    handleRemoveContextCodeSelection,
    handleSendTargetChange,
    setAutoExecute,
    ...tabHandlers,
  };
}
