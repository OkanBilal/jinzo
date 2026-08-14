import { Close, Bash } from "@/components/ui/icons";
import { Body, Button } from "@/components/ui";
import { BOTTOM_TERMINAL_HEIGHT } from "@/lib/layout";
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
      style={{ height: isOpen ? BOTTOM_TERMINAL_HEIGHT : "0px" }}
    >
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-1">
          <Bash className="size-4 text-primary-600 dark:text-primary-400" />
          <Body className="font-medium text-s text-primary-700 dark:text-primary-300">
            Terminal
          </Body>
        </div>
        {onClose && (
          <Button
            tooltip="Close terminal"
            tooltipPosition="top-left"
            onClick={onClose}
            className="rounded-full glass-button cursor-pointer hover:bg-primary-100/80 dark:hover:bg-primary/10 p-1 text-primary-900 dark:text-primary-100 transition-all duration-300 ease-out"
          >
            <Close className="size-4" />
          </Button>
        )}
      </div>
      {isOpen && (
        <div className="h-52">
          <XtermTerminal
            id={terminalId}
            rootPath={rootPath}
          />
        </div>
      )}
    </div>
  );
}
