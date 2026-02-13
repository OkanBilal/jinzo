import { RefObject, useMemo } from "react";
import { WorkspaceTabs } from "./workspace-tabs";
import { ToolCallGroup, InfoGroup, groupEvents } from "./tools/tool-call-group";
import { EditorContent } from "./editor-content";
import { IssueTabContent } from "./issue-tab-content";
import { NoteTabContent } from "./note-tab-content";
import { WorkspaceEmptyState } from "./workspace-empty-state";
import type { Run, RunEvent, Workspace } from "../types";
import type { IssueWithEntity } from "@/lib/redux/api";
import type { ReviewTab } from "@/lib/redux/slices/workspaceSlice";
import { isIssueTab, getIssueEntityId, isNoteTab, getNoteId } from "../utils/repo-utils";
import { AsciiLoader } from "./ascii-loader";
import type { ToolApprovalRequest } from "../hooks/use-tool-approval";
import { ToolApprovalDialog } from "./tools/tool-approval-dialog";

interface WorkspaceEventsProps {
  runs: Run[];
  activeTab: "editor" | string;
  currentEvents: RunEvent[];
  currentWorkspace: Workspace | null;
  eventsEndRef: RefObject<HTMLDivElement>;
  hasSelectedFile?: boolean;
  fileName?: string;
  issueTabs: IssueWithEntity[];
  noteTabs?: ReviewTab[];
  variant?: "workspace" | "claude";
  onSelectEditorTab: () => void;
  onSelectRunTab: (runId: string) => void;
  onCloseTab: (runId: string, e: React.MouseEvent) => void;
  onNewRun: () => void;
  onSelectIssueTab: (entityId: string) => void;
  onCloseIssueTab: (entityId: string, e: React.MouseEvent) => void;
  onSelectNoteTab?: (noteId: string) => void;
  onCloseNoteTab?: (noteId: string, e: React.MouseEvent) => void;
  onCloseEditorTab?: (e: React.MouseEvent) => void;
  pendingApproval?: ToolApprovalRequest;
  onApprovalRespond?: (requestId: string, approved: boolean, answer?: string) => void;
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
  noteTabs = [],
  variant = "workspace",
  onSelectEditorTab,
  onSelectRunTab,
  onCloseTab,
  onNewRun,
  onSelectIssueTab,
  onCloseIssueTab,
  onSelectNoteTab,
  onCloseNoteTab,
  onCloseEditorTab,
  pendingApproval,
  onApprovalRespond,
}: WorkspaceEventsProps) {
  const isEditorActive = activeTab === "editor";
  const isIssueActive = isIssueTab(activeTab);
  const isNoteActive = isNoteTab(activeTab);
  const activeIssue = isIssueActive
    ? issueTabs.find((t) => t.issue.entityId === getIssueEntityId(activeTab))
    : null;
  const activeNoteId = isNoteActive ? getNoteId(activeTab) : null;
  const hasRunContent =
    !isEditorActive && !isIssueActive && !isNoteActive && currentEvents.length > 0;

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
          noteTabs={noteTabs}
          variant={variant}
          onSelectEditorTab={onSelectEditorTab}
          onSelectRunTab={onSelectRunTab}
          onCloseTab={onCloseTab}
          onNewRun={onNewRun}
          onSelectIssueTab={onSelectIssueTab}
          onCloseIssueTab={onCloseIssueTab}
          onSelectNoteTab={onSelectNoteTab}
          onCloseNoteTab={onCloseNoteTab}
          onCloseEditorTab={onCloseEditorTab}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {isEditorActive ? (
          <EditorContent className="h-full" />
        ) : isIssueActive && activeIssue ? (
          <IssueTabContent issue={activeIssue} />
        ) : isNoteActive && activeNoteId ? (
          <NoteTabContent reviewId={activeNoteId} />
        ) : hasRunContent ? (
          <div className="h-full overflow-y-auto noscrollbar">
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
              {isRunning && <AsciiLoader variant={variant} />}
              {pendingApproval && onApprovalRespond && (
                <ToolApprovalDialog
                  request={pendingApproval}
                  onRespond={onApprovalRespond}
                />
              )}
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
