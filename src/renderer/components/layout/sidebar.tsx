import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Settings, Plus } from "@/components/ui/icons";
import {
  useGetChatSessionsQuery,
  useGetAppsQuery,
  useGetAccountQuery,
  useSetActiveMoodMutation,
  useGetEntitiesQuery,
} from "@/lib/redux/api";
import { toast } from "sonner";
import SettingsModal from "@/features/settings/components/settings-modal";
import UserProfile from "./sidebar/user-profile";
import SearchBar from "./sidebar/search-bar";
import ChatSessionList from "./sidebar/chat-session-list";
import DeleteConfirmationModal from "./sidebar/delete-confirmation-modal";
import WritingPostsList from "./sidebar/writing-posts-list";
import MoodSelector from "./sidebar/mood-selector";
import NewButton from "./sidebar/new-button";
import CreateMoodView from "./sidebar/create-mood-view";
import { useActiveMood } from "@/hooks/useActiveMood";
import { useSidebarConfig } from "@/hooks/useSidebarConfig";
import { useDeleteChatSession } from "@/hooks/useDeleteChatSession";

export default function FrostedSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreatingMood, setIsCreatingMood] = useState(false);

  const { data: sessions, isLoading } = useGetChatSessionsQuery();
  const { data: account } = useGetAccountQuery();
  const { activeMoodId, moods } = useActiveMood();
  const sidebarConfig = useSidebarConfig();
  const { data: entities = [], isLoading: isLoadingEntities } =
    useGetEntitiesQuery(
      {
        kinds: sidebarConfig.itemType === "post" ? ["post"] : [],
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

  const {
    sessionToDelete,
    isDeleting,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
  } = useDeleteChatSession();

  const filterItems = <T extends Record<string, any>>(
    items: T[] | undefined,
    query: string
  ): T[] => {
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
  };

  const filteredSessions = useMemo(
    () => filterItems(sessions, searchQuery),
    [sessions, searchQuery]
  );

  const filteredEntities = useMemo(
    () => filterItems(entities, searchQuery),
    [entities, searchQuery]
  );

  const handleRefreshApps = async () => {
    await refetchApps();
  };

  const handleSearchClear = () => {
    setIsSearchExpanded(false);
    setSearchQuery("");
  };

  const handleMoodChange = async (moodId: string) => {
    try {
      await setActiveMood(moodId || null).unwrap();
    } catch (error) {
      console.error("Error changing mood:", error);
      toast.error("Failed to change mood");
    }
  };

  return (
    <>
      <aside
        className="fixed top-0 bottom-0 left-0 z-30 transition-all duration-300"
        style={{ width: sidebarConfig.width }}
        role="complementary"
        aria-label="Chat sessions sidebar"
      >
        {isCreatingMood ? (
          <CreateMoodView onClose={() => setIsCreatingMood(false)} />
        ) : (
          <div className="h-full overflow-hidden flex flex-col">
            <div className="px-4 pt-12 shrink-0">
              <div
                className={`flex items-center transition-all duration-200 ease-in-out ${
                  isSearchExpanded ? "gap-0" : "gap-3"
                }`}
              >
                <UserProfile
                  avatarUrl={account?.avatarUrl}
                  displayName={account?.displayName}
                  isVisible={!isSearchExpanded}
                />
                <SearchBar
                  isExpanded={isSearchExpanded}
                  searchQuery={searchQuery}
                  onToggle={() => setIsSearchExpanded(true)}
                  onSearchChange={setSearchQuery}
                  onClear={handleSearchClear}
                />
              </div>
            </div>
            <div className="p-4">
              <NewButton
                onClick={() => navigate("/")}
                title={sidebarConfig.title}
              />
            </div>
            <div
              className="flex-1 overflow-y-auto noscrollbar px-4"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <div
                key={sidebarConfig.itemType}
                className="animate-fadeIn"
                style={{
                  animation: "fadeIn 300ms ease-in-out",
                }}
              >
                {sidebarConfig.itemType === "chat" && (
                  <ChatSessionList
                    sessions={filteredSessions}
                    isLoading={isLoading}
                    currentPath={location.pathname}
                    onDeleteSession={handleDeleteClick}
                  />
                )}
                {sidebarConfig.itemType === "post" && (
                  <WritingPostsList
                    posts={filteredEntities.map((entity) => ({
                      url: entity.url,
                      title: entity.title,
                      description: entity.summary || "",
                    }))}
                    isLoading={isLoadingEntities}
                  />
                )}
              </div>
            </div>
            <div
              className="px-4 py-4 space-y-3"
              style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="shrink-0 flex items-center justify-center transition-transform duration-300 cursor-pointer hover:rotate-90"
                    aria-label="Settings"
                    title="Settings"
                  >
                    <Settings className="size-5 text-primary-600 dark:text-primary-400 hover:text-primary-400 dark:hover:text-primary-100 transition-colors duration-300" />
                  </button>
                </div>
                <div className="">
                  <MoodSelector
                    moods={moods}
                    activeMoodId={activeMoodId}
                    onMoodChange={handleMoodChange}
                  />
                </div>
                <div>
                  <button
                    onClick={() => setIsCreatingMood(true)}
                    className=" cursor-pointer transition-transform duration-300  hover:rotate-90"
                    aria-label="Create new mood"
                    title="Create new mood"
                  >
                    <Plus className="size-5 text-primary-600 dark:text-primary-400 hover:text-primary-400 dark:hover:text-primary-100 transition-colors duration-300" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      <SettingsModal
        open={isSettingsOpen}
        apps={apps}
        connectedApps={connectedApps}
        onClose={() => setIsSettingsOpen(false)}
        section={"general"}
        onRefresh={handleRefreshApps}
      />

      <DeleteConfirmationModal
        isOpen={!!sessionToDelete}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}
