import { useCallback } from "react";
import {
  WorkspaceEmptyState,
  WorkspaceEvents,
  WorkspaceInput,
  WorkspaceQuickActions,
} from "@/features/workspace/components";
import { useWorkspacePage, useToolApproval } from "@/features/workspace/hooks";

const CLAUDE_PROVIDER_ID = "claude_code";

export default function ClaudePage() {
  const ws = useWorkspacePage(CLAUDE_PROVIDER_ID);

  const {
    pendingApprovals,
    respond: respondToolApproval,
  } = useToolApproval();

  const currentApproval = ws.activeRunId
    ? pendingApprovals.find((a) => a.runId === ws.activeRunId)
    : undefined;

  const handleApprovalRespond = useCallback(
    (requestId: string, approved: boolean, answer?: string) => {
      respondToolApproval(requestId, approved, answer);
    },
    [respondToolApproval],
  );

  return (
    <div className="flex flex-col h-full dark:bg-claude-dark">
      <div className="flex-1 overflow-hidden noscrollbar">
        {ws.showEmptyState ? (
            <WorkspaceEmptyState workspace={ws.currentWorkspace} />
        ) : (
          <WorkspaceEvents
            runs={ws.runs}
            activeTab={ws.activeTab}
            currentEvents={ws.currentEvents}
            currentWorkspace={ws.currentWorkspace}
            eventsEndRef={ws.eventsEndRef as React.RefObject<HTMLDivElement>}
            hasSelectedFile={!!ws.selectedFile}
            fileName={ws.selectedFile?.name}
            issueTabs={ws.openIssueTabs}
            noteTabs={ws.openNoteTabs}
            variant="claude"
            onSelectEditorTab={ws.handleSelectEditorTab}
            onSelectRunTab={ws.handleSelectRunTab}
            onCloseTab={ws.handleCloseTab}
            onNewRun={ws.handleNewRun}
            onSelectIssueTab={ws.handleSelectIssueTab}
            onCloseIssueTab={ws.handleCloseIssueTab}
            onSelectNoteTab={ws.handleSelectNoteTab}
            onCloseNoteTab={ws.handleCloseNoteTab}
            onCloseEditorTab={ws.handleCloseEditorTab}
            pendingApproval={currentApproval}
            onApprovalRespond={handleApprovalRespond}
          />
        )}
      </div>
      <WorkspaceQuickActions onSetGoal={ws.setGoal} variant="claude" workspaceId={ws.currentWorkspace?.id} />
        <WorkspaceInput
          goal={ws.goal}
          onGoalChange={ws.setGoal}
          onSubmit={ws.handleExecute}
          isLoading={ws.isLoading}
          activeRun={ws.activeRun}
          canResume={ws.canResume ?? false}
          providerId={CLAUDE_PROVIDER_ID}
          selectedModel={ws.selectedModel}
          onModelChange={ws.handleModelChange}
          contextFiles={ws.contextFiles}
          onRemoveContextFile={ws.handleRemoveContextFile}
          contextIssues={ws.contextIssues}
          onRemoveContextIssue={ws.handleRemoveContextIssue}
          workspacePath={ws.currentWorkspace?.rootPath}
        />
    </div>
  );
}
