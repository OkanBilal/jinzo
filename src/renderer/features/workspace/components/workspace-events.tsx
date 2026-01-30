import { RefObject } from "react";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceTabs } from "./workspace-tabs";
import { TerminalEventLine } from "./terminal-event-line";
import { EditorContent } from "./editor-content";
import { IssueTabContent } from "./issue-tab-content";
import type { Run, RunEvent, Workspace } from "../types";
import type { IssueWithEntity } from "@/lib/redux/api";
import { isIssueTab, getIssueEntityId } from "../utils/repo-utils";

interface WorkspaceEventsProps {
  runs: Run[];
  activeTab: "editor" | string;
  currentEvents: RunEvent[];
  currentWorkspace: Workspace | null;
  eventsEndRef: RefObject<HTMLDivElement>;
  hasSelectedFile?: boolean;
  fileName?: string;
  issueTabs: IssueWithEntity[];
  onSelectEditorTab: () => void;
  onSelectRunTab: (runId: string) => void;
  onCloseTab: (runId: string, e: React.MouseEvent) => void;
  onNewRun: () => void;
  onSelectIssueTab: (entityId: string) => void;
  onCloseIssueTab: (entityId: string, e: React.MouseEvent) => void;
}

export function WorkspaceEvents({
  runs,
  activeTab,
  currentEvents,
  currentWorkspace,
  eventsEndRef,
  hasSelectedFile,
  fileName,
  issueTabs,
  onSelectEditorTab,
  onSelectRunTab,
  onCloseTab,
  onNewRun,
  onSelectIssueTab,
  onCloseIssueTab,
}: WorkspaceEventsProps) {
  const isEditorActive = activeTab === "editor";
  const isIssueActive = isIssueTab(activeTab);
  const activeIssue = isIssueActive
    ? issueTabs.find((t) => t.issue.entityId === getIssueEntityId(activeTab))
    : null;
  const hasRunContent = !isEditorActive && !isIssueActive && currentEvents.length > 0;

  return (
    <div className="font-mono text-sm h-full flex flex-col">
      {/* Sticky header + tabs */}
      <div className="sticky top-0 z-10 shrink-0">
        {/* <WorkspaceHeader workspace={currentWorkspace} /> */}
        <WorkspaceTabs
          runs={runs}
          activeTab={activeTab}
          hasSelectedFile={hasSelectedFile}
          fileName={fileName}
          issueTabs={issueTabs}
          onSelectEditorTab={onSelectEditorTab}
          onSelectRunTab={onSelectRunTab}
          onCloseTab={onCloseTab}
          onNewRun={onNewRun}
          onSelectIssueTab={onSelectIssueTab}
          onCloseIssueTab={onCloseIssueTab}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {isEditorActive ? (
          <EditorContent className="h-full" />
        ) : isIssueActive && activeIssue ? (
          <IssueTabContent issue={activeIssue} />
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
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-linear-to-t from-primary dark:from-workspace-soft-dark to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
