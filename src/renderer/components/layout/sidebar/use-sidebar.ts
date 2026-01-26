import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useGetChatSessionsQuery,
  useGetAppsQuery,
  useGetAccountQuery,
  useSetActiveMoodMutation,
  useDeleteMoodMutation,
  useGetJournalEntriesQuery,
  useCreateJournalDraftMutation,
  useDeleteJournalMutation,
  useGetWorkspacesQuery,
  useDeleteWorkspaceMutation,
  type Mood,
} from "@/lib/redux/api";
import { toast } from "@/components/toast";
import { useActiveMood } from "@/hooks/useActiveMood";
import { useSidebarConfig } from "@/hooks/useSidebarConfig";
import { useDeleteChatSession } from "@/hooks/useDeleteChatSession";

function filterItems<T extends { title?: string | null; initialQuery?: string | null; description?: string | null }>(
  items: T[] | undefined,
  query: string
): T[] {
  if (!items || !query.trim()) return items || [];
  const lowerQuery = query.toLowerCase().trim();
  return items.filter((item) => {
    const title = (item.title || item.initialQuery || "").toString();
    const description = (item.description || "").toString();
    return (
      title.toLowerCase().includes(lowerQuery) ||
      description.toLowerCase().includes(lowerQuery)
    );
  });
}

