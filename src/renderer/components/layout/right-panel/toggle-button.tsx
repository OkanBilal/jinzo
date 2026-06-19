import { Toggle, Terminal, TerminalOpen, ToggleClose, Web } from "@/components/ui/icons";
import { Button, toast } from "@/components/ui";
import { useAppSelector } from "@/lib/redux/hooks";
import { useCapabilities } from "@/lib/platform";
import { GitActionsDropdown } from "./git-actions-dropdown";

interface ToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
  providerId?: string;
  terminalOpen?: boolean;
  onTerminalToggle?: () => void;
  browserOpen?: boolean;
  onBrowserToggle?: () => void;
}

export function ToggleButton({
  isOpen,
  onClick,
  providerId,
  terminalOpen,
  onTerminalToggle,
  browserOpen,
  onBrowserToggle,
}: ToggleButtonProps) {
  const activeWorkspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId);
  const { embeddedBrowser } = useCapabilities();
  return (
    <div
      data-layout-toggle
      className="fixed z-(--z-panel-toggle) flex items-center gap-1.5 transition-[right] duration-300 ease-out"
      style={{
        top: "calc(0.6875rem + env(safe-area-inset-top))",
        right: browserOpen
          ? "calc(var(--browser-panel-width) + 0.75rem)"
          : "0.8125rem",
      }}
    >
      <GitActionsDropdown providerId={providerId} />
      <div className="h-4 w-px bg-primary-700/40 dark:bg-primary-700/40" />
      {onBrowserToggle && embeddedBrowser && (
        <Button
          tooltip={browserOpen ? "Close browser" : "Open browser"}
          tooltipPosition="left"
          onClick={onBrowserToggle}
          className={`p-1.25 transition-all duration-300 ease-out rounded-lg cursor-pointer hover:bg-primary-100/80 dark:hover:bg-primary/10 ${
            browserOpen
              ? "text-primary-800 dark:text-primary-100"
              : "text-primary-700 dark:text-primary-300"
          }`}
          aria-label={browserOpen ? "Close browser" : "Open browser"}
          aria-pressed={browserOpen}
        >
          <Web className="size-3.75" />
        </Button>
      )}
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
             rounded-lg cursor-pointer hover:bg-primary-100/80 dark:hover:bg-primary/10
           `}
          aria-label={terminalOpen ? "Close terminal" : "Open terminal"}
        >
          {terminalOpen ? <TerminalOpen className="size-4 text-primary-800 dark:text-primary-100" /> : <Terminal className="size-4 text-primary-700 dark:text-primary-300" />}
        </Button>
      )}
      <Button
        tooltip={isOpen ? "Close right panel" : "Open right panel"}
        tooltipPosition="left"
        onClick={onClick}
        className="rounded-lg cursor-pointer hover:bg-primary-100 dark:hover:bg-primary/10 p-1  transition-all duration-300 ease-out"
        aria-label={isOpen ? "Close right panel" : "Open right panel"}
      >
        {isOpen ? (
          <Toggle  className="size-4 text-primary-800 dark:text-primary-100" />
        ) : (
          <ToggleClose  className="size-4 text-primary-700 dark:text-primary-300" />
        )}
      </Button>
    </div>
  );
}
