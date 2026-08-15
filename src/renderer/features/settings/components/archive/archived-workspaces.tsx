import { useMemo, useState } from "react";
import {
  Alert,
  Body,
  Button,
  Caption,
  Checkbox,
  Input,
  Muted,
  SegmentedTabs,
  toast,
} from "@/components/ui";
import {
  Archive,
  Danger,
  ProjectFolder,
  Search,
  Trash,
  WorkspaceStatusIcon,
} from "@/components/ui/icons";
import { extractErrorMessage } from "@/lib/extract-error-message";
import { formatAbsoluteDate } from "@/lib/format-date";
import { getProviderVariantById } from "@/lib/provider-variants";
import { getWorkspaceStatusConfig } from "@/lib/workspace-status";
import {
  useDeleteRunMutation,
  useDeleteWorkspaceMutation,
  useListArchivedRunsQuery,
  useListArchivedWorkspacesQuery,
  useUnarchiveRunMutation,
  useUnarchiveWorkspaceMutation,
  type ArchivedRun,
  type ArchivedWorkspace,
} from "@/lib/redux/api";
import { SettingsPageShell, SettingsSection } from "../settings-layout";

type ArchiveTab = "workspaces" | "runs";


/** Settings › Archive — recovery and permanent deletion for workspaces and runs. */
export default function ArchiveSettings() {
  const [activeTab, setActiveTab] = useState<ArchiveTab>("workspaces");
  const workspacesQuery = useListArchivedWorkspacesQuery();
  const runsQuery = useListArchivedRunsQuery();

  const isLoading =
    activeTab === "workspaces"
      ? workspacesQuery.isLoading
      : runsQuery.isLoading;
  const error =
    activeTab === "workspaces" ? workspacesQuery.error : runsQuery.error;

  return (
    <SettingsPageShell
      title="Archive"
      isLoading={isLoading}
      error={error}
      errorMessage={`Unable to load archived ${activeTab}.`}
      headerActions={
        <SegmentedTabs
          value={activeTab}
          onChange={setActiveTab}
          options={[
            {
              value: "workspaces",
              label: `Workspaces`,
            },
            {
              value: "runs",
              label: `Runs`,
            },
          ]}
          className="min-w-40"
        />
      }
    >
      {activeTab === "workspaces" ? (
        <ArchivedWorkspacesPanel workspaces={workspacesQuery.data ?? []} />
      ) : (
        <ArchivedRunsPanel runs={runsQuery.data ?? []} />
      )}
    </SettingsPageShell>
  );
}

function ArchivedWorkspacesPanel({
  workspaces,
}: {
  workspaces: ArchivedWorkspace[];
}) {
  const [unarchiveWorkspace] = useUnarchiveWorkspaceMutation();
  const [deleteWorkspace, { isLoading: isDeleting }] =
    useDeleteWorkspaceMutation();
  const [pendingDelete, setPendingDelete] = useState<ArchivedWorkspace | null>(
    null,
  );
  const [removeWorktree, setRemoveWorktree] = useState(false);

  const handleUnarchive = async (workspace: ArchivedWorkspace) => {
    try {
      await unarchiveWorkspace(workspace.id).unwrap();
      toast.success(`${workspace.name} restored`);
    } catch (err: any) {
      toast.error(extractErrorMessage(err, "Failed to unarchive workspace"));
    }
  };

  const openDelete = (workspace: ArchivedWorkspace) => {
    setPendingDelete(workspace);
    setRemoveWorktree(false);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const { id, name, worktree } = pendingDelete;
    try {
      await deleteWorkspace({
        id,
        removeWorktree: removeWorktree && !!worktree,
      }).unwrap();
      toast.success(`${name} deleted`);
      setPendingDelete(null);
    } catch (err: any) {
      toast.error(extractErrorMessage(err, "Failed to delete workspace"));
    }
  };

  if (workspaces.length === 0) {
    return (
      <ArchiveEmptyState
        title="No archived workspaces"
        description="Workspaces you archive from the sidebar will appear here."
      />
    );
  }

  return (
    <>
      <SettingsSection
        title={`${workspaces.length} archived workspace${workspaces.length === 1 ? "" : "s"}`}
      >
        {workspaces.map((workspace, index) => (
          <div
            key={workspace.id}
            className={
              index > 0
                ? "border-t border-primary-200/60 dark:border-primary-800/20"
                : undefined
            }
          >
            <ArchivedWorkspaceRow
              workspace={workspace}
              onUnarchive={() => handleUnarchive(workspace)}
              onDelete={() => openDelete(workspace)}
            />
          </div>
        ))}
      </SettingsSection>

      <Alert
        isOpen={!!pendingDelete}
        title="Delete workspace?"
        description={`${pendingDelete?.name ?? "This workspace"} will be permanently deleted along with its runs and review history. This cannot be undone.`}
        primaryButtonText="Delete"
        secondaryButtonText="Cancel"
        primaryButtonVariant="danger"
        isPrimaryLoading={isDeleting}
        onPrimary={handleConfirmDelete}
        onSecondary={() => setPendingDelete(null)}
      >
        {pendingDelete?.worktree ? (
          <label className="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={removeWorktree}
              onChange={setRemoveWorktree}
              aria-label="Also remove the worktree from disk"
            />
            <Caption className="text-primary-900 dark:text-primary-100">
              Also remove the worktree from disk
            </Caption>
          </label>
        ) : (
          <Caption className="block opacity-70">
            The folder at {pendingDelete?.rootPath} is left untouched — it is
            your repository, not a worktree Mains created.
          </Caption>
        )}
      </Alert>
    </>
  );
}

