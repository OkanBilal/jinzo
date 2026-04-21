import { Toggle, ToggleClose } from "@/components/ui/icons";
import { Button } from "@/components/ui";
import { useState, useEffect } from "react";

interface SidebarToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function SidebarToggleButton({ isOpen, onClick }: SidebarToggleButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    return window.api.app.onFullscreenChange(setIsFullscreen);
  }, []);

  return (
    <div
      className="fixed z-(--z-panel-toggle) top-2.75 flex items-center gap-2 transition-all duration-300 ease-out"
      style={{ left: isFullscreen  ? "0.75rem" : "5.5rem" }}
    >
      {/* {isFullscreen  && (
        <Jinzo className="size-3.5 text-primary-500 dark:text-primary-500" />
      )} */}
      <Button
        tooltip={isOpen ? "Close sidebar" : "Open sidebar"}
        tooltipPosition="right"
        onClick={onClick}
        className="rounded-lg cursor-pointer hover:bg-primary-100/80 dark:hover:bg-primary/10 p-1 text-primary-700 dark:text-primary-500 transition-all duration-300 ease-out"
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isOpen ? (
          <Toggle  className="size-4 text-primary-800 dark:text-primary-100" />
        ) : (
          <ToggleClose  className="size-4 text-primary-700 dark:text-primary-500" />
        )}
      </Button>
    </div>
  );
}
