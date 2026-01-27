import { RefObject } from "react";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceTabs } from "./workspace-tabs";
import { TerminalEventLine } from "./terminal-event-line";
import { EditorContent } from "./editor-content";
import type { Run, RunEvent, Workspace } from "../types";

interface WorkspaceEventsProps {
  runs: Run[];
  activeTab: "editor" | string;
  currentEvents: RunEvent[];
  currentWorkspace: Workspace | null;
  eventsEndRef: RefObject<HTMLDivElement>;
  hasSelectedFile?: boolean;
  fileName?: string;
  onSelectEditorTab: () => void;
  onSelectRunTab: (runId: string) => void;
  onCloseTab: (runId: string, e: React.MouseEvent) => void;
  onNewRun: () => void;
}

export function WorkspaceEvents({
  runs,
  activeTab,
  currentEvents,
  currentWorkspace,
  eventsEndRef,
  hasSelectedFile,
  fileName,
  onSelectEditorTab,
  onSelectRunTab,
  onCloseTab,
  onNewRun,
}: WorkspaceEventsProps) {
  const isEditorActive = activeTab === "editor";
  const hasRunContent = activeTab !== "editor" && currentEvents.length > 0;

  return (
    <div className="font-mono text-sm h-full flex flex-col">
      {/* Sticky header + tabs */}
      <div className="sticky top-0 z-10 shrink-0">
        <WorkspaceHeader workspace={currentWorkspace} />
        <WorkspaceTabs
          runs={runs}
          activeTab={activeTab}
          hasSelectedFile={hasSelectedFile}
          fileName={fileName}
          onSelectEditorTab={onSelectEditorTab}
          onSelectRunTab={onSelectRunTab}
          onCloseTab={onCloseTab}
          onNewRun={onNewRun}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {isEditorActive ? (
          <EditorContent className="h-full" />
        ) : hasRunContent ? (
          <div className="h-full overflow-y-auto">
            <div className="min-h-75 max-w-210 mx-auto space-y-1 pt-12 pb-24">
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
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="min-h-75 max-w-210 mx-auto space-y-1 pt-12 pb-24">
              <div className="flex items-center justify-center py-8 text-primary-500 dark:text-primary-400">
                <span className="text-sm">No events to display</span>
              </div>
              <div ref={eventsEndRef} />
            </div>
          </div>
        )}
        {/* Bottom fade overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-linear-to-t from-primary dark:from-[#080a0f] to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
