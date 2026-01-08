"use client";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  // Feed,
  Home,
  //Inbox,
  Settings,
  Search,
  Close,
} from "../../components/ui/icons";
import {
  useGetAppsQuery,
  useGetChatSessionsQuery,
  useDeleteChatSessionMutation,
  ChatSession,
} from "../../lib/redux/api";
import { useIsActive } from "../../lib/navigation";
import SettingsModal from "../../features/settings/components/settings-modal";
import { Input } from "../../components/ui/input";
//import { formatDate } from "../../lib/format-date";
import Text, { Body, Caption, Muted } from "../../components/ui/text";
import { toast } from "sonner";

const SETTINGS_LABEL = "Settings";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}
export const NAV_ITEMS: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

function getNavItemClasses(isActive: boolean): string {
  const stateClass = isActive
    ? "text-primary-900 dark:text-primary-50"
    : "text-primary-700 dark:text-primary-300 hover:text-primary-900 dark:hover:text-primary-50 ";
  return `flex items-center  text-sm transition-colors ${stateClass} cursor-pointer`;
}

function getSidebarClasses(): string {
  return `hidden sm:block fixed top-2 bottom-2 left-2 rounded-2xl overflow-hidden z-30 w-[260px] bg-primary-900/30`;
}

export default function Sidebar() {
  const isActive = useIsActive();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(
    null
  );

  const { data: apps = [], refetch: refetchApps } = useGetAppsQuery();
  const { data: sessions, isLoading: loadingSessions } =
    useGetChatSessionsQuery();
  const [deleteChatSession, { isLoading: isDeleting }] =
    useDeleteChatSessionMutation();

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

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowSettingsModal(true);
  };

  const handleCloseSettings = () => {
    setShowSettingsModal(false);
  };

  const handleRefreshApps = async () => {
    await refetchApps();
  };

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

  return (
    <>
      <SettingsModal
        open={showSettingsModal}
        apps={apps}
        connectedApps={connectedApps}
        onClose={handleCloseSettings}
        section={"general"}
        onRefresh={handleRefreshApps}
      />
      {sessionToDelete && (
        <DeleteConfirmModal
          sessionTitle={
            sessionToDelete.title ||
            sessionToDelete.initialQuery ||
            `Chat ${sessionToDelete.id}`
          }
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          loading={isDeleting}
        />
      )}
      <aside aria-label="Site navigation" className={getSidebarClasses()}>
        <div className="flex flex-col h-full p-4">
          {/* Home Link */}
          <div className="flex mb-4">
            <Link to="/" className={getNavItemClasses(isActive("/"))}>
              <span className="ml-2 font-palette-altthree text-xl font-handwriting">JINZO</span>
            </Link>
          </div>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500 dark:text-primary-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm pl-9 border border-primary-200 dark:border-primary-800/50 bg-primary-50 dark:bg-primary-900 rounded-2xl text-primary-800 dark:text-primary-200 focus:ring-0 focus:border-primary-300 dark:focus:border-primary-700"
              />
            </div>
          </div>

          {/* Chat Sessions List */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden noscrollbar">
            {loadingSessions && (
              <div className="py-4 text-center">
                <Body className="text-primary-500 dark:text-primary-400">
                  Loading chats…
                </Body>
              </div>
            )}
            {!loadingSessions && filteredSessions.length === 0 && (
              <div className="py-4 text-center">
                <Body className="text-primary-400">No chats found.</Body>
              </div>
            )}
            {!loadingSessions && filteredSessions.length > 0 && (
              <div className="flex flex-col space-y-1">
                {filteredSessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Settings at bottom */}
          <div className="">
            {NAV_ITEMS.map((item) => {
              const isSettingsItem = item.label === SETTINGS_LABEL;
              if (isSettingsItem) {
                return (
                  <SettingsNavButton
                    key={item.href}
                    item={item}
                    className={getNavItemClasses(false)}
                    onClick={handleSettingsClick}
                  />
                );
              }
              return null;
            })}
          </div>
        </div>
      </aside>
    </>
  );
}

interface SessionItemProps {
  session: ChatSession;
  onDelete: (session: ChatSession, e: React.MouseEvent) => void;
}

function SessionItem({ session, onDelete }: SessionItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const label = session.title || session.initialQuery || `Chat ${session.id}`;
  //const dateLabel = formatDate(session.updatedAt);
  const url = `/chat/${session.id}`;

  return (
    <Link
      to={url}
      className="group flex items-center justify-between p-2 gap-2 rounded-lg text-primary-700 dark:text-primary-300 hover:text-primary-900 dark:hover:text-primary-50 hover:bg-primary-100 dark:hover:bg-primary-900/50 relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Body className="truncate flex-1">{label}</Body>
      <div className="flex items-center gap-2 shrink-0">
        {/* {!isHovered && <Caption className="opacity-60">{dateLabel}</Caption>} */}
        {isHovered && (
          <button
            onClick={(e) => onDelete(session, e)}
            className="cursor-pointer text-primary-500 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-50 transition-colors"
            aria-label="Delete chat"
          >
            <Close className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </Link>
  );
}

interface SettingsNavButtonProps {
  item: NavItem;
  className: string;
  onClick: (e: React.MouseEvent) => void;
}

function SettingsNavButton({
  item,
  className,
  onClick,
}: SettingsNavButtonProps) {
  const IconComponent = item.icon;

  return (
    <button onClick={onClick} className={className}>
      <IconComponent className="opacity-90 w-5 h-5" />
    </button>
  );
}

import { SecondaryButton, DangerButton } from "../../components/ui/button";

interface DeleteConfirmModalProps {
  sessionTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function DeleteConfirmModal({
  sessionTitle,
  onConfirm,
  onCancel,
  loading,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative z-70 w-full max-w-md bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-900 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-6">
          <Text variant="h3" className="mb-3">
            Delete Chat?
          </Text>
          <Muted className="mb-6">
            Are you sure you want to delete &quot;{sessionTitle}&quot;? This
            action cannot be undone.
          </Muted>

          <div className="flex gap-3 justify-end">
            <SecondaryButton onClick={onCancel} disabled={loading}>
              Cancel
            </SecondaryButton>
            <DangerButton
              onClick={onConfirm}
              disabled={loading}
              isLoading={loading}
            >
              {loading ? "Deleting..." : "Delete Chat"}
            </DangerButton>
          </div>
        </div>
      </div>
    </div>
  );
}
