import {
  useState,
  useRef,
  useEffect,
  useMemo,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Caption } from "@/components/ui/text";
import { ArrowUp, Group } from "@/components/ui/icons";
import WorkspaceItem from "./workspace-item";
import { Button } from "@/components/ui/button";
import { WorkspaceResponse } from "src/main/modules/workspaces";
import { LinkResourcesModal } from "@/features/workspace/components/link-resources-modal";
import { useRouteType } from "@/hooks/use-route-type";
import { getBaseRoutePath } from "@/lib/route-utils";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { getWorkspaceStatusConfig } from "@/lib/workspace-status";
import WorkspaceStatusIcon from "@/components/ui/icons/workspace-status-icon";
import type { WorkspaceStatus } from "@/lib/redux/api/workspacesApi";
import { useGetProjectsQuery } from "@/lib/redux/api";
import { parseIcon, type IconComponent } from "@/lib/icon-registry";

type GroupingMode = "none" | "status" | "project";

type WorkspaceGroup = {
  key: string;
  label: string;
  icon?: ReactNode;
  workspaces: WorkspaceResponse[];
};

const STATUS_ORDER: WorkspaceStatus[] = [
  "in_progress",
  "in_review",
  "todo",
  "backlog",
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
        <span className="text-xs font-medium text-primary-700 dark:text-primary-300 truncate">
          {group.label}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-primary-500 dark:text-primary-400 tabular-nums group-hover/section:hidden">
            {group.workspaces.length}
          </span>
          <ArrowUp
            className={`w-3 h-3 -mr-1 text-primary-700 dark:text-primary-400 transition-transform duration-200 hidden group-hover/section:block ${
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
    workspaceId: string;
    workspaceName: string;
  }>({ isOpen: false, workspaceId: "", workspaceName: "" });
  const navigate = useNavigate();
  const location = useLocation();
  const routeType = useRouteType();

  // Grouping state
  const [grouping, setGrouping] = useState<GroupingMode>(() => {
    const stored = localStorage.getItem("workspace-list-grouping");
    if (stored === "status" || stored === "project") return stored;
    return "none";
  });
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [groupDropdownPosition, setGroupDropdownPosition] = useState({
    x: 0,
    y: 0,
  });
  const groupButtonRef = useRef<HTMLButtonElement>(null);

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

  const handleGroupButtonClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (groupButtonRef.current) {
      const rect = groupButtonRef.current.getBoundingClientRect();
      setGroupDropdownPosition({
        x: Math.min(rect.left, window.innerWidth - 180),
        y: rect.bottom + 4,
      });
    }
    setIsGroupDropdownOpen(!isGroupDropdownOpen);
  };

  const handleSelectGrouping = (mode: GroupingMode) => {
    setGrouping(mode);
    setIsGroupDropdownOpen(false);
  };

  const renderProjectIcon = (
    iconStr: string | null,
    projectName: string,
  ): ReactNode => {
    if (iconStr) {
      const parsed = parseIcon(iconStr);
      if (
        parsed.type === "icon" ||
        parsed.type === "copilot-animate" ||
        parsed.type === "claude-animate"
      ) {
        const IconComp = parsed.value as IconComponent;
        return (
          <IconComp className="size-3.5 text-primary-900 dark:text-primary-300" />
        );
      }
      if (parsed.type === "emoji") {
        return (
          <span className="text-xs leading-none">{parsed.value as string}</span>
        );
      }
    }
    const initial = (projectName?.[0] ?? "P").toUpperCase();
    return (
      <div className="size-4 rounded-md flex items-center justify-center text-[9px] font-medium text-primary-950 dark:text-primary-200 border border-primary-950/40 dark:border-primary/10">
        {initial}
      </div>
    );
  };

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
          icon: renderProjectIcon(data?.icon ?? null, projectName),
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
        status={workspace.status}
        branch={workspace.defaultBranch}
        updatedAt={workspace.updatedAt}
        isActive={isActive}
        projectId={workspace.projectId}
        projectIcon={
          projectData
            ? renderProjectIcon(projectData.icon, projectData.name)
            : undefined
        }
        grouping={grouping}
        onClick={() => handleWorkspaceClick(workspace)}
        onDelete={(e) => onDeleteWorkspace?.(workspace.id, e)}
        onLinkIssues={() => handleLinkIssues(workspace)}
        onArchive={() => onArchiveWorkspace?.(workspace.id)}
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
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between active:scale-99 transition-all duration-200 bg-transparent hover:bg-primary/10 dark:hover:bg-primary/5 cursor-pointer px-2 py-0.5 mb-1 rounded-lg "
      >
        <Caption className="text-primary-800 dark:text-primary-300! font-medium">
          Workspaces
        </Caption>
        <div className="flex items-center gap-1">
          <Button
            ref={groupButtonRef}
            tooltip="Group workspaces"
            tooltipPosition="top"
            onClick={handleGroupButtonClick}
            className="p-1 rounded-md cursor-pointer hover:bg-primary/20 dark:hover:bg-primary/10 transition-colors"
          >
            <Group
              className={`w-3.5 h-3.5 transition-colors ${
                grouping !== "none"
                  ? "text-primary-950 dark:text-primary"
                  : "text-primary-800 dark:text-primary-300"
              }`}
            />
          </Button>
          <ArrowUp
            className={`w-4 h-4 text-primary-800 dark:text-primary-300 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : "rotate-90"
            }`}
          />
        </div>
      </Button>

      <DropdownMenu
        isOpen={isGroupDropdownOpen}
        position={groupDropdownPosition}
        onClose={() => setIsGroupDropdownOpen(false)}
        minWidth={170}
      >
        <DropdownMenuItem
          onClick={() => handleSelectGrouping("none")}
          className={
            grouping === "none"
              ? "bg-primary-950/8 dark:bg-primary/10 font-medium"
              : ""
          }
        >
          No grouping
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelectGrouping("status")}
          className={
            grouping === "status"
              ? "bg-primary-950/8 dark:bg-primary/10 font-medium"
              : ""
          }
        >
          Group by status
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelectGrouping("project")}
          className={
            grouping === "project"
              ? "bg-primary-950/8 dark:bg-primary/10 font-medium"
              : ""
          }
        >
          Group by project
        </DropdownMenuItem>
      </DropdownMenu>

      <div
        className={` transition-all duration-300 ${
          isExpanded ? "max-h-250 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {grouping === "none" ? (
          <div className="flex flex-col space-y-1">
            {sortedWorkspaces.map(renderWorkspaceItem)}
          </div>
        ) : (
          <div className="flex flex-col space-y-0.5">
            {groups.map((group) => (
              <WorkspaceGroupSection key={group.key} group={group}>
                <div className="flex flex-col space-y-1 pl-1">
                  {group.workspaces.map(renderWorkspaceItem)}
                </div>
              </WorkspaceGroupSection>
            ))}
          </div>
        )}
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
