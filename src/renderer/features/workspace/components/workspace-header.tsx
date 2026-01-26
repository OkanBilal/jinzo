import { ArrowUp, Layers } from "@/components/ui/icons";
import type { Workspace } from "../types";

interface WorkspaceHeaderProps {
  workspace: Workspace | null;
}

export function WorkspaceHeader({ workspace }: WorkspaceHeaderProps) {
  return (
    <div className="bg-[rgb(20,23,26)] border-b border-[#21262d] px-4 py-3 flex items-center gap-2">
      <span className="text-primary-500 text-xs ml-2">
        <Layers className="inline w-3.5 h-3.5 mr-2 text-primary-500 dark:text-primary-400" />
        {workspace ? `OkanBilal/${workspace.name}` : "Workspace"}
      </span>
      <ArrowUp className="w-3 h-3 text-primary-500 rotate-90" />
      <span className="text-primary-500 text-xs">
        {`origin/${workspace ? workspace.defaultBranch : "main"}`}
      </span>
    </div>
  );
}
