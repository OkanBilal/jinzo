import {
  useState,
  useEffect,
  useMemo,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Caption } from "@/components/ui/text";
import { ArrowUp } from "@/components/ui/icons";
import WorkspaceItem from "./workspace-item";
import { WorkspaceResponse } from "src/main/modules/workspaces";
import { LinkResourcesModal } from "@/features/workspace/components/link-resources-modal";
import { useRouteType } from "@/hooks/use-route-type";
import { getBaseRoutePath } from "@/lib/route-utils";
import { getWorkspaceStatusConfig } from "@/lib/workspace-status";
import WorkspaceStatusIcon from "@/components/ui/icons/workspace-status-icon";
import type { WorkspaceStatus } from "@/lib/redux/api/workspacesApi";
import { useGetProjectsQuery, useUpdateWorkspaceMutation } from "@/lib/redux/api";
import { ProjectIcon } from "./project-icon";
import { WorkspaceGroupDropdown, type GroupingMode } from "./workspace-group-dropdown";

type WorkspaceGroup = {
  key: string;
  label: string;
  icon?: ReactNode;
  workspaces: WorkspaceResponse[];
};

const STATUS_ORDER: WorkspaceStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
  "duplicate",
];

function WorkspaceGroupSection({
  group,
  children,
}: {
  group: WorkspaceGroup;
  children: ReactNode;
}) {
  const storageKey = `workspace-group-expanded-${group.key}`;
  const [expanded, setExpanded] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored !== null ? stored === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(expanded));
  }, [expanded, storageKey]);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="group/section w-full flex items-center gap-1.5 px-2 py-1 mb-1 rounded-lg cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/5 transition-colors"
      >
        {group.icon && <span className="shrink-0">{group.icon}</span>}
        <span className="text-xs font-medium text-primary-900 dark:text-primary-300 truncate">
          {group.label}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-t text-primary-900 dark:text-primary-200 tabular-nums group-hover/section:hidden">
            {group.workspaces.length}
          </span>
          <ArrowUp
            className={`w-3 h-3 -mr-1 text-primary-900 dark:text-primary-200 transition-transform duration-200 hidden group-hover/section:block ${
              expanded ? "rotate-180" : "rotate-90"
            }`}
          />
        </div>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

interface WorkspacesListProps {
  workspaces: WorkspaceResponse[];
  isLoading: boolean;
  onDeleteWorkspace?: (workspaceId: string, e: MouseEvent) => void;
  onArchiveWorkspace?: (workspaceId: string) => void;
}

