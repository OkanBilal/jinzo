import { useState, type MouseEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Caption } from "@/components/ui/text";
import { ArrowUp } from "@/components/ui/icons";
import WorkspaceItem from "./workspace-item";
import { Button } from "@/components/ui/button";
import { WorkspaceResponse } from "src/main/modules/workspaces";
import { LinkResourcesModal } from "@/features/workspace/components/link-resources-modal";
import { useRouteType } from "@/hooks/use-route-type";
import { getBaseRoutePath } from "@/lib/route-utils";

interface WorkspacesListProps {
  workspaces: WorkspaceResponse[];
  isLoading: boolean;
  onDeleteWorkspace?: (workspaceId: string, e: MouseEvent) => void;
}

export default function WorkspacesList({
  workspaces,
  isLoading,
  onDeleteWorkspace,
}: WorkspacesListProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [linkModalState, setLinkModalState] = useState<{
    isOpen: boolean;
    workspaceId: string;
    workspaceName: string;
  }>({ isOpen: false, workspaceId: "", workspaceName: "" });
  const navigate = useNavigate();
  const location = useLocation();
  const routeType = useRouteType();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-16">
        <Caption className="text-primary-800 dark:text-primary-100! font-semibold">
          Loading...
        </Caption>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="flex items-center justify-center h-16">
        <Caption className="text-primary-800 dark:text-primary-100! font-semibold">
          No workspaces yet
        </Caption>
      </div>
    );
  }

  const basePath = getBaseRoutePath(
    routeType === "claude" ? "claude" : "copilot",
  );

  const handleWorkspaceClick = (workspace: WorkspaceResponse) => {
    navigate(`${basePath}/${workspace.id}`);
  };

  const handleLinkIssues = (workspace: WorkspaceResponse) => {
    setLinkModalState({
      isOpen: true,
      workspaceId: workspace.id,
      workspaceName: formatWorkspaceName(workspace),
    });
  };

  const handleCloseLinkModal = () => {
    setLinkModalState({ isOpen: false, workspaceId: "", workspaceName: "" });
  };

  const sortedWorkspaces = [...workspaces].sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return dateB - dateA;
  });

  const formatWorkspaceName = (workspace: WorkspaceResponse): string => {
    if (workspace.repoUrl) {
      const match = workspace.repoUrl.match(/github\.com[/:]([^/]+\/[^/.]+)/);
      if (match) {
        return match[1];
      }
    }
    return workspace.name;
  };

  return (
    <div className="pb-3">
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between active:scale-99 transition-all duration-200 bg-transparent hover:bg-primary/10 dark:hover:bg-primary/5 cursor-pointer px-2 py-2 mb-1 rounded-lg "
      >
        <Caption className="text-primary-800 dark:text-primary-300! font-medium">
          Workspaces
        </Caption>
        <ArrowUp
          className={`w-4 h-4 text-primary-800 dark:text-primary-300 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : "rotate-90"
          }`}
        />
      </Button>

      <div
        className={` transition-all duration-300 ${
          isExpanded ? "max-h-250 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex flex-col space-y-1">
          {sortedWorkspaces.map((workspace) => {
            const isActive =
              location.pathname === `${basePath}/${workspace.id}`;
            return (
              <WorkspaceItem
                key={workspace.id}
                id={workspace.id}
                name={formatWorkspaceName(workspace)}
                branch={workspace.defaultBranch}
                updatedAt={workspace.updatedAt}
                isActive={isActive}
                onClick={() => handleWorkspaceClick(workspace)}
                onDelete={(e) => onDeleteWorkspace?.(workspace.id, e)}
                onLinkIssues={() => handleLinkIssues(workspace)}
              />
            );
          })}
        </div>
      </div>

      <LinkResourcesModal
        workspaceId={linkModalState.workspaceId}
        workspaceName={linkModalState.workspaceName}
        isOpen={linkModalState.isOpen}
        onClose={handleCloseLinkModal}
      />
    </div>
  );
}
