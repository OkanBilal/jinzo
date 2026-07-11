import {
  useState,
  useEffect,
  useMemo,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppSelector } from "@/lib/redux/hooks";
import { Button } from "@/components/ui";
import { ArrowUp, Plus } from "@/components/ui/icons";
import WorkspaceItem from "./workspace-item";
import type { Workspace as WorkspaceResponse } from "@/lib/redux/api/workspaceApi";
import { LinkResourcesModal } from "@/features/workspace/components/link-resources-modal";
import { WORKSPACE_BASE_PATH } from "@/lib/route-utils";
import { getWorkspaceStatusConfig } from "@/lib/workspace-status";
import WorkspaceStatusIcon from "@/components/ui/icons/workspace-status-icon";
import type { WorkspaceStatus } from "@/lib/redux/api/workspaceApi";
import {
  useListProjectsQuery,
  useUpdateWorkspaceMutation,
  useCreateWorkspaceFromSourceMutation,
  useRenameWorkspaceBranchMutation,
  useGetAccountQuery,
} from "@/lib/redux/api";
import type { Project } from "@/lib/redux/api/projectsApi";
import { toast } from "@/components/ui";
import { ProjectIcon } from "./project-icon";
import { WorkspaceGroupDropdown, type GroupingMode } from "./workspace-group-dropdown";
import { Body } from "@/components/ui/text";

type WorkspaceGroup = {
  key: string;
  label: string;
  icon?: ReactNode;
  workspaces: WorkspaceResponse[];
  project?: Project;
};

/** Pull a human message out of an RTK/IPC rejection (string | {error} | Error). */
function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "error" in error &&
    typeof (error as { error: unknown }).error === "string"
  ) {
    return (error as { error: string }).error;
  }
  return fallback;
}

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
  onCreateWorktree,
  children,
}: {
  group: WorkspaceGroup;
  onCreateWorktree?: () => void;
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
    <div className="">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="group/section w-full flex items-center gap-1.5 px-2 py-1 mb-px rounded-lg cursor-pointer hover:bg-primary/50 dark:hover:bg-primary/5 transition-colors"
      >
        {group.icon && <span className="shrink-0 text-xs">{group.icon}</span>}
        <span className="text-s  text-primary-950 dark:text-primary truncate">
          {group.label}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xxs text-primary-800 dark:text-primary-200 tabular-nums group-hover/section:hidden">
            {group.workspaces.length}
          </span>
          {onCreateWorktree && (
            <Button
              tooltip="Create new worktree"
              onClick={(e) => {
                e.stopPropagation();
                onCreateWorktree();
              }}
              className="hidden group-hover/section:flex items-center p-0.5 cursor-pointer rounded-md"
              aria-label="Create new worktree"
            >
              <Plus className="w-3 h-3 text-primary-800 dark:text-primary-200 hover:text-primary-950 dark:hover:text-primary-100" />
            </Button>
          )}
          <ArrowUp
            className={`w-3 h-3 -mr-1 text-primary-800 dark:text-primary-200 transition-transform duration-200 hidden group-hover/section:block ${
              expanded ? "rotate-180" : "rotate-90"
            }`}
          />
        </div>
      </div>
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isExpanded, setIsExpanded] = useState(true);
  const [linkModalState, setLinkModalState] = useState<{
    isOpen: boolean;
    projectId: string;
    workspaceName: string;
  }>({ isOpen: false, projectId: "", workspaceName: "" });
  const navigate = useNavigate();
  const location = useLocation();
  const [updateWorkspace] = useUpdateWorkspaceMutation();
  const [createWorkspaceFromSource] = useCreateWorkspaceFromSourceMutation();
  const [renameWorkspaceBranch] = useRenameWorkspaceBranchMutation();
  const { data: account } = useGetAccountQuery();
  const activeWorkspaceId = useAppSelector(
    (state) => state.workspace.activeWorkspaceId,
  );

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
  const { data: projects = [] } = useListProjectsQuery();

  const projectDataMap = useMemo(() => {
    const map = new Map<string, Project>();
    for (const project of projects) {
      map.set(project.id, project);
    }
    return map;
  }, [projects]);

  const basePath = WORKSPACE_BASE_PATH;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-16">
        <Body className="text-xs">
          Loading...
        </Body>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="flex items-center justify-center h-16">
        <Body className="text-xs">
          No projects yet
        </Body>
      </div>
    );
  }

  const handleWorkspaceClick = (workspace: WorkspaceResponse) => {
    navigate(`${basePath}/${workspace.id}`);
  };


  const handleLinkIssues = (workspace: WorkspaceResponse) => {
    if (!workspace.projectId) return;
    setLinkModalState({
      isOpen: true,
      projectId: workspace.projectId,
      workspaceName: workspace.name,
    });
  };

  // Both are single workspace operations — the git + metadata orchestration
  // lives in workspace.service. See CONTEXT.md "Workspace git operations".
  const handleCreateWorktreeForProject = async (project: Project) => {
    try {
      const workspace = await createWorkspaceFromSource({
        accountId: account?.id || "default",
        source: { kind: "worktree", projectId: project.id },
      }).unwrap();
      toast.success("Worktree created");
      navigate(`${basePath}/${workspace.id}`);
    } catch (error) {
      console.error("Failed to create worktree:", error);
      toast.error(getErrorMessage(error, "Failed to create worktree"));
    }
  };

  const handleRenameBranch = async (workspace: WorkspaceResponse, newBranchName: string) => {
    try {
      await renameWorkspaceBranch({
        id: workspace.id,
        newBranchName,
      }).unwrap();
      toast.success(`Branch renamed to ${newBranchName}`);
    } catch (error) {
      console.error("Failed to rename branch:", error);
      toast.error(getErrorMessage(error, "Failed to rename branch"));
    }
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
          project: data,
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
    const isActive = location.pathname === `${basePath}/${workspace.id}` ||
      (location.pathname === basePath && activeWorkspaceId === workspace.id);
    const projectData = workspace.projectId
      ? projectDataMap.get(workspace.projectId)
      : undefined;
    return (
      <WorkspaceItem
        key={workspace.id}
        id={workspace.id}
        name={workspace.name}
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
        onRenameBranch={
          workspace.defaultBranch
            ? (newName) => handleRenameBranch(workspace, newName)
            : undefined
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
        // role="button"
        // tabIndex={0}
        // onClick={() => setIsExpanded(!isExpanded)}
        // onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsExpanded(!isExpanded); } }}
        className="w-full flex items-center justify-between transition-all duration-200 bg-transparent px-2 py-1 "
      >
        <Body className="text-s tracking-tight text-primary-800 dark:text-primary-200">
          Workspaces
        </Body>
        <div className="flex items-center ">
          <div className="-mr-1" role="presentation" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <WorkspaceGroupDropdown
              grouping={grouping}
              onGroupingChange={setGrouping}
            />
          </div>
          {/* <ArrowUp
            className={`w-4 h-4 text-primary-900 dark:text-primary-200 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : "rotate-90"
            }`}
          /> */}
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
          <div className={`flex flex-col ${grouping === "project" ? "gap-1" : ""}`}>
            {groups.map((group) => (
              <WorkspaceGroupSection
                key={group.key}
                group={group}
                onCreateWorktree={
                  group.project
                    ? () => handleCreateWorktreeForProject(group.project!)
                    : undefined
                }
              >
                <div className="flex flex-col space-y-0.5">
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
