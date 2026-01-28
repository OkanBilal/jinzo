import { Plus } from "@/components/ui/icons";
import { RunTab, getTabTitle } from "./run-tab";
import { EditorTab } from "./editor-tab";
import { IssueTab } from "./issue-tab";
import type { Run } from "../types";
import type { IssueWithEntity } from "@/lib/redux/api";
import { useRef, useState, useLayoutEffect, useCallback } from "react";

interface WorkspaceTabsProps {
  runs: Run[];
  activeTab: "editor" | string;
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

export function WorkspaceTabs({
  runs,
  activeTab,
  hasSelectedFile,
  fileName,
  issueTabs,
  onSelectEditorTab,
  onSelectRunTab,
  onCloseTab,
  onNewRun,
  onSelectIssueTab,
  onCloseIssueTab,
}: WorkspaceTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const activeElement = tabRefs.current.get(activeTab);
    const container = containerRef.current;
    if (activeElement && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeElement.getBoundingClientRect();
      setIndicatorStyle({
        left: tabRect.left - containerRect.left + container.scrollLeft,
        width: tabRect.width,
      });
    }
  }, [activeTab]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [activeTab, runs, hasSelectedFile, issueTabs, updateIndicator]);

  const setTabRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      tabRefs.current.set(id, el);
    } else {
      tabRefs.current.delete(id);
    }
  };

  return (
    <div className="flex items-center bg-primary-100 dark:bg-workspace-dark h-10">
      <div ref={containerRef} className="relative flex-1 flex items-center overflow-x-auto noscrollbar">
        <div
          className="absolute bottom-0 h-0.5 bg-primary-600 dark:bg-primary-700 transition-all duration-300 ease-out"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />

        {/* Editor tab - only show when a file is selected */}
        {hasSelectedFile && (
          <div ref={setTabRef("editor")}>
            <EditorTab
              isActive={activeTab === "editor"}
              onClick={onSelectEditorTab}
              hasFile={hasSelectedFile}
              fileName={fileName}
            />
          </div>
        )}

        {/* Run tabs */}
        {runs.slice(0, 5).map((run) => (
          <div key={run.id} ref={setTabRef(run.id)}>
            <RunTab
              run={run}
              isActive={run.id === activeTab}
              onClick={() => onSelectRunTab(run.id)}
              onClose={(e) => onCloseTab(run.id, e)}
              title={getTabTitle(run)}
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
              />
            </div>
          );
        })}
        <button
          onClick={onNewRun}
          className="p-2 mx-2 text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-200 dark:hover:bg-[#101316] rounded-xl cursor-pointer transition-colors"
          title="New run"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
