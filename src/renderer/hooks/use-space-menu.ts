import { useState } from "react";

export function useSpaceMenu() {
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [isViewingPresetSpaces, setIsViewingPresetSpaces] = useState(false);

  // Create space menu state
  const [createSpaceMenuState, setCreateSpaceMenuState] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>({ isOpen: false, position: { x: 0, y: 0 } });

  const handleOpenCreateSpaceMenu = (event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setCreateSpaceMenuState({
      isOpen: true,
      position: { x: rect.right + 40, y: rect.bottom - 12 },
    });
  };

  const handleCloseCreateSpaceMenu = () => {
    setCreateSpaceMenuState({ isOpen: false, position: { x: 0, y: 0 } });
  };

  const handleStartCreatingSpace = () => {
    setIsCreatingSpace(true);
    setIsViewingPresetSpaces(false);
  };

  const handleStartViewingPresetSpaces = () => {
    setIsViewingPresetSpaces(true);
    setIsCreatingSpace(false);
  };

  const handleStopCreatingSpace = () => {
    setIsCreatingSpace(false);
    setIsViewingPresetSpaces(false);
  };

  return {
    isCreatingSpace,
    isViewingPresetSpaces,
    createSpaceMenuState,
    handleOpenCreateSpaceMenu,
    handleCloseCreateSpaceMenu,
    handleStartCreatingSpace,
    handleStartViewingPresetSpaces,
    handleStopCreatingSpace,
  };
}
