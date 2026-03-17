import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useActiveSpace } from "@/hooks/use-active-space";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";

export function useSettingsNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeSpace } = useActiveSpace();
  const sidebarConfig = useSidebarConfig();

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

    // If previousPath belongs to a space that's now archived, go to active space's default route
    if (previousPath) {
      const belongsToArchivedSpace =
        activeSpace && !previousPath.startsWith(sidebarConfig.defaultRoute);
      if (belongsToArchivedSpace) {
        navigate(sidebarConfig.defaultRoute, { replace: true });
      } else {
        navigate(previousPath);
      }
      setPreviousPath(null);
    } else {
      navigate(sidebarConfig.defaultRoute || "/");
    }
  };

  return {
    isSettingsOpen,
    handleOpenSettings,
    handleCloseSettings,
  };
}
