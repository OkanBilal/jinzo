import { Fragment, RefObject, useMemo, useState, useCallback } from "react";
import { WorkspaceTabs } from "./workspace-tabs";
import { ToolCallGroup, InfoGroup, groupEvents, type EventGroup } from "./tools/tool-call-group";
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
import { Clipboard, Check } from "@/components/ui/icons";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${seconds}s`;
}

interface SessionInfo {
  elapsed: number;
  responseContent: string;
}

/** Session time bar with dot separator and copy button */
function SessionTimeBar({ info }: { info: SessionInfo }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!info.responseContent) return;
    navigator.clipboard.writeText(info.responseContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [info.responseContent]);

  if (info.elapsed <= 0) return null;

  return (
    <div className="flex items-center gap-2 text-[13px] text-primary-500 dark:text-primary-400 pl-4 -mt-1">
      <span>{formatElapsed(info.elapsed)}</span>
      {info.responseContent && (
        <>
          <span className="size-0.75 rounded-full bg-current opacity-50" />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-primary-900 dark:hover:text-primary-100 transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Clipboard className="size-4" />
            )}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Compute session times and collect response content for each turn.
 *
 * A "turn" starts at a user-prompt or status event (or run start for the first turn).
 * A "turn" ends right before the next user-prompt, or at the last group if the run is done.
 */
function computeSessionTimes(
  groups: EventGroup[],
  runStartedAt?: Date,
  isRunCompleted?: boolean,
): Map<number, SessionInfo> {
  const result = new Map<number, SessionInfo>();
  let turnStartMs: number | null = runStartedAt
    ? new Date(runStartedAt).getTime()
    : null;
  let turnStartIdx = 0;

  const collectResponseContent = (fromIdx: number, toIdx: number): string => {
    const parts: string[] = [];
    for (let j = fromIdx; j <= toIdx; j++) {
      if (groups[j].type === "response") {
        for (const event of groups[j].events) {
          if (event.content) parts.push(event.content);
        }
      }
    }
    return parts.join("\n\n");
  };

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const isUserPrompt =
      group.type === "info" &&
      group.events[0]?.metadata?.kind === "user-prompt";
    const isStatus =
      group.type === "info" && group.events[0]?.type === "status";

    // When we hit a new user-prompt, close the previous turn
    if (isUserPrompt && turnStartMs !== null && i > 0) {
      const prevGroup = groups[i - 1];
      const prevIsPromptOrStatus =
        prevGroup.type === "info" &&
        (prevGroup.events[0]?.metadata?.kind === "user-prompt" ||
          prevGroup.events[0]?.type === "status");
      if (!prevIsPromptOrStatus) {
        const elapsed =
          new Date(prevGroup.endTime).getTime() - turnStartMs;
        if (elapsed > 0) {
          result.set(i - 1, {
            elapsed,
            responseContent: collectResponseContent(turnStartIdx, i - 1),
          });
        }
      }
    }

    // Mark new turn start
    if (isUserPrompt || isStatus) {
      turnStartMs = new Date(group.startTime).getTime();
      turnStartIdx = i;
    }
  }

  // Close the last turn if the run is completed
  if (isRunCompleted && turnStartMs !== null && groups.length > 0) {
    const lastIdx = groups.length - 1;
    const lastGroup = groups[lastIdx];
    const lastIsPromptOrStatus =
      lastGroup.type === "info" &&
      (lastGroup.events[0]?.metadata?.kind === "user-prompt" ||
        lastGroup.events[0]?.type === "status");
    if (!lastIsPromptOrStatus) {
      const elapsed = new Date(lastGroup.endTime).getTime() - turnStartMs;
      if (elapsed > 0) {
        result.set(lastIdx, {
          elapsed,
          responseContent: collectResponseContent(turnStartIdx, lastIdx),
        });
      }
    }
  }

  return result;
}

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
  const isRunCompleted =
    activeRun?.status === "succeeded" ||
    activeRun?.status === "failed" ||
    activeRun?.status === "canceled";

  // Group events for CLI-style display
  const eventGroups = useMemo(
    () => groupEvents(currentEvents),
    [currentEvents],
  );

  // Session times: index-based map of "show session bar after this group index"
  const sessionTimes = useMemo(
    () => computeSessionTimes(eventGroups, activeRun?.startedAt, isRunCompleted),
    [eventGroups, activeRun?.startedAt, isRunCompleted],
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
              {eventGroups.map((group, index) => (
                <Fragment key={group.id}>
                  {group.type === "tool_calls" ? (
                    <ToolCallGroup
                      group={group}
                      defaultExpanded={index === eventGroups.length - 1}
                      variant={variant}
                    />
                  ) : (
                    <InfoGroup group={group} />
                  )}
                  {sessionTimes.has(index) && (
                    <SessionTimeBar info={sessionTimes.get(index)!} />
                  )}
                </Fragment>
              ))}
              {isRunning && <AsciiLoader variant={variant} />}
              {isRunning && pendingApproval && onApprovalRespond && (
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
