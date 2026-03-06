import { Plus, CopilotStatic } from "@/components/ui/icons";
import { RunTab, getTabTitle } from "./run-tab";
import { EditorTab } from "./editor-tab";
import { IssueTab } from "./issue-tab";
import { NoteTab } from "./note-tab";
import { BaseTab } from "./base-tab";
import type { Run } from "../types";
import type { IssueWithEntity } from "@/lib/redux/api";
import type { ReviewTab as ReviewTabType } from "@/lib/redux/slices/workspaceSlice";
import { useRef } from "react";
import { Button } from "@/components/ui";

const EMPTY_NOTE_TABS: ReviewTabType[] = [];

interface WorkspaceTabsProps {
  runs: Run[];
  activeTab: "editor" | string;
  hasSelectedFile?: boolean;
  fileName?: string;
  issueTabs: IssueWithEntity[];
  noteTabs?: ReviewTabType[];
  onSelectEditorTab: () => void;
  onSelectRunTab: (runId: string) => void;
  onCloseTab: (runId: string, e: React.MouseEvent) => void;
  onNewRun: () => void;
  onSelectIssueTab: (entityId: string) => void;
  onCloseIssueTab: (entityId: string, e: React.MouseEvent) => void;
  onSelectNoteTab?: (noteId: string) => void;
  onCloseNoteTab?: (noteId: string, e: React.MouseEvent) => void;
  onCloseEditorTab?: (e: React.MouseEvent) => void;
  showNewRunTab?: boolean;
  onSelectNewRunTab?: () => void;
  onCloseNewRunTab?: (e: React.MouseEvent) => void;
}

export function WorkspaceTabs({
  runs,
  activeTab,
  hasSelectedFile,
  fileName,
  issueTabs,
  noteTabs = EMPTY_NOTE_TABS,
  onSelectEditorTab,
  onSelectRunTab,
  onCloseTab,
  onNewRun,
  onSelectIssueTab,
  onCloseIssueTab,
  onSelectNoteTab,
  onCloseNoteTab,
  onCloseEditorTab,
  showNewRunTab,
  onSelectNewRunTab,
  onCloseNewRunTab,
}: WorkspaceTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex items-end">
      <div
        ref={containerRef}
        className="relative flex-1 flex items-end overflow-x-auto noscrollbar"
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

        {runs.slice(0, 8).map((run, i) => (
          <RunTab
            key={run.id}
            run={run}
            isActive={run.id === activeTab}
            isFirst={!hasSelectedFile && i === 0}
            onClick={() => onSelectRunTab(run.id)}
            onClose={(e) => onCloseTab(run.id, e)}
            title={getTabTitle(run)}
          />
        ))}

        {issueTabs.map((issue, i) => {
          const tabId = `issue:${issue.issue.entityId}`;
          return (
            <IssueTab
              key={tabId}
              issue={issue}
              isActive={activeTab === tabId}
              isFirst={!hasSelectedFile && runs.length === 0 && i === 0}
              onClick={() => onSelectIssueTab(issue.issue.entityId)}
              onClose={(e) => onCloseIssueTab(issue.issue.entityId, e)}
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
              isFirst={!hasSelectedFile && runs.length === 0 && issueTabs.length === 0 && i === 0}
              onClick={() => onSelectNoteTab?.(note.id)}
              onClose={(e) => onCloseNoteTab?.(note.id, e)}
            />
          );
        })}
        {showNewRunTab && (
          <div className="animate-slide-in-left">
            <NewRunTab
              isActive={activeTab === "new-run"}
              onClick={() => onSelectNewRunTab?.()}
              onClose={(e) => onCloseNewRunTab?.(e)}
            />
          </div>
        )}
        <Button
          onClick={onNewRun}
          className="p-2.5  text-primary-900 ml-0.5 mb-0.5 mr-8 dark:text-primary-200  hover:text-primary-950 dark:hover:text-primary-300 hover:bg-primary/30 dark:hover:bg-primary/3  rounded-xl cursor-pointer transition-colors"
          title="New run"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function NewRunTab({ isActive, onClick, onClose }: {
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  return (
    <BaseTab
      isActive={isActive}
      onClick={onClick}
      onClose={onClose}
      icon={<CopilotStatic className={`size-4 ${isActive ? "text-primary-900 dark:text-primary-200" :
        "text-primary-900 dark:text-primary-200 hover:text-primary-900 dark:hover:text-primary-200"}`} />}
      label="New Run"
    />
  );
}
