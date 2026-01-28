import { ArrowUp, Layers } from "@/components/ui/icons";
import type { Workspace } from "../types";

interface WorkspaceHeaderProps {
  workspace: Workspace | null;
}

export function WorkspaceHeader({ workspace }: WorkspaceHeaderProps) {
  return (
    <div className="px-2 py-4 flex items-center gap-2 border-b border-primary-200 dark:bg-workspace-dark dark:border-primary-900">
      <span className="text-primary-600 dark:text-primary-500 text-xs ml-2">
        <Layers className="inline w-3.5 h-3.5 mr-2 text-primary-500 dark:text-primary-400" />
        {workspace ? `${workspace.name}` : "Workspace"}
      </span>
      <ArrowUp className="w-3 h-3 text-primary-500 rotate-90" />
      <span className="text-primary-600 dark:text-primary-500 text-xs">
        {`origin/${workspace ? workspace.defaultBranch : "main"}`}
      </span>
    </div>
  );
}
