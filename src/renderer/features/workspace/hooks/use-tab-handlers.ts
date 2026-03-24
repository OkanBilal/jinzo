import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { useAppSelector } from "@/lib/redux/hooks";
import { useUpdateRunMutation } from "@/lib/redux/api";
import {
  setActiveTab,
  clearSelectedFile,
  closeIssueTab,
  closeSignalTab,
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
  setRuns: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useTabHandlers({
  activeTab,
  runs,
  closeTab,
  selectTab,
  setActiveRunId,
  forkRun,
  setGoal,
  setRuns,
}: UseTabHandlersParams) {
  const dispatch = useDispatch();
  const [updateRun] = useUpdateRunMutation();
  const { openIssueTabs, openSignalTabs, openNoteTabs, selectedFile } = useAppSelector(
    (state) => state.workspace,
  );

  /** Find the best tab to switch to after closing `closingTabId`. */
  const getNextTab = useCallback(
    (closingTabId: string): string => {
      for (const r of runs) {
        if (r.id !== closingTabId) return r.id;
      }
      for (const t of openIssueTabs) {
        const id = `issue:${t.issue.entityId}`;
        if (id !== closingTabId) return id;
      }
      for (const t of openSignalTabs) {
        const id = `signal:${t.signal.entityId}`;
        if (id !== closingTabId) return id;
      }
      for (const t of openNoteTabs) {
        const id = `note:${t.id}`;
        if (id !== closingTabId) return id;
      }
      if (selectedFile && closingTabId !== "editor") return "editor";
      return "editor";
    },
    [runs, openIssueTabs, openSignalTabs, openNoteTabs, selectedFile],
  );

  const handleCloseTab = useCallback(
    (runId: string) => {
      if (runId === activeTab) {
        dispatch(setActiveTab(getNextTab(runId)));
      }
      closeTab(runId);
    },
    [closeTab, activeTab, dispatch, getNextTab],
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
      if (activeTab === "new-run") {
        dispatch(setActiveTab(getNextTab("new-run")));
      }
      dispatch(closeNewRunTab());
    },
    [dispatch, activeTab, getNextTab],
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
      const closingId = `issue:${entityId}`;
      if (activeTab === closingId) {
        dispatch(setActiveTab(getNextTab(closingId)));
      }
      dispatch(closeIssueTab(entityId));
    },
    [dispatch, activeTab, getNextTab],
  );

  const handleSelectSignalTab = useCallback(
    (entityId: string) => {
      dispatch(setActiveTab(`signal:${entityId}`));
    },
    [dispatch],
  );

  const handleCloseSignalTab = useCallback(
    (entityId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const closingId = `signal:${entityId}`;
      if (activeTab === closingId) {
        dispatch(setActiveTab(getNextTab(closingId)));
      }
      dispatch(closeSignalTab(entityId));
    },
    [dispatch, activeTab, getNextTab],
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
      const closingId = `note:${noteId}`;
      if (activeTab === closingId) {
        dispatch(setActiveTab(getNextTab(closingId)));
      }
      dispatch(closeNoteTab(noteId));
    },
    [dispatch, activeTab, getNextTab],
  );

  const handleCloseEditorTab = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (activeTab === "editor") {
        dispatch(setActiveTab(getNextTab("editor")));
      }
      dispatch(clearSelectedFile());
    },
    [dispatch, activeTab, getNextTab],
  );

  const handleRenameRun = useCallback(
    (runId: string, newTitle: string) => {
      setRuns((prev: any[]) =>
        prev.map((r) => (r.id === runId ? { ...r, title: newTitle } : r)),
      );
      updateRun({ id: runId, payload: { title: newTitle } });
    },
    [updateRun, setRuns],
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
    handleRenameRun,
    handleNewRun,
    handleSelectNewRunTab,
    handleCloseNewRunTab,
    handleSelectEditorTab,
    handleSelectRunTab,
    handleSelectIssueTab,
    handleCloseIssueTab,
    handleSelectSignalTab,
    handleCloseSignalTab,
    handleSelectNoteTab,
    handleCloseNoteTab,
    handleCloseEditorTab,
    handleForkRun,
  };
}
