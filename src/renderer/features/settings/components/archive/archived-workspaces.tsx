import { useState } from "react";
import {
  Alert,
  Body,
  Button,
  Caption,
  Checkbox,
  Muted,
  toast,
} from "@/components/ui";
import {
  Archive,
  Danger,
  Trash,
  WorkspaceStatusIcon,
} from "@/components/ui/icons";
import { extractErrorMessage } from "@/lib/extract-error-message";
import { formatAbsoluteDate } from "@/lib/format-date";
import { getWorkspaceStatusConfig } from "@/lib/workspace-status";
import {
  useDeleteWorkspaceMutation,
  useListArchivedWorkspacesQuery,
  useUnarchiveWorkspaceMutation,
  type ArchivedWorkspace,
} from "@/lib/redux/api";
import { SettingsPageShell, SettingsSection } from "../settings-layout";

/**
 * Settings › Archive — the only route back out of archiving.
 *
 * Archived workspaces are filtered out of every other list in the app, so
 * without this screen a workspace archived by mistake is unreachable: it can't
 * be restored and it can't be deleted. Both of those live here.
 */
export default function ArchivedWorkspaces() {
  const {
    data: workspaces = [],
    isLoading,
    error,
  } = useListArchivedWorkspacesQuery();

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
    // Default off: deleting the row is reversible-ish (the repo is untouched),
    // removing the directory is not.
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

  const canRemoveDirectory = !!pendingDelete?.worktree;

  return (
    <SettingsPageShell
      title="Archive"
      isLoading={isLoading}
      error={error}
      errorMessage="Unable to load archived workspaces."
    >
      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Archive className="size-5 text-primary-400 dark:text-primary-600" />
          <Muted>No archived workspaces.</Muted>
          <Caption>
            Workspaces you archive from the sidebar show up here, where you can
            restore or permanently delete them.
          </Caption>
        </div>
      ) : (
        <SettingsSection
          title={`${workspaces.length} archived workspace${
            workspaces.length === 1 ? "" : "s"
          }`}
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
      )}

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
        {canRemoveDirectory ? (
          <label className="flex cursor-pointer items-center gap-2.5">
              <Checkbox
                checked={removeWorktree}
                onChange={setRemoveWorktree}
                aria-label="Also remove the worktree from disk"
              />
            <span className="min-w-0">
              <Caption className="block text-primary-900 dark:text-primary-100">
                Also remove the worktree from disk
              </Caption>
            </span>
          </label>
        ) : (
          <Caption className="block opacity-70">
            The folder at {pendingDelete?.rootPath} is left untouched — it is
            your repository, not a worktree Mains created.
          </Caption>
        )}
      </Alert>
    </SettingsPageShell>
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
  // The workspace name, not the project's: a project can hold several
  // worktrees, and the name is the only thing that tells them apart.
  const branch = workspace.worktree?.name ?? workspace.baseBranch;
  // Archiving doesn't touch `status`, so the row still shows where the work
  // stood when it was put away — the thing worth knowing before restoring it.
  const statusConfig = getWorkspaceStatusConfig(workspace.status);

  return (
    <div className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between md:gap-8">
      <div className="min-w-0 md:flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Body className="truncate">{workspace.name}</Body>

          {branch && (
            <Body className="truncate opacity-70">• {branch}</Body>
          )}

          {!workspace.pathExists && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-500">
              <Danger className="size-3" />
              <span className="text-[10px]">Folder missing</span>
            </span>
          )}
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-1">
          <WorkspaceStatusIcon
            status={workspace.status}
            className={`size-2.5 shrink-0 ${statusConfig.iconColor}`}
          />
          <Caption className={`shrink-0 opacity-70 `}>
            {statusConfig.label}
          </Caption>
          <Caption className="truncate opacity-70">
          • {formatAbsoluteDate(workspace.updatedAt)}
          </Caption>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Button's base styles set items-center/justify-center but not
            `flex`, so icon-plus-label needs it spelled out here. */}
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
        >
          Unarchive
        </Button>
      </div>
    </div>
  );
}
