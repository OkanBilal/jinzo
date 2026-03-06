import { Close, RightPanelOpen } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";

interface ToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function ToggleButton({ isOpen, onClick }: ToggleButtonProps) {
  return (
    <Button
      tooltip={isOpen ? "Close right panel" : "Open right panel"}
      tooltipPosition="left"
      onClick={onClick}
      className="fixed z-60 rounded-full! p-1.5! text-primary-800 dark:text-primary-300! bg-primary-100/30 dark:bg-primary/5 transition-all duration-300 ease-out top-2.75 right-3.25"
      aria-label={isOpen ? "Close right panel" : "Open right panel"}
    >
      {isOpen ? (
        <Close className="size-4" />
      ) : (
        <RightPanelOpen className="size-4.75" />
      )}
    </Button>
  );
}
