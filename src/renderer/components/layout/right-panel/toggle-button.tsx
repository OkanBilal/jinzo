import { Close, RightPanelOpen, Bash } from "@/components/ui/icons";
import { Button, toast } from "@/components/ui";
import { useAppSelector } from "@/lib/redux/hooks";

interface ToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
  terminalOpen?: boolean;
  onTerminalToggle?: () => void;
}

export function ToggleButton({ isOpen, onClick, terminalOpen, onTerminalToggle }: ToggleButtonProps) {
  const activeWorkspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId);
  return (
    <div className="fixed z-(--z-panel-toggle) flex items-center gap-2 top-2.75 right-3.25">
      {onTerminalToggle && (
        <Button
          tooltip={terminalOpen ? "Close terminal" : "Open terminal"}
          tooltipPosition="left"
          onClick={() => {
            if (!activeWorkspaceId && !terminalOpen) {
              toast.error("Select a workspace first to use the terminal");
              return;
            }
            onTerminalToggle();
          }}
          className={`rounded-full! p-1! transition-all duration-300 ease-out ${
            terminalOpen
              ? "text-primary-900 dark:text-primary!"
              : "text-primary-700 dark:text-primary-300!"
          }`}
          aria-label={terminalOpen ? "Close terminal" : "Open terminal"}
        >
          <Bash className="size-4.25" />
        </Button>
      )}
      <Button
        tooltip={isOpen ? "Close right panel" : "Open right panel"}
        tooltipPosition="left"
        onClick={onClick}
        className="rounded-full! p-1! text-primary-700 dark:text-primary-300! transition-all duration-300 ease-out"
        aria-label={isOpen ? "Close right panel" : "Open right panel"}
      >
        {isOpen ? (
          <Close className="size-4" />
        ) : (
          <RightPanelOpen className="size-4" />
        )}
      </Button>
    </div>
  );
}
