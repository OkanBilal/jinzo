import { RefObject } from "react";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceTabs } from "./workspace-tabs";
import { TerminalEventLine } from "./terminal-event-line";
import type { Run, RunEvent, Workspace } from "../types";

interface WorkspaceEventsProps {
  runs: Run[];
  activeRunId: string | null;
  currentEvents: RunEvent[];
  currentWorkspace: Workspace | null;
  eventsEndRef: RefObject<HTMLDivElement>;
  onSelectTab: (runId: string) => void;
  onCloseTab: (runId: string, e: React.MouseEvent) => void;
  onNewRun: () => void;
}

export function WorkspaceEvents({
  runs,
  activeRunId,
  currentEvents,
  currentWorkspace,
  eventsEndRef,
  onSelectTab,
  onCloseTab,
  onNewRun,
}: WorkspaceEventsProps) {
  if (!activeRunId || currentEvents.length === 0) return null;

  return (
    <div className="font-mono text-sm">
      {/* Sticky header + tabs */}
      <div className="sticky top-0 z-10">
        <WorkspaceHeader workspace={currentWorkspace} />
        <WorkspaceTabs
          runs={runs}
          activeRunId={activeRunId}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onNewRun={onNewRun}
        />
      </div>

      <div className="min-h-75 max-w-210 mx-auto space-y-1 pt-12 pb-12">
        {currentEvents.map((event, index) => (
          <TerminalEventLine
            key={event.id}
            event={event}
            isLast={index === currentEvents.length - 1}
          />
        ))}
        <div ref={eventsEndRef} />
      </div>
    </div>
  );
}
