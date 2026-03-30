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
          className={` p-1.25! transition-all duration-300 ease-out
             rounded-lg cursor-pointer text-primary-900 dark:text-primary-300 hover:bg-primary-100/80 dark:hover:bg-primary/10
            ${
            terminalOpen
              ? " bg-primary-100/80 dark:bg-primary/10"
              : ""
          }`}
          aria-label={terminalOpen ? "Close terminal" : "Open terminal"}
        >
          <Bash className="size-4" />
        </Button>
      )}
      <Button
        tooltip={isOpen ? "Close right panel" : "Open right panel"}
        tooltipPosition="left"
        onClick={onClick}
        className="rounded-lg cursor-pointer hover:bg-primary-100/80 dark:hover:bg-primary/10 p-1! text-primary-900 dark:text-primary-300! transition-all duration-300 ease-out"
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
