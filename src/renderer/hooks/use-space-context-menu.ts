import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useDeleteSpaceMutation,
  useSetActiveSpaceMutation,
  type Space,
} from "@/lib/redux/api";
import { toast } from "@/components/ui";
import { useActiveSpace } from "@/hooks/use-active-space";

export function useSpaceContextMenu() {
  const navigate = useNavigate();
  const { activeSpaceId } = useActiveSpace();
  const [setActiveSpace] = useSetActiveSpaceMutation();
  const [deleteSpace] = useDeleteSpaceMutation();

  // Context menu state
  const [contextMenuState, setContextMenuState] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    targetSpace: Space | null;
  }>({ isOpen: false, position: { x: 28, y: 0 }, targetSpace: null });

  // Edit modal state
  const [editModalState, setEditModalState] = useState<{
    isOpen: boolean;
    space: Space | null;
  }>({ isOpen: false, space: null });

  // Delete space state
  const [deleteSpaceState, setDeleteSpaceState] = useState<{
    space: Space | null;
    isDeleting: boolean;
  }>({ space: null, isDeleting: false });

  // Context menu handlers
  const handleSpaceContextMenu = (space: Space, event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuState({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      targetSpace: space,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenuState({
      isOpen: false,
      position: { x: 0, y: 0 },
      targetSpace: null,
    });
  };

  // Edit space handlers
  const handleEditSpace = () => {
    if (contextMenuState.targetSpace) {
      setEditModalState({
        isOpen: true,
        space: contextMenuState.targetSpace,
      });
    }
  };

  const handleCloseEditModal = () => {
    setEditModalState({ isOpen: false, space: null });
  };

  // Delete space handlers
  const handleDeleteSpace = () => {
    if (contextMenuState.targetSpace) {
      setDeleteSpaceState({
        space: contextMenuState.targetSpace,
        isDeleting: false,
      });
    }
  };

  const handleConfirmDeleteSpace = async () => {
    if (!deleteSpaceState.space) return;

    setDeleteSpaceState((prev) => ({ ...prev, isDeleting: true }));

    try {
      const wasActive = activeSpaceId === deleteSpaceState.space.id;

      await deleteSpace(deleteSpaceState.space.id).unwrap();

      // If the deleted space was active, clear it and navigate to default route
      if (wasActive) {
        await setActiveSpace(null).unwrap();
        navigate("/");
      }

      toast.success("Space deleted");
      setDeleteSpaceState({ space: null, isDeleting: false });
    } catch (error) {
      console.error("Error deleting space:", error);
      toast.error("Failed to delete space");
      setDeleteSpaceState((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const handleCancelDeleteSpace = () => {
    setDeleteSpaceState({ space: null, isDeleting: false });
  };

  return {
    contextMenuState,
    editModalState,
    deleteSpaceState,
    handleSpaceContextMenu,
    handleCloseContextMenu,
    handleEditSpace,
    handleCloseEditModal,
    handleDeleteSpace,
    handleConfirmDeleteSpace,
    handleCancelDeleteSpace,
  };
}
