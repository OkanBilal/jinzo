import { Plus } from "@/components/ui/icons";
import { RunTab, getTabTitle } from "./run-tab";
import type { Run } from "../types";

interface WorkspaceTabsProps {
  runs: Run[];
  activeRunId: string | null;
  onSelectTab: (runId: string) => void;
  onCloseTab: (runId: string, e: React.MouseEvent) => void;
  onNewRun: () => void;
}

export function WorkspaceTabs({
  runs,
  activeRunId,
  onSelectTab,
  onCloseTab,
  onNewRun,
}: WorkspaceTabsProps) {
  if (runs.length === 0) return null;

  return (
    <div className="flex items-center border-b border-r border-[#21262d] bg-[#0C0F11] h-10">
      <div className="flex-1 flex items-center overflow-x-auto noscrollbar">
        {runs.slice(0, 5).map((run) => (
          <RunTab
            key={run.id}
            run={run}
            isActive={run.id === activeRunId}
            onClick={() => onSelectTab(run.id)}
            onClose={(e) => onCloseTab(run.id, e)}
            title={getTabTitle(run)}
          />
        ))}
        <button
          onClick={onNewRun}
          className="p-2 mx-2 text-primary-500 hover:text-primary-300 hover:bg-primary-800/30 rounded transition-colors"
          title="New run"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
