import { useState, useEffect } from "react";
import { ArrowUp, Bash } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/text";
import { XtermTerminal } from "./xterm-terminal";

interface TerminalSectionProps {
  workspaceId: string;
  rootPath: string;
  variant?: string;
}

function getStorageKey(workspaceId: string): string {
  return `terminal-section-expanded-${workspaceId}`;
}

export function TerminalSection({
  workspaceId,
  rootPath,
  variant,
}: TerminalSectionProps) {
  const [prevWorkspaceId, setPrevWorkspaceId] = useState(workspaceId);
  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem(getStorageKey(workspaceId));
    return stored !== null ? stored === "true" : false;
  });
  const [hasBeenExpanded, setHasBeenExpanded] = useState(expanded);

  if (expanded && !hasBeenExpanded) {
    setHasBeenExpanded(true);
  }

  if (workspaceId !== prevWorkspaceId) {
    setPrevWorkspaceId(workspaceId);
    const stored = localStorage.getItem(getStorageKey(workspaceId));
    const next = stored !== null ? stored === "true" : false;
    setExpanded(next);
    setHasBeenExpanded(next);
  }

  useEffect(() => {
    localStorage.setItem(getStorageKey(workspaceId), String(expanded));
  }, [expanded, workspaceId]);

  const terminalId = `terminal-${workspaceId}`;

  return (
    <div className="shrink-0 px-3 py-2">
      {/* Header */}
      <Button
        variant="subtle"
        size="xs"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center"
      >
        <ArrowUp
          className={`w-3 h-3 transform text-primary-900 dark:text-primary transition-transform ${expanded ? "rotate-180" : "rotate-90"}`}
        />
        <Caption className="text-primary-900 dark:text-primary-200! font-medium">
          Terminal
        </Caption>
        <div className="ml-auto mr-1">
          <Bash className="w-3 h-3 text-primary-900 dark:text-primary transition-colors" />
        </div>
      </Button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="h-80 rounded-lg overflow-hidden ">
            {hasBeenExpanded && (
              <XtermTerminal
                id={terminalId}
                rootPath={rootPath}
                variant={variant}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
