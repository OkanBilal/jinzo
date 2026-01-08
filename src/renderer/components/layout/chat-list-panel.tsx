"use client";
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ChatSession,
  useGetChatSessionsQuery,
  useDeleteChatSessionMutation,
} from "@/lib/redux/api";
import { formatDate } from "@/lib/format-date";
import { Close, Search } from "@/components/ui/icons";
import Text, {
  Heading3,
  Body,
  ErrorText,
  Caption,
  Muted,
} from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { SecondaryButton, DangerButton } from "@/components/ui/button";
import { toast } from "sonner";

const FADE_IN_DELAY = 50;

interface ChatListPanelProps {
  onClose: () => void;
  isOpen: boolean;
}

export default function ChatListPanel({ onClose, isOpen }: ChatListPanelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteChatSession, { isLoading: isDeleting }] =
    useDeleteChatSessionMutation();
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(
    null
  );

  const {
    data: sessions,
    error: sessionError,
    isLoading: loading,
  } = useGetChatSessionsQuery();

  const filteredSessions = useMemo(() => {
    if (!sessions || !searchQuery.trim()) return sessions || [];

    const query = searchQuery.toLowerCase().trim();
    return sessions.filter((session) => {
      const title = session.title || session.initialQuery || "";
      return title.toLowerCase().includes(query);
    });
  }, [sessions, searchQuery]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isOpen) {
      timer = setTimeout(() => setIsVisible(true), FADE_IN_DELAY);
    } else {
      timer = setTimeout(() => setIsVisible(false), 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);

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
      <div
        className={`hidden sm:flex flex-col fixed bg-primary-900/20 top-4 bottom-4 left-4 w-65 rounded-3xl z-30 transition-all duration-300 ease-in-out ${
          isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
        }`}
        role="complementary"
        aria-label="Chat sessions sidebar"
      >
        <PanelHeader onClose={onClose} />
        <SearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <SessionsList
          loading={loading}
          error={sessionError ? String(sessionError) : ""}
          sessions={filteredSessions}
          onSessionClick={onClose}
          onDeleteClick={handleDeleteClick}
        />
      </div>
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
    </>
  );
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 pb-2">
      <Heading3>Chats</Heading3>
      <button
        onClick={onClose}
        className="p-2 cursor-pointer rounded-full text-primary-600 dark:text-primary-200 hover:bg-primary-200/40 dark:hover:bg-primary-800/50 transition"
        aria-label="Close chat list"
      >
        <Close className="-rotate-90 h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

function SearchBar({ searchQuery, onSearchChange }: SearchBarProps) {
  return (
    <div className="px-4 pb-3 relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-500 dark:text-primary-400 pointer-events-none" />
        <Input
          type="text"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full text-sm pl-9 border border-primary-200 dark:border-primary-800/50 bg-primary-50 dark:bg-primary-900 rounded-2xl text-primary-800 dark:text-primary-200 focus:ring-0 focus:border-primary-300 dark:focus:border-primary-700"
        />
      </div>
    </div>
  );
}

interface SessionsListProps {
  loading: boolean;
  error: string;
  sessions: ChatSession[];
  onSessionClick: () => void;
  onDeleteClick: (session: ChatSession, e: React.MouseEvent) => void;
}

function SessionsList({
  loading,
  error,
  sessions,
  onSessionClick,
  onDeleteClick,
}: SessionsListProps) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 pt-0 noscrollbar">
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && !error && sessions.length === 0 && <EmptyState />}
      {!loading && !error && sessions.length > 0 && (
        <SessionItems
          sessions={sessions}
          onSessionClick={onSessionClick}
          onDeleteClick={onDeleteClick}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="px-2 py-4 text-center">
      <Body className="text-primary-500 dark:text-primary-400">
        Loading chats…
      </Body>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="px-2 py-4 text-center" role="alert">
      <ErrorText>{message}</ErrorText>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-2 py-4 text-center">
      <Body className="text-primary-400">No chats found.</Body>
    </div>
  );
}

interface SessionItemsProps {
  sessions: ChatSession[];
  onSessionClick: () => void;
  onDeleteClick: (session: ChatSession, e: React.MouseEvent) => void;
}

function SessionItems({
  sessions,
  onSessionClick,
  onDeleteClick,
}: SessionItemsProps) {
  return (
    <div className="flex flex-col gap-1">
      {sessions.map((session) => (
        <SessionItem
          key={session.id}
          session={session}
          onClick={onSessionClick}
          onDelete={onDeleteClick}
        />
      ))}
    </div>
  );
}

interface SessionItemProps {
  session: ChatSession;
  onClick: () => void;
  onDelete: (session: ChatSession, e: React.MouseEvent) => void;
}

function SessionItem({ session, onClick, onDelete }: SessionItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const label = session.title || session.initialQuery || `Chat ${session.id}`;
  const dateLabel = formatDate(session.updatedAt);
  const url = `/chat/${session.id}`;

  return (
    <Link
      to={url}
      className="group flex items-center justify-between gap-2 p-3 rounded-lg  text-primary-700 dark:text-primary-300 hover:text-primary-900 dark:hover:text-primary-50 hover:bg-primary-100 dark:hover:bg-primary-900/50 relative"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Body className="truncate flex-1">{label}</Body>
      <div className="flex items-center gap-2 shrink-0">
        {!isHovered && <Caption className="opacity-60">{dateLabel}</Caption>}
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
