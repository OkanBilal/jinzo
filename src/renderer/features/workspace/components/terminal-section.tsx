import { Close, Bash } from "@/components/ui/icons";
import { Button, Caption } from "@/components/ui";
import { XtermTerminal } from "./xterm-terminal";

interface TerminalSectionProps {
  workspaceId: string;
  rootPath: string;
  isOpen: boolean;
  onClose?: () => void;
}

export function TerminalSection({
  workspaceId,
  rootPath,
  isOpen,
  onClose,
}: TerminalSectionProps) {
  const terminalId = `terminal-${workspaceId}`;

  return (
    <div
      className={`shrink-0 overflow-hidden transition-[height] duration-300 ease-out ${isOpen ? "border-t border-primary-200/50 dark:border-primary-800/50" : ""} `}
      style={{ height: isOpen ? "15.5rem" : "0px" }}
    >
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <Bash className="size-3 text-primary-500 dark:text-primary-400" />
          <Caption className="text-primary-600 dark:text-primary-400! font-medium text-xs">
            Terminal
          </Caption>
        </div>
        {onClose && (
          <Button
            tooltip="Close terminal"
            tooltipPosition="top-left"
            onClick={onClose}
            className="p-0.5 rounded text-primary-500 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-100 transition-colors cursor-pointer"
          >
            <Close className="size-3" />
          </Button>
        )}
      </div>
      <div className="h-52">
        <XtermTerminal
          id={terminalId}
          rootPath={rootPath}
        />
      </div>
    </div>
  );
}
