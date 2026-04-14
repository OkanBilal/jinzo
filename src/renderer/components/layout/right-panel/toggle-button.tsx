import { Toggle, Terminal, TerminalOpen, ToggleClose } from "@/components/ui/icons";
import { Button, toast } from "@/components/ui";
import { useAppSelector } from "@/lib/redux/hooks";
import { GitActionsDropdown } from "./git-actions-dropdown";

interface ToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
  terminalOpen?: boolean;
  onTerminalToggle?: () => void;
}

export function ToggleButton({ isOpen, onClick, terminalOpen, onTerminalToggle }: ToggleButtonProps) {
  const activeWorkspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId);
  return (
    <div className="fixed z-(--z-panel-toggle) flex items-center gap-1.5 top-2.75 right-3.25">
      <GitActionsDropdown />
      <div className="h-4 w-px bg-primary-700/40 dark:bg-primary-700/40" />
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
          className={` p-1.25 transition-all duration-300 ease-out
             rounded-lg cursor-pointer text-primary-700 dark:text-primary-500 hover:bg-primary-100/80 dark:hover:bg-primary/10
           `}
          aria-label={terminalOpen ? "Close terminal" : "Open terminal"}
        >
          {terminalOpen ? <TerminalOpen className="size-4" /> : <Terminal className="size-4" />}
        </Button>
      )}
      <Button
        tooltip={isOpen ? "Close right panel" : "Open right panel"}
        tooltipPosition="left"
        onClick={onClick}
        className="rounded-lg cursor-pointer hover:bg-primary-100 dark:hover:bg-primary/10 p-1 text-primary-700 dark:text-primary-500 transition-all duration-300 ease-out"
        aria-label={isOpen ? "Close right panel" : "Open right panel"}
      >
        {isOpen ? (
          <Toggle  className="size-4 " />
        ) : (
          <ToggleClose  className="size-4 " />
        )}
      </Button>
    </div>
  );
}
