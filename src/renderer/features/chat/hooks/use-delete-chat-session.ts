import { useState } from "react";
import { useDeleteChatSessionMutation, ChatSession } from "@/lib/redux/api";
import { toast } from "@/components/ui/toast";

export function useDeleteChatSession() {
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [deleteChatSession, { isLoading: isDeleting }] = useDeleteChatSessionMutation();

  const handleDeleteClick = (session: ChatSession, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setSessionToDelete(session);
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    const deletePromise = deleteChatSession(sessionToDelete.id).unwrap();
    toast.promise(deletePromise, {
      loading: "Deleting chat…",
      success: "Chat deleted",
      error: "Delete failed",
    });
    try {
      await deletePromise;
      setSessionToDelete(null);
    } catch (error) {
      console.error("Failed to delete chat:", error);
    }
  };

  const handleCancelDelete = () => {
    setSessionToDelete(null);
  };

  return {
    sessionToDelete,
    isDeleting,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
  };
}
