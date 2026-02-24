import { Plus, Close } from "@/components/ui/icons";
import { Claude, Copilot } from "@/components/ui/icons/mood";
import { CopilotStatic } from "@/components/ui/icons";
import { RunTab, getTabTitle } from "./run-tab";
import { EditorTab } from "./editor-tab";
import { IssueTab } from "./issue-tab";
import { NoteTab } from "./note-tab";
import { Button } from "@/components/ui/button";
import type { Run } from "../types";
import type { IssueWithEntity } from "@/lib/redux/api";
import type { ReviewTab as ReviewTabType } from "@/lib/redux/slices/workspaceSlice";
import { useRef, useState, useLayoutEffect } from "react";

const EMPTY_NOTE_TABS: ReviewTabType[] = [];

interface WorkspaceTabsProps {
  runs: Run[];
  activeTab: "editor" | string;
  hasSelectedFile?: boolean;
  fileName?: string;
  issueTabs: IssueWithEntity[];
  noteTabs?: ReviewTabType[];
  variant?: "copilot" | "claude";
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
  variant = "copilot",
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
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  const setTabRef = (id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      tabRefs.current.set(id, el);
    } else {
      tabRefs.current.delete(id);
    }
  };

  // Calculate indicator position
  useLayoutEffect(() => {
    const updateIndicator = () => {
      const container = containerRef.current;
      if (!container) return;

      const activeTabEl = tabRefs.current.get(activeTab);
      if (activeTabEl) {
        const containerRect = container.getBoundingClientRect();
        const tabRect = activeTabEl.getBoundingClientRect();

        setIndicatorStyle({
          left: tabRect.left - containerRect.left + container.scrollLeft,
          width: tabRect.width,
        });
        setIsInitialized(true);
      }
    };

    // Small delay to ensure refs are set
    requestAnimationFrame(updateIndicator);
  }, [activeTab, runs.length, issueTabs.length, noteTabs.length, showNewRunTab]);
  console.log("Rendering WorkspaceTabs with activeTab:", activeTab);

  return (
    <div
      className={`flex items-center border-b dark:border-primary/4 border-primary-950/20`}
    >
      <div
        ref={containerRef}
        className="relative flex-1 flex items-center overflow-x-auto noscrollbar"
      >
        {/* Sliding indicator */}
        {isInitialized && indicatorStyle.width > 0 && (
          <div
            className={`absolute bottom-0 h-0.5 transition-all duration-200 ease-out ${
              variant === "claude"
                ? "dark:bg-claude-light bg-claude-soft-dark/60"
                : "bg-copilot-blue/60 dark:bg-copilot-lightblue"
            }`}
            style={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
            }}
          />
        )}

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

        {noteTabs.map((note) => {
          const tabId = `note:${note.id}`;
          return (
            <div key={tabId} ref={setTabRef(tabId)}>
              <NoteTab
                review={note}
                isActive={activeTab === tabId}
                onClick={() => onSelectNoteTab?.(note.id)}
                onClose={(e) => onCloseNoteTab?.(note.id, e)}
                variant={variant}
              />
            </div>
          );
        })}
        {showNewRunTab && (
          <div ref={setTabRef("new-run")}>
            <div
              role="button"
              tabIndex={0}
              onClick={onSelectNewRunTab}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectNewRunTab?.(); } }}
              className={`group flex items-center gap-2 pl-3 pr-1 py-2.5 cursor-pointer transition-colors min-w-40 max-w-48 ${
                activeTab === "new-run"
                  ? `text-primary-950 dark:text-primary-200 ${variant === "claude" ? "dark:bg-claude-dark" : variant === "copilot" ? "dark:bg-copilot-dark bg-primary" : ""}`
                  : "text-primary-500 hover:text-primary-700 dark:hover:text-primary-300"
              }`}
            >
              {variant === "claude" ? (
                <Claude className={`size-3.5 ${activeTab === "new-run" ? "text-primary-900 dark:text-primary" : "text-primary-500 group-hover:text-primary-700 dark:group-hover:text-primary-300"}`} />
              ) : variant === "copilot" ? (
                <CopilotStatic className={`size-3.5 ${activeTab === "new-run" ? "text-primary-900 dark:text-primary" : "text-primary-500 group-hover:text-primary-700 dark:group-hover:text-primary-300"}`} />
              ) : null}
              <span className="text-xs font-medium truncate flex-1">New Run</span>
              <Button
                tooltip="Close"
                tooltipPosition="bottom"
                onClick={onCloseNewRunTab}
                className="opacity-0 group-hover:opacity-100 p-1! hover:bg-primary/8 cursor-pointer rounded transition-all"
              >
                <Close className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
        <button
          onClick={onNewRun}
          className="p-2  text-primary-800 dark:text-primary-200 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-900/10 dark:hover:bg-primary/5 rounded-xl cursor-pointer transition-colors"
          title="New run"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
