import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function useSettingsNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const isOnSettings = location.pathname.startsWith("/settings");

  const [isSettingsOpen, setIsSettingsOpen] = useState(isOnSettings);
  const [previousPath, setPreviousPath] = useState<string | null>(null);

  // Sync state when route changes externally (e.g. navigate from workspace dropdown)
  if (isOnSettings && !isSettingsOpen) {
    setIsSettingsOpen(true);
  } else if (!isOnSettings && isSettingsOpen) {
    setIsSettingsOpen(false);
  }

  const handleOpenSettings = () => {
    setPreviousPath(location.pathname + location.search);
    setIsSettingsOpen(true);
    navigate("/settings?section=general");
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    if (previousPath) {
      navigate(previousPath);
      setPreviousPath(null);
    } else {
      navigate("/");
    }
  };

  return {
    isSettingsOpen,
    handleOpenSettings,
    handleCloseSettings,
  };
}
