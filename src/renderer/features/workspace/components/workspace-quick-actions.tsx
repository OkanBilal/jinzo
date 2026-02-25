import { useState, useRef, useEffect } from "react";
import { Branch, Figma, PullRequest, Task } from "@/components/ui/icons";
import Github from "@/components/ui/icons/github";
import Linear from "@/components/ui/icons/linear";
import { Jira, Asana, Gitlab } from "@/components/ui/icons";
import { QuickActionButton } from "./quick-action-button";
import {
  useGetProjectResourcesQuery,
  useGetProviderByIdQuery,
  type ProjectResourceWithDetails,
} from "@/lib/redux/api";
import DropdownWrapper from "@/components/ui/dropdown-wrapper";
import { Claude } from "@/components/ui/icons/mood";

const ISSUE_RESOURCE_KINDS = [
  "github_repo",
  "linear_team",
  "jira_project",
  "asana_project",
  "gitlab_project",
] as const;

type IssueResourceKind = (typeof ISSUE_RESOURCE_KINDS)[number];

const RESOURCE_CONFIG: Record<
  IssueResourceKind,
  { label: string; goal: string; icon: (cls: string) => React.ReactNode }
> = {
  github_repo: {
    label: "GitHub",
    goal: "Create a GitHub issue for this workspace",
    icon: (cls) => <Github className={cls} />,
  },
  linear_team: {
    label: "Linear",
    goal: "Create a Linear issue for this workspace",
    icon: (cls) => <Linear className={cls} />,
  },
  jira_project: {
    label: "Jira",
    goal: "Create a Jira issue for this workspace",
    icon: (cls) => <Jira className={cls} />,
  },
  asana_project: {
    label: "Asana",
    goal: "Create an Asana task for this workspace",
    icon: (cls) => <Asana className="h-5.5 w-6 scale-80" />,
  },
  gitlab_project: {
    label: "GitLab",
    goal: "Create a GitLab issue for this workspace",
    icon: (cls) => <Gitlab className={cls} />,
  },
};

function isIssueResourceKind(kind: string): kind is IssueResourceKind {
  return (ISSUE_RESOURCE_KINDS as readonly string[]).includes(kind);
}

function getIssueResources(resources: ProjectResourceWithDetails[]) {
  return resources.filter((r) => isIssueResourceKind(r.resource.kind));
}

interface WorkspaceQuickActionsProps {
  onSetGoal: (goal: string) => void;
  variant?: "claude" | "copilot";
  projectId?: string;
  providerId: string;
}

export function WorkspaceQuickActions({
  variant,
  onSetGoal,
  projectId,
  providerId,
}: WorkspaceQuickActionsProps) {
  const { data: provider } = useGetProviderByIdQuery(providerId);
  const { data: resources = [] } = useGetProjectResourcesQuery(projectId!, {
    skip: !projectId,
  });

  if ((provider?.config as any)?.showQuickActions === false) return null;

  const issueResources = getIssueResources(resources);

  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-200 mx-auto mb-4">
            <QuickActionButton
        variant={variant}
        icon={<Task className="size-3.5" />}
        label="Fix TODOs in code"
        onClick={() =>
          onSetGoal(
            "Find and fix TODO comments in the codebase with an AI assistant",
          )
        }
      />
      <QuickActionButton
        variant={variant}
        icon={<Claude className="size-3.5" />}
        label="Update CLAUDE.md file"
        onClick={() =>
          onSetGoal(
            "Update the CLAUDE.md file with the latest workspace information",
          )
        }
      />
      <QuickActionButton
        variant={variant}
        icon={<Figma className="size-3.5" />}
        label="Implement design"
        onClick={() =>
          onSetGoal("Implement linked Figma design in the workspace")
        }
      />
      {issueResources.length === 1 && (
        <SingleIssueButton
          resource={issueResources[0]}
          variant={variant}
          onSetGoal={onSetGoal}
        />
      )}
      {issueResources.length > 1 && (
        <MultiIssueButton
          resources={issueResources}
          variant={variant}
          onSetGoal={onSetGoal}
        />
      )}
      <QuickActionButton
        variant={variant}
        icon={<PullRequest className="size-3.5" />}
        label="Pull latest changes"
        onClick={() =>
          onSetGoal("Pull the latest changes from the main branch")
        }
      />
    </div>
  );
}

function SingleIssueButton({
  resource,
  variant,
  onSetGoal,
}: {
  resource: ProjectResourceWithDetails;
  variant?: "claude" | "copilot";
  onSetGoal: (goal: string) => void;
}) {
  const kind = resource.resource.kind as IssueResourceKind;
  const config = RESOURCE_CONFIG[kind];

  return (
    <QuickActionButton
      icon={config.icon("size-3.5")}
      variant={variant}
      label="Create issue"
      onClick={() => onSetGoal(config.goal)}
    />
  );
}

function MultiIssueButton({
  resources,
  variant,
  onSetGoal,
}: {
  resources: ProjectResourceWithDetails[];
  variant?: "claude" | "copilot";
  onSetGoal: (goal: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={buttonRef}>
      <QuickActionButton
        variant={variant}
        label="Create issue"
        hasArrow
        onClick={() => setOpen((v) => !v)}
      />
      <DropdownWrapper
        useFixedBackground={true}
        isOpen={open}
        openUpward
        dropdownRef={dropdownRef}
        minWidth="min-w-[200px]"
      >
        <div className="">
          {resources.map((r) => {
            const kind = r.resource.kind as IssueResourceKind;
            const config = RESOURCE_CONFIG[kind];
            return (
              <button
                key={r.id}
                className="flex items-center first:rounded-t-xl last:rounded-b-xl gap-2.5 w-full px-3 py-2.5 text-sm text-left hover:bg-primary-100/60 dark:hover:bg-primary-200/6 transition-colors cursor-pointer"
                onClick={() => {
                  onSetGoal(config.goal);
                  setOpen(false);
                }}
              >
                {config.icon("text-primary-900 dark:text-primary-200 size-4")}
                <span className="text-primary-900 dark:text-primary-200">
                  {config.label}
                </span>
                {r.resource.name && (
                  <span className="text-xs text-primary-400 dark:text-primary-500 truncate ml-auto">
                    {r.resource.name}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </DropdownWrapper>
    </div>
  );
}