function ArchivedRunsPanel({ runs }: { runs: ArchivedRun[] }) {
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ArchivedRun | null>(null);
  const [unarchiveRun] = useUnarchiveRunMutation();
  const [deleteRun, { isLoading: isDeleting }] = useDeleteRunMutation();

  const groups = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const grouped = new Map<
      string,
      {
        workspaceName: string;
        workspaceArchived: boolean;
        runs: ArchivedRun[];
      }
    >();

    for (const run of runs) {
      const provider = getProviderVariantById(run.providerId);
      const matches = [
        run.title,
        run.goal,
        run.model,
        run.workspace?.name,
        provider?.label,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
      if (normalizedSearch && !matches) continue;

      const key = run.workspace?.id ?? "unassigned";
      const group = grouped.get(key) ?? {
        workspaceName: run.workspace?.name ?? "No workspace",
        workspaceArchived: run.workspace?.isArchived ?? false,
        runs: [],
      };
      group.runs.push(run);
      grouped.set(key, group);
    }

    return [...grouped.entries()].map(([key, group]) => ({ key, ...group }));
  }, [runs, search]);

  const handleUnarchive = async (run: ArchivedRun) => {
    try {
      await unarchiveRun(run.id).unwrap();
      toast.success(`${runDisplayTitle(run)} restored`);
    } catch (err: any) {
      toast.error(extractErrorMessage(err, "Failed to unarchive run"));
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteRun(pendingDelete.id).unwrap();
      toast.success(`${runDisplayTitle(pendingDelete)} deleted`);
      setPendingDelete(null);
    } catch (err: any) {
      toast.error(extractErrorMessage(err, "Failed to delete run"));
    }
  };

  if (runs.length === 0) {
    return (
      <ArchiveEmptyState
        title="No archived runs"
        description="Runs you archive from a workspace tab will appear here."
      />
    );
  }

  return (
    <>
      <div className="relative mb-7">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-400" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search archived runs"
          aria-label="Search archived runs"
          className="pl-9"
        />
      </div>

      {groups.length === 0 ? (
        <div className="py-14 text-center">
          <Muted>No archived runs match “{search}”.</Muted>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="mb-8">
            <div className="mb-3 flex items-center gap-2 px-1">
              <ProjectFolder className="size-4 text-primary-600 dark:text-primary-400" />
              <Body className="truncate">{group.workspaceName}</Body>
              <Caption className="ml-auto shrink-0 opacity-70">
                {group.runs.length} run{group.runs.length === 1 ? "" : "s"}
              </Caption>
              {group.workspaceArchived && (
                <span className="rounded-full bg-warning/10 px-2 py-0.5 text-t font-medium text-warning">
                  Workspace archived
                </span>
              )}
            </div>

            <div className="rounded-3xl glass-surface px-4 py-1">
              {group.runs.map((run, index) => (
                <div
                  key={run.id}
                  className={
                    index > 0
                      ? "border-t border-primary-200/60 dark:border-primary-800/20"
                      : undefined
                  }
                >
                  <ArchivedRunRow
                    run={run}
                    onUnarchive={() => handleUnarchive(run)}
                    onDelete={() => setPendingDelete(run)}
                  />
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <Alert
        isOpen={!!pendingDelete}
        title="Delete run?"
        description="This permanently deletes the run and its stored history from Mains. For Codex runs, the Codex thread and its spawned descendant threads are deleted too. This cannot be undone."
        primaryButtonText="Delete"
        secondaryButtonText="Cancel"
        primaryButtonVariant="danger"
        isPrimaryLoading={isDeleting}
        onPrimary={handleDelete}
        onSecondary={() => setPendingDelete(null)}
      />
    </>
  );
}

function ArchivedWorkspaceRow({
  workspace,
  onUnarchive,
  onDelete,
}: {
  workspace: ArchivedWorkspace;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const branch = workspace.worktree?.name ?? workspace.baseBranch;
  const statusConfig = getWorkspaceStatusConfig(workspace.status);

  return (
    <div className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between md:gap-8">
      <div className="min-w-0 md:flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Body className="truncate">{workspace.name}</Body>
          {branch && <Body className="truncate opacity-70">• {branch}</Body>}
          {!workspace.pathExists && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-1.5 py-0.5 text-warning">
              <Danger className="size-3" />
              <span className="text-t">Folder missing</span>
            </span>
          )}
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-1">
          <WorkspaceStatusIcon
            status={workspace.status}
            className={`size-2.5 shrink-0 ${statusConfig.iconColor}`}
          />
          <Caption className="shrink-0 opacity-70">
            {statusConfig.label}
          </Caption>
          <Caption className="truncate opacity-70">
            • {formatAbsoluteDate(workspace.updatedAt)}
          </Caption>
        </div>
      </div>

      <ArchiveRowActions onDelete={onDelete} onUnarchive={onUnarchive} />
    </div>
  );
}

function ArchivedRunRow({
  run,
  onUnarchive,
  onDelete,
}: {
  run: ArchivedRun;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const provider = getProviderVariantById(run.providerId);
  const ProviderIcon = provider?.icon;
  const title = runDisplayTitle(run);
  const unarchiveUnavailableReason = !run.workspace
    ? "This run has no workspace and cannot be restored"
    : run.workspace.isArchived
      ? "Unarchive the workspace before restoring this run"
      : undefined;

  return (
    <div className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between md:gap-8">
      <div className="min-w-0 md:flex-1">
        <Body className="block truncate">{title}</Body>

        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex items-center gap-1">
            {ProviderIcon && (
              <ProviderIcon
                className={`size-3.5 text-primary-600 dark:text-primary-400`}
              />
            )}
            <Caption className="opacity-80">
              {provider?.label ?? run.providerId}
            </Caption>
          </span>
          <Caption className="opacity-70">
            {formatAbsoluteDate(run.updatedAt)}
          </Caption>
        </div>
      </div>

      <ArchiveRowActions
        onDelete={onDelete}
        onUnarchive={onUnarchive}
        unarchiveDisabled={Boolean(unarchiveUnavailableReason)}
        unarchiveTooltip={unarchiveUnavailableReason}
      />
    </div>
  );
}

function ArchiveRowActions({
  onDelete,
  onUnarchive,
  unarchiveDisabled = false,
  unarchiveTooltip,
}: {
  onDelete: () => void;
  onUnarchive: () => void;
  unarchiveDisabled?: boolean;
  unarchiveTooltip?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        variant="ghost"
        onClick={onDelete}
        tooltip="Delete permanently"
        className="flex rounded-full px-2 py-1 text-primary-700 dark:text-primary-300"
      >
        <Trash className="size-4" />
      </Button>
      <Button
        variant="secondary"
        onClick={onUnarchive}
        disabled={unarchiveDisabled}
        tooltip={unarchiveTooltip}
      >
        Unarchive
      </Button>
    </div>
  );
}

function ArchiveEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Archive className="size-5 text-primary-600 dark:text-primary-400" />
      <Muted>{title}.</Muted>
      <Caption>{description}</Caption>
    </div>
  );
}

function runDisplayTitle(run: ArchivedRun): string {
  return run.title || run.goal || `Run ${run.id.slice(0, 8)}`;
}