export function useSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreatingMood, setIsCreatingMood] = useState(false);
  const [isViewingPresetMoods, setIsViewingPresetMoods] = useState(false);

  // Create mood menu state
  const [createMoodMenuState, setCreateMoodMenuState] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>({ isOpen: false, position: { x: 0, y: 0 } });

  // Context menu state
  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    targetMood: Mood | null;
  }>({ isOpen: false, position: { x: 0, y: 0 }, targetMood: null });

  // Edit modal state
  const [editModalState, setEditModalState] = useState<{
    isOpen: boolean;
    mood: Mood | null;
  }>({ isOpen: false, mood: null });

  // Delete mood state
  const [deleteMoodState, setDeleteMoodState] = useState<{
    mood: Mood | null;
    isDeleting: boolean;
  }>({ mood: null, isDeleting: false });

  // Delete journal state
  const [deleteJournalState, setDeleteJournalState] = useState<{
    journalId: string | null;
    isDeleting: boolean;
  }>({ journalId: null, isDeleting: false });

  // Data queries
  const { data: sessions, isLoading: isLoadingSessions } =
    useGetChatSessionsQuery();
  const { data: account } = useGetAccountQuery();
  const { activeMoodId, moods } = useActiveMood();
  const sidebarConfig = useSidebarConfig();

  // Journal entries for post mode
  const { data: journalEntries = [], isLoading: isLoadingJournal } =
    useGetJournalEntriesQuery(
      { limit: 50 },
      { skip: sidebarConfig.itemType !== "post" }
    );

  const [createJournalDraft] = useCreateJournalDraftMutation();
  const [deleteJournal] = useDeleteJournalMutation();

  // Workspaces for workspace mode
  const { data: workspaces = [], isLoading: isLoadingWorkspaces } =
    useGetWorkspacesQuery(undefined, {
      skip: sidebarConfig.itemType !== "workspace",
    });

  const [deleteWorkspace] = useDeleteWorkspaceMutation();

  // Delete workspace state
  const [deleteWorkspaceState, setDeleteWorkspaceState] = useState<{
    workspaceId: string | null;
    isDeleting: boolean;
  }>({ workspaceId: null, isDeleting: false });

  // Convert journal entries to a format compatible with existing entity type
  const entities = useMemo(() => {
    return journalEntries.map((entry) => ({
      id: entry.id,
      accountId: entry.accountId,
      kind: "journal_entry",
      title: entry.title || "Untitled",
      url: `/doc/${entry.id}`,
      body: entry.body,
      summary: entry.summary,
      occurredAt: entry.occurredAt || entry.createdAt,
      connectionId: null,
      resourceId: null,
      externalId: null,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));
  }, [journalEntries]);

  const isLoadingEntities = isLoadingJournal;

  const { data: apps = [], refetch: refetchApps } = useGetAppsQuery();

  const connectedApps = useMemo(() => {
    return apps.filter((app) => app.isConnected).map((app) => app.id);
  }, [apps]);

  const [setActiveMood] = useSetActiveMoodMutation();
  const [deleteMood] = useDeleteMoodMutation();

  const deleteSession = useDeleteChatSession();

  // Filtered data
  const filteredSessions = useMemo(
    () => filterItems(sessions, searchQuery),
    [sessions, searchQuery]
  );

  const filteredEntities = useMemo(
    () => filterItems(entities, searchQuery),
    [entities, searchQuery]
  );

  // Filtered workspaces
  const filteredWorkspaces = useMemo(() => {
    if (!workspaces || !searchQuery.trim()) return workspaces || [];
    const lowerQuery = searchQuery.toLowerCase().trim();
    return workspaces.filter((ws) => {
      return (
        ws.name.toLowerCase().includes(lowerQuery) ||
        ws.rootPath.toLowerCase().includes(lowerQuery) ||
        (ws.defaultBranch && ws.defaultBranch.toLowerCase().includes(lowerQuery))
      );
    });
  }, [workspaces, searchQuery]);

  // Handlers
  const handleRefreshApps = async () => {
    await refetchApps();
  };

  const handleSearchClear = () => {
    setIsSearchExpanded(false);
    setSearchQuery("");
  };

  const handleSearchExpand = () => {
    setIsSearchExpanded(true);
  };

  const handleMoodChange = async (moodId: string) => {
    try {
      await setActiveMood(moodId || null).unwrap();

      const selectedMood = moods.find((m) => m.id === moodId);
      if (selectedMood?.uiConfig) {
        try {
          const config = JSON.parse(selectedMood.uiConfig);
          const defaultRoute = config.sidebar?.defaultRoute || "/";
          navigate(defaultRoute);
        } catch {
          navigate("/");
        }
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Error changing mood:", error);
      toast.error("Failed to change mood");
    }
  };

  const handleNewClick = async () => {
    if (sidebarConfig.itemType === "post") {
      // Create a new journal draft and navigate to it
      try {
        const result = await createJournalDraft({
          accountId: account?.id || "default",
        }).unwrap();
        if (result?.id) {
          navigate(`/doc/${result.id}`);
        }
      } catch (error) {
        console.error("Failed to create journal draft:", error);
        toast.error("Failed to create new post");
      }
    } else {
      navigate(sidebarConfig.defaultRoute);
    }
  };

  // Store the path before opening settings
  const [previousPath, setPreviousPath] = useState<string | null>(null);

  const handleOpenSettings = () => {
    setPreviousPath(location.pathname + location.search);
    setIsSettingsOpen(true);
    navigate("/settings?section=general");
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    if (previousPath) {
      navigate(previousPath);
      setPreviousPath(null);
    } else {
      navigate("/");
    }
  };

  // Create mood menu handlers
  const handleOpenCreateMoodMenu = (event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setCreateMoodMenuState({
      isOpen: true,
      position: { x: rect.left + rect.width / 2, y: rect.top },
    });
  };

  const handleCloseCreateMoodMenu = () => {
    setCreateMoodMenuState({ isOpen: false, position: { x: 0, y: 0 } });
  };

  const handleStartCreatingMood = () => {
    setIsCreatingMood(true);
    setIsViewingPresetMoods(false);
  };

  const handleStartViewingPresetMoods = () => {
    setIsViewingPresetMoods(true);
    setIsCreatingMood(false);
  };

  const handleStopCreatingMood = () => {
    setIsCreatingMood(false);
    setIsViewingPresetMoods(false);
  };

  // Context menu handlers
  const handleMoodContextMenu = (mood: Mood, event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuState({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      targetMood: mood,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenuState({
      isOpen: false,
      position: { x: 0, y: 0 },
      targetMood: null,
    });
  };

  // Edit mood handlers
  const handleEditMood = () => {
    if (contextMenuState.targetMood) {
      setEditModalState({
        isOpen: true,
        mood: contextMenuState.targetMood,
      });
    }
  };

  const handleCloseEditModal = () => {
    setEditModalState({ isOpen: false, mood: null });
  };

  // Delete mood handlers
  const handleDeleteMood = () => {
    if (contextMenuState.targetMood) {
      setDeleteMoodState({
        mood: contextMenuState.targetMood,
        isDeleting: false,
      });
    }
  };

  const handleConfirmDeleteMood = async () => {
    if (!deleteMoodState.mood) return;

    setDeleteMoodState((prev) => ({ ...prev, isDeleting: true }));

    try {
      const wasActive = activeMoodId === deleteMoodState.mood.id;
      
      await deleteMood(deleteMoodState.mood.id).unwrap();

      // If the deleted mood was active, clear it and navigate to default route
      if (wasActive) {
        await setActiveMood(null).unwrap();
        // Navigate to home route since we're back to default mood
        navigate("/");
      }

      toast.success("Mood deleted");
      setDeleteMoodState({ mood: null, isDeleting: false });
    } catch (error) {
      console.error("Error deleting mood:", error);
      toast.error("Failed to delete mood");
      setDeleteMoodState((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const handleCancelDeleteMood = () => {
    setDeleteMoodState({ mood: null, isDeleting: false });
  };

  // Delete journal handlers
  const handleDeleteJournalClick = (journalId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteJournalState({ journalId, isDeleting: false });
  };

  const handleConfirmDeleteJournal = async () => {
    const journalId = deleteJournalState.journalId;
    if (!journalId) return;

    setDeleteJournalState((prev) => ({ ...prev, isDeleting: true }));

    try {
      await deleteJournal(journalId).unwrap();
      toast.success("Post deleted");

      // Navigate away if we were viewing the deleted post
      if (location.pathname === `/doc/${journalId}`) {
        navigate("/doc");
      }
    } catch (error) {
      console.error("Error deleting journal:", error);
      toast.error("Failed to delete post");
    } finally {
      setDeleteJournalState({ journalId: null, isDeleting: false });
    }
  };

  const handleCancelDeleteJournal = () => {
    setDeleteJournalState({ journalId: null, isDeleting: false });
  };

  // Delete workspace handlers
  const handleDeleteWorkspaceClick = (workspaceId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteWorkspaceState({ workspaceId, isDeleting: false });
  };

  const handleConfirmDeleteWorkspace = async () => {
    const workspaceId = deleteWorkspaceState.workspaceId;
    if (!workspaceId) return;

    setDeleteWorkspaceState((prev) => ({ ...prev, isDeleting: true }));

    try {
      await deleteWorkspace(workspaceId).unwrap();
      toast.success("Workspace deleted");

      // Navigate away if we were viewing the deleted workspace
      if (location.pathname === `/workspace/${workspaceId}`) {
        navigate("/");
      }
    } catch (error) {
      console.error("Error deleting workspace:", error);
      toast.error("Failed to delete workspace");
    } finally {
      setDeleteWorkspaceState({ workspaceId: null, isDeleting: false });
    }
  };

  const handleCancelDeleteWorkspace = () => {
    setDeleteWorkspaceState({ workspaceId: null, isDeleting: false });
  };

  return {
    // Location
    currentPath: location.pathname,

    // UI State
    searchQuery,
    isSearchExpanded,
    isSettingsOpen,
    isCreatingMood,
    isViewingPresetMoods,
    createMoodMenuState,

    // Context menu state
    contextMenuState,
    editModalState,
    deleteMoodState,

    // Data
    account,
    sessions: filteredSessions,
    entities: filteredEntities,
    workspaces: filteredWorkspaces,
    apps,
    connectedApps,
    moods,
    activeMoodId,
    sidebarConfig,

    // Loading states
    isLoadingSessions,
    isLoadingEntities,
    isLoadingWorkspaces,

    // Delete session
    deleteSession,

    // Handlers
    setSearchQuery,
    handleSearchExpand,
    handleSearchClear,
    handleMoodChange,
    handleNewClick,
    handleOpenSettings,
    handleCloseSettings,
    handleOpenCreateMoodMenu,
    handleCloseCreateMoodMenu,
    handleStartCreatingMood,
    handleStartViewingPresetMoods,
    handleStopCreatingMood,
    handleRefreshApps,

    // Context menu handlers
    handleMoodContextMenu,
    handleCloseContextMenu,
    handleEditMood,
    handleCloseEditModal,
    handleDeleteMood,
    handleConfirmDeleteMood,
    handleCancelDeleteMood,

    // Journal handlers
    deleteJournalState,
    handleDeleteJournalClick,
    handleConfirmDeleteJournal,
    handleCancelDeleteJournal,

    // Workspace handlers
    deleteWorkspaceState,
    handleDeleteWorkspaceClick,
    handleConfirmDeleteWorkspace,
    handleCancelDeleteWorkspace,
  };
}
