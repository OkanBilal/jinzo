import { useCallback } from "react";
import { useDispatch } from "react-redux";
import {
  setActiveTab,
  clearSelectedFile,
  closeIssueTab,
  closeNoteTab,
  openNewRunTab,
  closeNewRunTab,
} from "@/lib/redux/slices/workspaceSlice";

interface UseTabHandlersParams {
  activeTab: string;
  runs: Array<{ id: string }>;
  closeTab: (runId: string) => void;
  selectTab: (runId: string) => void;
  setActiveRunId: (id: string | null) => void;
  forkRun: (sourceRunId: string, message: string) => Promise<string | null>;
  setGoal: (goal: string) => void;
}

export function useTabHandlers({
  activeTab,
  runs,
  closeTab,
  selectTab,
  setActiveRunId,
  forkRun,
  setGoal,
}: UseTabHandlersParams) {
  const dispatch = useDispatch();

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
    dispatch(openNewRunTab());
  }, [setActiveRunId, setGoal, dispatch]);

  const handleSelectNewRunTab = useCallback(() => {
    dispatch(setActiveTab("new-run"));
  }, [dispatch]);

  const handleCloseNewRunTab = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(closeNewRunTab());
    },
    [dispatch],
  );

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

  const handleForkRun = useCallback(
    async (sourceRunId: string, message: string) => {
      const newRunId = await forkRun(sourceRunId, message);
      if (newRunId) {
        dispatch(setActiveTab(newRunId));
      }
      return newRunId;
    },
    [forkRun, dispatch],
  );

  return {
    handleCloseTab,
    handleNewRun,
    handleSelectNewRunTab,
    handleCloseNewRunTab,
    handleSelectEditorTab,
    handleSelectRunTab,
    handleSelectIssueTab,
    handleCloseIssueTab,
    handleSelectNoteTab,
    handleCloseNoteTab,
    handleCloseEditorTab,
    handleForkRun,
  };
}
