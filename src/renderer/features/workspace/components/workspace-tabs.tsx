import { Plus } from "@/components/ui/icons";
import { RunTab, getTabTitle } from "./run-tab";
import { EditorTab } from "./editor-tab";
import type { Run } from "../types";

interface WorkspaceTabsProps {
  runs: Run[];
  activeTab: "editor" | string;
  hasSelectedFile?: boolean;
  fileName?: string;
  onSelectEditorTab: () => void;
  onSelectRunTab: (runId: string) => void;
  onCloseTab: (runId: string, e: React.MouseEvent) => void;
  onNewRun: () => void;
}

export function WorkspaceTabs({
  runs,
  activeTab,
  hasSelectedFile,
  fileName,
  onSelectEditorTab,
  onSelectRunTab,
  onCloseTab,
  onNewRun,
}: WorkspaceTabsProps) {
  return (
    <div className="flex items-center bg-primary-100 dark:bg-[#080a0f] h-11">
      <div className="flex-1 flex items-center border-b border-primary-200 dark:border-primary/10 overflow-x-auto noscrollbar">
        {/* Editor tab - only show when a file is selected */}
        {hasSelectedFile && (
          <EditorTab
            isActive={activeTab === "editor"}
            onClick={onSelectEditorTab}
            hasFile={hasSelectedFile}
            fileName={fileName}
          />
        )}

        {/* Run tabs */}
        {runs.slice(0, 5).map((run) => (
          <RunTab
            key={run.id}
            run={run}
            isActive={run.id === activeTab}
            onClick={() => onSelectRunTab(run.id)}
            onClose={(e) => onCloseTab(run.id, e)}
            title={getTabTitle(run)}
          />
        ))}

        {/* New run button */}
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
