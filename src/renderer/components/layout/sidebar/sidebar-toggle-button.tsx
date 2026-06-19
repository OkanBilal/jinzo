import { Toggle, ToggleClose } from "@/components/ui/icons";
import { Button } from "@/components/ui";
import { useState, useEffect } from "react";
import { useCapabilities } from "@/lib/platform";

interface SidebarToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function SidebarToggleButton({ isOpen, onClick }: SidebarToggleButtonProps) {
  const { windowChrome } = useCapabilities();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    return window.api.app.onFullscreenChange(setIsFullscreen);
  }, []);

  // Clear the macOS traffic lights only with native chrome and not fullscreen.
  const reserveTrafficLights = windowChrome && !isFullscreen;

  return (
    <div
      className="fixed z-(--z-panel-toggle) top-2.75 flex items-center gap-2 transition-all duration-300 ease-out"
      style={{ left: reserveTrafficLights ? "5.5rem" : "0.75rem" }}
    >
      {/* {isFullscreen  && (
        <Mains className="size-3.5 text-primary-500 dark:text-primary-500" />
      )} */}
      <Button
        tooltip={isOpen ? "Close sidebar" : "Open sidebar"}
        tooltipPosition="right"
        onClick={onClick}
        className="rounded-lg cursor-pointer hover:bg-primary-100/80 dark:hover:bg-primary/10 p-1 text-primary-700 dark:text-primary-500 transition-all duration-300 ease-out"
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isOpen ? (
          <Toggle  className="size-4 text-primary-800 dark:text-primary-100 rotate-180" />
        ) : (
          <ToggleClose  className="size-4 text-primary-700 dark:text-primary-300 rotate-180" />
        )}
      </Button>
    </div>
  );
}
