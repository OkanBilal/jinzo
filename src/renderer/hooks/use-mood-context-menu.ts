import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useDeleteMoodMutation,
  useSetActiveMoodMutation,
  type Mood,
} from "@/lib/redux/api";
import { toast } from "@/components/ui/toast";
import { useActiveMood } from "@/hooks/use-active-mood";

export function useMoodContextMenu() {
  const navigate = useNavigate();
  const { activeMoodId } = useActiveMood();
  const [setActiveMood] = useSetActiveMoodMutation();
  const [deleteMood] = useDeleteMoodMutation();

  // Context menu state
  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    targetMood: Mood | null;
  }>({ isOpen: false, position: { x: 28, y: 0 }, targetMood: null });

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

  // Context menu handlers
  const handleMoodContextMenu = (mood: Mood, event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    event.preventDefault();
    setContextMenuState({
      isOpen: true,
      position: { x: rect.right, y: rect.top },
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

  return {
    contextMenuState,
    editModalState,
    deleteMoodState,
    handleMoodContextMenu,
    handleCloseContextMenu,
    handleEditMood,
    handleCloseEditModal,
    handleDeleteMood,
    handleConfirmDeleteMood,
    handleCancelDeleteMood,
  };
}
