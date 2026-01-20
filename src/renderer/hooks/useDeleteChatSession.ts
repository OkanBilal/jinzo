import { useState } from "react";
import { useDeleteChatSessionMutation, ChatSession } from "@/lib/redux/api";
import { toast } from "sonner";

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

  return {
    sessionToDelete,
    isDeleting,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
  };
}
