import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useGetChatSessionsQuery,
  useGetAppsQuery,
  useGetAccountQuery,
  useSetActiveMoodMutation,
  useGetEntitiesQuery,
} from "@/lib/redux/api";
import { toast } from "sonner";
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

  // Data queries
  const { data: sessions, isLoading: isLoadingSessions } =
    useGetChatSessionsQuery();
  const { data: account } = useGetAccountQuery();
  const { activeMoodId, moods } = useActiveMood();
  const sidebarConfig = useSidebarConfig();

  const { data: entities = [], isLoading: isLoadingEntities } =
    useGetEntitiesQuery(
      {
        kinds: sidebarConfig.itemType === "post" ? ["doc"] : [],
        limit: 50,
      },
      {
        skip: sidebarConfig.itemType !== "post",
      }
    );

  const { data: apps = [], refetch: refetchApps } = useGetAppsQuery();

  const connectedApps = useMemo(() => {
    return apps.filter((app) => app.isConnected).map((app) => app.id);
  }, [apps]);

  const [setActiveMood] = useSetActiveMoodMutation();

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

  const handleNewClick = () => {
    navigate(sidebarConfig.defaultRoute);
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  const handleStartCreatingMood = () => {
    setIsCreatingMood(true);
  };

  const handleStopCreatingMood = () => {
    setIsCreatingMood(false);
  };

  return {
    // Location
    currentPath: location.pathname,

    // UI State
    searchQuery,
    isSearchExpanded,
    isSettingsOpen,
    isCreatingMood,

    // Data
    account,
    sessions: filteredSessions,
    entities: filteredEntities,
    apps,
    connectedApps,
    moods,
    activeMoodId,
    sidebarConfig,

    // Loading states
    isLoadingSessions,
    isLoadingEntities,

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
    handleStartCreatingMood,
    handleStopCreatingMood,
    handleRefreshApps,
  };
}
