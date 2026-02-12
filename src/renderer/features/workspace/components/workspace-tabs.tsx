import { Plus } from "@/components/ui/icons";
import { RunTab, getTabTitle } from "./run-tab";
import { EditorTab } from "./editor-tab";
import { IssueTab } from "./issue-tab";
import type { Run } from "../types";
import type { IssueWithEntity } from "@/lib/redux/api";
import { useRef } from "react";

interface WorkspaceTabsProps {
  runs: Run[];
  activeTab: "editor" | string;
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

export function WorkspaceTabs({
  runs,
  activeTab,
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
}: WorkspaceTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());


  const setTabRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      tabRefs.current.set(id, el);
    } else {
      tabRefs.current.delete(id);
    }
  };

  return (
    <div
      className={`flex items-center  dark:border-primary-900 ${variant === "claude" ? "dark:bg-claude-soft-dark bg-primary-200/40" : "dark:bg-copilot-blue bg-primary-200/40"} h-10`}
    >
      <div
        ref={containerRef}
        className="relative flex-1 flex items-center overflow-x-auto noscrollbar"
      >
        {hasSelectedFile && (
          <div ref={setTabRef("editor")}>
            <EditorTab
              isActive={activeTab === "editor"}
              onClick={onSelectEditorTab}
              hasFile={hasSelectedFile}
              fileName={fileName}
              onClose={onCloseEditorTab}
              variant={variant}
            />
          </div>
        )}

        {/* Run tabs */}
        {runs.slice(0, 8).map((run) => (
          <div key={run.id} ref={setTabRef(run.id)}>
            <RunTab
              run={run}
              isActive={run.id === activeTab}
              onClick={() => onSelectRunTab(run.id)}
              onClose={(e) => onCloseTab(run.id, e)}
              title={getTabTitle(run)}
              variant={variant}
            />
          </div>
        ))}

        {issueTabs.map((issue) => {
          const tabId = `issue:${issue.issue.entityId}`;
          return (
            <div key={tabId} ref={setTabRef(tabId)}>
              <IssueTab
                issue={issue}
                isActive={activeTab === tabId}
                onClick={() => onSelectIssueTab(issue.issue.entityId)}
                onClose={(e) => onCloseIssueTab(issue.issue.entityId, e)}
                variant={variant}
              />
            </div>
          );
        })}
        <button
          onClick={onNewRun}
          className="p-2 mx-2 text-primary-800 dark:text-primary-200 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-900/10 dark:hover:bg-primary-200/5 rounded-xl cursor-pointer transition-colors"
          title="New run"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
