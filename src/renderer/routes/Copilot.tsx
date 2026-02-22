import {
  WorkspaceEmptyState,
  WorkspaceEvents,
  WorkspaceInput,
  WorkspaceQuickActions,
} from "@/features/workspace/components";
import { useWorkspacePage } from "@/features/workspace/hooks";

const COPILOT_CLI_PROVIDER_ID = "copilot_cli";

export default function CopilotPage() {
  const ws = useWorkspacePage(COPILOT_CLI_PROVIDER_ID);

  return (
    <div className="flex flex-col h-full dark:bg-copilot-dark ">
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
            onSelectEditorTab={ws.handleSelectEditorTab}
            onSelectRunTab={ws.handleSelectRunTab}
            onCloseTab={ws.handleCloseTab}
            onNewRun={ws.handleNewRun}
            onSelectIssueTab={ws.handleSelectIssueTab}
            onCloseIssueTab={ws.handleCloseIssueTab}
            onSelectNoteTab={ws.handleSelectNoteTab}
            onCloseNoteTab={ws.handleCloseNoteTab}
            onCloseEditorTab={ws.handleCloseEditorTab}
          />
        )}
      </div>
      <WorkspaceQuickActions onSetGoal={ws.setGoal} variant="copilot" workspaceId={ws.currentWorkspace?.id} />
        <WorkspaceInput
          goal={ws.goal}
          onGoalChange={ws.setGoal}
          onSubmit={ws.handleExecute}
          isLoading={ws.isLoading}
          activeRun={ws.activeRun}
          canResume={ws.canResume ?? false}
          providerId={COPILOT_CLI_PROVIDER_ID}
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
