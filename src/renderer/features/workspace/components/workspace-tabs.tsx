import { Plus, CopilotStatic, Codex, Cursor } from "@/components/ui/icons";
import { RunTab, getTabTitle } from "./run-tab";
import { EditorTab } from "./editor-tab";
import { IssueTab } from "./issue-tab";
import { SignalTab } from "./signal-tab";
import { NoteTab } from "./note-tab";
import { BaseTab } from "./base-tab";
import type { Run } from "../types";
import type { IssueWithEntity, SignalWithEntity } from "@/lib/redux/api";
import type { ReviewTab as ReviewTabType } from "@/lib/redux/slices/workspaceSlice";
import { useRef } from "react";
import { Button } from "@/components/ui";
import { Claude } from "@/components/ui/icons/space";
import { useAppSelector } from "@/lib/redux/hooks";

const EMPTY_NOTE_TABS: ReviewTabType[] = [];

interface WorkspaceTabsProps {
  runs: Run[];
  activeTab: "editor" | string;
  hasSelectedFile?: boolean;
  fileName?: string;
  issueTabs: IssueWithEntity[];
  signalTabs?: SignalWithEntity[];
  noteTabs?: ReviewTabType[];
  onSelectEditorTab: () => void;
  onSelectRunTab: (runId: string) => void;
  onCloseTab: (runId: string) => void;
  onRenameRun: (runId: string, newTitle: string) => void;
  onNewRun: () => void;
  onSelectIssueTab: (entityId: string) => void;
  onCloseIssueTab: (entityId: string, e: React.MouseEvent) => void;
  onSelectSignalTab?: (entityId: string) => void;
  onCloseSignalTab?: (entityId: string, e: React.MouseEvent) => void;
  onSelectNoteTab?: (noteId: string) => void;
  onCloseNoteTab?: (noteId: string, e: React.MouseEvent) => void;
  onCloseEditorTab?: (e: React.MouseEvent) => void;
  showNewRunTab?: boolean;
  onSelectNewRunTab?: () => void;
  onCloseNewRunTab?: (e: React.MouseEvent) => void;
  variant?: "claude" | "copilot" | "codex" | "cursor";
}

export function WorkspaceTabs({
  runs,
  activeTab,
  hasSelectedFile,
  fileName,
  issueTabs,
  signalTabs = [],
  variant,
  noteTabs = EMPTY_NOTE_TABS,
  onSelectEditorTab,
  onSelectRunTab,
  onCloseTab,
  onRenameRun,
  onNewRun,
  onSelectIssueTab,
  onCloseIssueTab,
  onSelectSignalTab,
  onCloseSignalTab,
  onSelectNoteTab,
  onCloseNoteTab,
  onCloseEditorTab,
  showNewRunTab,
  onSelectNewRunTab,
  onCloseNewRunTab,
}: WorkspaceTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarCollapsed = useAppSelector((state) => state.appSettings.sidebarCollapsed);

  return (
    <div className="flex items-end">
      <div
        ref={containerRef}
        className="relative flex-1 flex items-end overflow-x-auto noscrollbar"
        style={{ paddingLeft: sidebarCollapsed ? "0.75rem" : undefined }}
      >
        {hasSelectedFile && (
          <EditorTab
            isActive={activeTab === "editor"}
            isFirst
            onClick={onSelectEditorTab}
            hasFile={hasSelectedFile}
            fileName={fileName}
            onClose={onCloseEditorTab}
          />
        )}

        {issueTabs.map((issue, i) => {
          const tabId = `issue:${issue.issue.entityId}`;
          return (
            <IssueTab
              key={tabId}
              issue={issue}
              isActive={activeTab === tabId}
              isFirst={!hasSelectedFile && i === 0}
              onClick={() => onSelectIssueTab(issue.issue.entityId)}
              onClose={(e) => onCloseIssueTab(issue.issue.entityId, e)}
            />
          );
        })}

        {signalTabs.map((signal, i) => {
          const tabId = `signal:${signal.signal.entityId}`;
          return (
            <SignalTab
              key={tabId}
              signal={signal}
              isActive={activeTab === tabId}
              isFirst={
                !hasSelectedFile &&
                issueTabs.length === 0 &&
                i === 0
              }
              onClick={() => onSelectSignalTab?.(signal.signal.entityId)}
              onClose={(e) => onCloseSignalTab?.(signal.signal.entityId, e)}
            />
          );
        })}

        {noteTabs.map((note, i) => {
          const tabId = `note:${note.id}`;
          return (
            <NoteTab
              key={tabId}
              review={note}
              isActive={activeTab === tabId}
              isFirst={
                !hasSelectedFile &&
                issueTabs.length === 0 &&
                signalTabs.length === 0 &&
                i === 0
              }
              onClick={() => onSelectNoteTab?.(note.id)}
              onClose={(e) => onCloseNoteTab?.(note.id, e)}
            />
          );
        })}

        {runs.slice(0, 8).map((run, i) => (
          <RunTab
            variant={variant}
            key={run.id}
            run={run}
            isActive={run.id === activeTab}
            isFirst={!hasSelectedFile && issueTabs.length === 0 && signalTabs.length === 0 && noteTabs.length === 0 && i === 0}
            onClick={() => onSelectRunTab(run.id)}
            onClose={() => onCloseTab(run.id)}
            onRename={(newTitle) => onRenameRun(run.id, newTitle)}
            title={getTabTitle(run)}
          />
        ))}
        {showNewRunTab && (
          <div className="animate-slide-in-left">
            <NewRunTab
              variant={variant!}
              isActive={activeTab === "new-run"}
              onClick={() => onSelectNewRunTab?.()}
              onClose={(e) => onCloseNewRunTab?.(e)}
            />
          </div>
        )}
        <Button
          onClick={onNewRun}
          className="p-2.5 text-primary-900 ml-0.5 mr-8 dark:text-primary-200  hover:text-primary-950 dark:hover:text-primary-300 hover:bg-primary/30 dark:hover:bg-primary/5  rounded-xl cursor-pointer transition-colors"
          title="New run"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function NewRunTab({
  isActive,
  variant,
  onClick,
  onClose,
}: {
  isActive: boolean;
  variant: "copilot" | "claude" | "codex" | "cursor";
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  const className = `size-4 ${
    isActive
      ? "text-primary-900 dark:text-primary-200"
      : "text-primary-900 dark:text-primary-200 group-hover:text-primary-900 dark:group-hover:text-primary-200"
  }`;

  return (
    <BaseTab
      isActive={isActive}
      onClick={onClick}
      onClose={onClose}
      icon={
        variant === "claude" ? (
          <Claude className="text-claude" />
        ) : variant === "copilot" ? (
          <CopilotStatic className={className} />
        ) : variant === "cursor" ? (
          <Cursor className={className} />
        ) : (
          <Codex className={className} />
        )
      }
      label="New Run"
    />
  );
}
