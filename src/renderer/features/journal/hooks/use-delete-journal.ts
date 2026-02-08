import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDeleteJournalMutation } from "@/lib/redux/api";
import { toast } from "@/components/ui/toast";

export function useDeleteJournal() {
  const location = useLocation();
  const navigate = useNavigate();
  const [journalToDelete, setJournalToDelete] = useState<string | null>(null);
  const [deleteJournal, { isLoading: isDeleting }] = useDeleteJournalMutation();

  const handleDeleteClick = (journalId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setJournalToDelete(journalId);
  };

  const handleConfirmDelete = async () => {
    if (!journalToDelete) return;

    const deletePromise = deleteJournal(journalToDelete).unwrap();
    toast.promise(deletePromise, {
      loading: "Deleting post…",
      success: "Post deleted",
      error: "Delete failed",
    });

    try {
      await deletePromise;

      // Navigate away if we were viewing the deleted post
      if (location.pathname === `/journal/${journalToDelete}`) {
        navigate("/journal");
      }

      setJournalToDelete(null);
    } catch (error) {
      console.error("Failed to delete journal:", error);
    }
  };

  const handleCancelDelete = () => {
    setJournalToDelete(null);
  };

  return {
    journalToDelete,
    isDeleting,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
  };
}