export default function WorkspacesList({
  workspaces,
  isLoading,
  onDeleteWorkspace,
  onArchiveWorkspace,
}: WorkspacesListProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [linkModalState, setLinkModalState] = useState<{
    isOpen: boolean;
    projectId: string;
    workspaceName: string;
  }>({ isOpen: false, projectId: "", workspaceName: "" });
  const navigate = useNavigate();
  const location = useLocation();
  const routeType = useRouteType();
  const [updateWorkspace] = useUpdateWorkspaceMutation();

  // Grouping state
  const [grouping, setGrouping] = useState<GroupingMode>(() => {
    const stored = localStorage.getItem("workspace-list-grouping");
    if (stored === "status" || stored === "project") return stored;
    return "none";
  });

  useEffect(() => {
    localStorage.setItem("workspace-list-grouping", grouping);
  }, [grouping]);

  // Project data for icons and grouping
  const { data: projects = [] } = useGetProjectsQuery();

  const projectDataMap = useMemo(() => {
    const map = new Map<string, { name: string; icon: string | null }>();
    for (const project of projects) {
      map.set(project.id, { name: project.name, icon: project.icon });
    }
    return map;
  }, [projects]);

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
          No repositories yet
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

  const formatWorkspaceName = (workspace: WorkspaceResponse): string => {
    if (workspace.repoUrl) {
      const match = workspace.repoUrl.match(/github\.com[/:]([^/]+\/[^/.]+)/);
      if (match) return match[1];
    }
    return workspace.name;
  };

  const handleLinkIssues = (workspace: WorkspaceResponse) => {
    if (!workspace.projectId) return;
    setLinkModalState({
      isOpen: true,
      projectId: workspace.projectId,
      workspaceName: formatWorkspaceName(workspace),
    });
  };

  const sortedWorkspaces = [...workspaces].sort((a, b) => {
    const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return dateB - dateA;
  });

  // Compute groups
  const computeGroups = (): WorkspaceGroup[] => {
    if (grouping === "status") {
      const byStatus = new Map<WorkspaceStatus, WorkspaceResponse[]>();
      for (const ws of sortedWorkspaces) {
        const list = byStatus.get(ws.status) ?? [];
        list.push(ws);
        byStatus.set(ws.status, list);
      }
      return STATUS_ORDER.filter((s) => byStatus.has(s)).map((s) => {
        const config = getWorkspaceStatusConfig(s);
        return {
          key: `status-${s}`,
          label: config.label,
          icon: (
            <WorkspaceStatusIcon
              status={s}
              className={`size-3 ${config.iconColor}`}
            />
          ),
          workspaces: byStatus.get(s)!,
        };
      });
    }

    if (grouping === "project") {
      const byProject = new Map<string | null, WorkspaceResponse[]>();
      for (const ws of sortedWorkspaces) {
        const list = byProject.get(ws.projectId) ?? [];
        list.push(ws);
        byProject.set(ws.projectId, list);
      }
      const result: WorkspaceGroup[] = [];
      const projectEntries = [...byProject.entries()]
        .filter(([pid]) => pid !== null)
        .sort(([a], [b]) => {
          const nameA = projectDataMap.get(a!)?.name ?? a!;
          const nameB = projectDataMap.get(b!)?.name ?? b!;
          return nameA.localeCompare(nameB);
        });
      for (const [pid, wsList] of projectEntries) {
        const data = projectDataMap.get(pid!);
        const projectName = data?.name ?? "Unknown Project";
        result.push({
          key: `project-${pid}`,
          label: projectName,
          icon: <ProjectIcon icon={data?.icon ?? null} projectName={projectName} />,
          workspaces: wsList,
        });
      }
      const ungrouped = byProject.get(null);
      if (ungrouped) {
        result.push({
          key: "project-ungrouped",
          label: "Ungrouped",
          workspaces: ungrouped,
        });
      }
      return result;
    }

    return [];
  };

  const groups = grouping !== "none" ? computeGroups() : [];

  const renderWorkspaceItem = (workspace: WorkspaceResponse) => {
    const isActive = location.pathname === `${basePath}/${workspace.id}`;
    const projectData = workspace.projectId
      ? projectDataMap.get(workspace.projectId)
      : undefined;
    return (
      <WorkspaceItem
        key={workspace.id}
        id={workspace.id}
        name={formatWorkspaceName(workspace)}
        rootPath={workspace.rootPath}
        status={workspace.status}
        branch={workspace.defaultBranch}
        updatedAt={workspace.updatedAt}
        isActive={isActive}
        projectId={workspace.projectId}
        projectIcon={
          projectData
            ? <ProjectIcon icon={projectData.icon} projectName={projectData.name} />
            : undefined
        }
        grouping={grouping}
        onClick={() => handleWorkspaceClick(workspace)}
        onDelete={(e) => onDeleteWorkspace?.(workspace.id, e)}
        onLinkIssues={() => handleLinkIssues(workspace)}
        onArchive={() => onArchiveWorkspace?.(workspace.id)}
        onStatusChange={(newStatus) =>
          updateWorkspace({ id: workspace.id, payload: { status: newStatus } })
        }
        onSettings={
          workspace.projectId
            ? () =>
                navigate(`/settings?section=projects&id=${workspace.projectId}`)
            : undefined
        }
      />
    );
  };

  return (
    <div className="pb-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsExpanded(!isExpanded); } }}
        className="w-full flex items-center justify-between active:scale-99 transition-all duration-200 bg-transparent hover:bg-primary/10 dark:hover:bg-primary/5 cursor-pointer px-2 py-0.5 mb-1 rounded-lg "
      >
        <Caption className="text-primary-800 dark:text-primary-300! font-medium">
          Workspaces
        </Caption>
        <div className="flex items-center gap-1">
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <WorkspaceGroupDropdown
              grouping={grouping}
              onGroupingChange={setGrouping}
            />
          </div>
          <ArrowUp
            className={`w-4 h-4 text-primary-900 dark:text-primary-200 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : "rotate-90"
            }`}
          />
        </div>
      </div>

      <div
        className={` transition-all duration-300 ${
          isExpanded ? "max-h-250 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {grouping === "none" ? (
          <div className="flex flex-col space-y-0.5">
            {sortedWorkspaces.map(renderWorkspaceItem)}
          </div>
        ) : (
          <div className="flex flex-col ">
            {groups.map((group) => (
              <WorkspaceGroupSection key={group.key} group={group}>
                <div className="flex flex-col space-y-0.5 pl-1 pr-1">
                  {group.workspaces.map(renderWorkspaceItem)}
                </div>
              </WorkspaceGroupSection>
            ))}
          </div>
        )}
      </div>

      <LinkResourcesModal
        projectId={linkModalState.projectId}
        workspaceName={linkModalState.workspaceName}
        isOpen={linkModalState.isOpen}
        onClose={() => setLinkModalState({ isOpen: false, projectId: "", workspaceName: "" })}
      />
    </div>
  );
}
