import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Settings } from "@/components/ui/icons";
import {
  useGetChatSessionsQuery,
  useDeleteChatSessionMutation,
  useGetAppsQuery,
  useGetAccountQuery,
  ChatSession,
} from "@/lib/redux/api";
import { toast } from "sonner";
import SettingsModal from "@/features/settings/components/settings-modal";
import UserProfile from "./sidebar/user-profile";
import SearchBar from "./sidebar/search-bar";
import NewChatButton from "./sidebar/new-chat-button";
import ChatSessionList from "./sidebar/chat-session-list";
import DeleteConfirmationModal from "./sidebar/delete-confirmation-modal";

export default function FrostedSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { data: sessions, isLoading } = useGetChatSessionsQuery();
  const { data: account } = useGetAccountQuery();
  const [deleteChatSession, { isLoading: isDeleting }] = useDeleteChatSessionMutation();
  const { data: apps = [], refetch: refetchApps } = useGetAppsQuery();

  const connectedApps = useMemo(() => {
    return apps.filter((app) => app.isConnected).map((app) => app.id);
  }, [apps]);

  const filteredSessions = useMemo(() => {
    if (!sessions || !searchQuery.trim()) return sessions || [];
    const query = searchQuery.toLowerCase().trim();
    return sessions.filter((session) => {
      const title = session.title || session.initialQuery || "";
      return title.toLowerCase().includes(query);
    });
  }, [sessions, searchQuery]);

  const handleDeleteClick = (session: ChatSession, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSessionToDelete(session);
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    try {
      await deleteChatSession(sessionToDelete.id).unwrap();
      toast.success("Chat deleted");
      setSessionToDelete(null);
    } catch (error) {
      console.error("Failed to delete chat:", error);
      toast.error("Failed to delete chat");
    }
  };

  const handleCancelDelete = () => {
    setSessionToDelete(null);
  };

  const handleRefreshApps = async () => {
    await refetchApps();
  };

  const handleSearchClear = () => {
    setIsSearchExpanded(false);
    setSearchQuery("");
  };

  return (
    <>
      <aside
        className="fixed top-0 bottom-0 left-0 w-72 z-30 bg-transparent"
        role="complementary"
        aria-label="Chat sessions sidebar"
      >
        <div className="h-full overflow-hidden flex flex-col">
          <div className="p-4 pt-12 shrink-0">
            <div
              className={`flex items-center mb-4 transition-all duration-300 ${isSearchExpanded ? "gap-0" : "gap-3"
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
            <NewChatButton onClick={() => navigate("/")} />
          </div>

          <div
            className="flex-1 overflow-y-auto noscrollbar px-3"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <ChatSessionList
              sessions={filteredSessions}
              isLoading={isLoading}
              currentPath={location.pathname}
              onDeleteSession={handleDeleteClick}
            />
          </div>

          <div className="p-6" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-full flex items-center gap-3 cursor-pointer"
            >
              <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400 cursor-pointer" />
            </button>
          </div>
        </div>
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
