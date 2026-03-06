import { useState, useEffect } from "react";
import { ArrowUp, Bash } from "@/components/ui/icons";
import { Button, Caption } from "@/components/ui";
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
  const [sectionState, setSectionState] = useState(() => {
    const stored = localStorage.getItem(getStorageKey(workspaceId));
    const exp = stored !== null ? stored === "true" : false;
    return { forWorkspaceId: workspaceId, expanded: exp, hasBeenExpanded: exp };
  });

  let { expanded, hasBeenExpanded } = sectionState;

  if (workspaceId !== sectionState.forWorkspaceId) {
    const stored = localStorage.getItem(getStorageKey(workspaceId));
    const next = stored !== null ? stored === "true" : false;
    expanded = next;
    hasBeenExpanded = next;
    setSectionState({ forWorkspaceId: workspaceId, expanded: next, hasBeenExpanded: next });
  }

  if (expanded && !hasBeenExpanded) {
    hasBeenExpanded = true;
    setSectionState((prev) => ({ ...prev, hasBeenExpanded: true }));
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
        onClick={() => setSectionState((prev) => ({ ...prev, expanded: !prev.expanded }))}
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
