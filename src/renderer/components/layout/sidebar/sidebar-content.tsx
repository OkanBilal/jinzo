import type { CSSProperties, MouseEvent } from "react";
import WorkspacesList from "./workspace-list";
import type { Workspace as WorkspaceResponse } from "@/lib/redux/api/workspaceApi";

const EMPTY_WORKSPACES: WorkspaceResponse[] = [];

interface SidebarContentProps {
  workspaces: WorkspaceResponse[];
  isLoadingWorkspaces: boolean;
  onDeleteWorkspace?: (workspaceId: string, e: MouseEvent) => void;
  onArchiveWorkspace?: (workspaceId: string) => void;
}

export function SidebarContent({
  workspaces = EMPTY_WORKSPACES,
  isLoadingWorkspaces = false,
  onDeleteWorkspace,
  onArchiveWorkspace,
}: SidebarContentProps) {
  return (
    <div
      className="flex-1 overflow-y-auto noscrollbar px-3"
      style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
    >
      <div style={{ animation: "slide-fade-down 200ms cubic-bezier(0.23, 1, 0.32, 1)" }}>
        <WorkspacesList
          workspaces={workspaces}
          isLoading={isLoadingWorkspaces}
          onDeleteWorkspace={onDeleteWorkspace}
          onArchiveWorkspace={onArchiveWorkspace}
        />
      </div>
    </div>
  );
}
