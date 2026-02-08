import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export function useSettingsNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const [isSettingsOpen, setIsSettingsOpen] = useState(
    location.pathname.startsWith("/settings"),
  );
  const [previousPath, setPreviousPath] = useState<string | null>(null);

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
