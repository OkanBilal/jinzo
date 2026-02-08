import { useState } from "react";

export function useMoodMenu() {
  const [isCreatingMood, setIsCreatingMood] = useState(false);
  const [isViewingPresetMoods, setIsViewingPresetMoods] = useState(false);

  // Create mood menu state
  const [createMoodMenuState, setCreateMoodMenuState] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>({ isOpen: false, position: { x: 0, y: 0 } });

  const handleOpenCreateMoodMenu = (event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setCreateMoodMenuState({
      isOpen: true,
      position: { x: rect.right + 40, y: rect.bottom - 12 },
    });
  };

  const handleCloseCreateMoodMenu = () => {
    setCreateMoodMenuState({ isOpen: false, position: { x: 0, y: 0 } });
  };

  const handleStartCreatingMood = () => {
    setIsCreatingMood(true);
    setIsViewingPresetMoods(false);
  };

  const handleStartViewingPresetMoods = () => {
    setIsViewingPresetMoods(true);
    setIsCreatingMood(false);
  };

  const handleStopCreatingMood = () => {
    setIsCreatingMood(false);
    setIsViewingPresetMoods(false);
  };

  return {
    isCreatingMood,
    isViewingPresetMoods,
    createMoodMenuState,
    handleOpenCreateMoodMenu,
    handleCloseCreateMoodMenu,
    handleStartCreatingMood,
    handleStartViewingPresetMoods,
    handleStopCreatingMood,
  };
}
