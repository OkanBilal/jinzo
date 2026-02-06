import { RefObject, useMemo } from "react";
import { WorkspaceHeader } from "./workspace-header";
import { WorkspaceTabs } from "./workspace-tabs";
import { TerminalEventLine } from "./terminal-event-line";
import { ToolCallGroup, InfoGroup, groupEvents } from "./tool-call-group";
import { EditorContent } from "./editor-content";
import { IssueTabContent } from "./issue-tab-content";
import { WorkspaceEmptyState } from "./workspace-empty-state";
import type { Run, RunEvent, Workspace } from "../types";
import type { IssueWithEntity } from "@/lib/redux/api";
import { isIssueTab, getIssueEntityId } from "../utils/repo-utils";
import { AsciiLoader } from "./ascii-loader";

interface WorkspaceEventsProps {
  runs: Run[];
  activeTab: "editor" | string;
  currentEvents: RunEvent[];
  currentWorkspace: Workspace | null;
  eventsEndRef: RefObject<HTMLDivElement>;
  hasSelectedFile?: boolean;
  fileName?: string;
  issueTabs: IssueWithEntity[];
  variant?: "workspace" | "claude";
  onSelectEditorTab: () => void;
  onSelectRunTab: (runId: string) => void;
  onCloseTab: (runId: string, e: React.MouseEvent) => void;
  onNewRun: () => void;
  onSelectIssueTab: (entityId: string) => void;
  onCloseIssueTab: (entityId: string, e: React.MouseEvent) => void;
  onCloseEditorTab?: (e: React.MouseEvent) => void;
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
  variant = "workspace",
  onSelectEditorTab,
  onSelectRunTab,
  onCloseTab,
  onNewRun,
  onSelectIssueTab,
  onCloseIssueTab,
  onCloseEditorTab,
}: WorkspaceEventsProps) {
  const isEditorActive = activeTab === "editor";
  const isIssueActive = isIssueTab(activeTab);
  const activeIssue = isIssueActive
    ? issueTabs.find((t) => t.issue.entityId === getIssueEntityId(activeTab))
    : null;
  const hasRunContent =
    !isEditorActive && !isIssueActive && currentEvents.length > 0;

  // Check if current run is still running
  const activeRun = runs.find((r) => r.id === activeTab);
  const isRunning =
    activeRun?.status === "running" || activeRun?.status === "queued";

  // Group events for CLI-style display
  const eventGroups = useMemo(
    () => groupEvents(currentEvents),
    [currentEvents],
  );

  return (
    <div className=" text-sm h-full flex flex-col">
      {/* Sticky header + tabs */}
      <div className="sticky top-0 z-10 shrink-0">
        {/* <WorkspaceHeader workspace={currentWorkspace} /> */}
        <WorkspaceTabs
          runs={runs}
          activeTab={activeTab}
          hasSelectedFile={hasSelectedFile}
          fileName={fileName}
          issueTabs={issueTabs}
          variant={variant}
          onSelectEditorTab={onSelectEditorTab}
          onSelectRunTab={onSelectRunTab}
          onCloseTab={onCloseTab}
          onNewRun={onNewRun}
          onSelectIssueTab={onSelectIssueTab}
          onCloseIssueTab={onCloseIssueTab}
          onCloseEditorTab={onCloseEditorTab}
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
            <div className="min-h-75 max-w-210 mx-auto space-y-4 pt-12 pb-24 px-4">
              {eventGroups.map((group, index) => {
                if (group.type === "tool_calls") {
                  return (
                    <ToolCallGroup
                      key={group.id}
                      group={group}
                      defaultExpanded={index === eventGroups.length - 1}
                      variant={variant}
                    />
                  );
                }
                return <InfoGroup key={group.id} group={group} />;
              })}
              {isRunning && <AsciiLoader />}
              <div ref={eventsEndRef} />
            </div>
          </div>
        ) : (
          <WorkspaceEmptyState workspace={currentWorkspace} />
        )}
        {/* Bottom fade overlay */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-24 bg-linear-to-t from-primary ${variant === "claude" ? "dark:from-claude-dark" : "dark:from-copilot-dark"} to-transparent pointer-events-none`}
        />
      </div>
    </div>
  );
}
