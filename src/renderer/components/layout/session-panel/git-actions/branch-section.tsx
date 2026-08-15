import { useCallback, useState } from "react";
import { Branch, Check, Refresh } from "@/components/ui/icons";
import { Alert, Text, toast } from "@/components/ui";
import {
  useGetWorkspaceQuery,
  useListProjectBranchesQuery,
  useSwitchWorkspaceBranchMutation,
} from "@/lib/redux/api";
import { extractErrorMessage } from "@/lib/extract-error-message";
import { PanelItem, PanelCollapse } from "../panel-item";
import type { GitActionsPanel } from "./use-git-actions-panel";

/**
 * The checked-out branch, and the repo's other branches to switch to.
 *
 * Both queries are scoped to the row being open: `git branch` on a large repo
 * isn't free, and the panel is opened far more often than this row is.
 */
export function BranchSection({ panel }: { panel: GitActionsPanel }) {
  const {
    workspaceId,
    status,
    hasChanges,
    changedFiles,
    refreshStatus,
    isSectionOpen,
    toggleSection,
  } = panel;
  const isOpen = isSectionOpen("branch");

  /** Branch being checked out, and the one held for confirmation. */
  const [switchingBranch, setSwitchingBranch] = useState<string | null>(null);
  const [confirmBranch, setConfirmBranch] = useState<string | null>(null);

  // The branch list comes from the project's repo — a worktree workspace shares
  // its refs, so the names are the same either way.
  const { data: workspace } = useGetWorkspaceQuery(workspaceId);
  const projectId = workspace?.projectId ?? null;
  const { data: branchNames, isFetching: branchesFetching } =
    useListProjectBranchesQuery(projectId!, { skip: !projectId || !isOpen });
  const branches = branchNames ?? [];

  const [switchWorkspaceBranch] = useSwitchWorkspaceBranchMutation();

  const runBranchSwitch = useCallback(
    async (branch: string) => {
      if (switchingBranch) return;
      setSwitchingBranch(branch);
      try {
        await switchWorkspaceBranch({ workspaceId, branch }).unwrap();
        toast.success(`Switched to ${branch}`);
        refreshStatus();
      } catch (err) {
        // git refuses a checkout that would overwrite local work, or one whose
        // branch is checked out in another worktree. Its message says which.
        toast.error(extractErrorMessage(err, `Could not switch to ${branch}.`));
      } finally {
        setSwitchingBranch(null);
        setConfirmBranch(null);
      }
    },
    [workspaceId, switchingBranch, switchWorkspaceBranch, refreshStatus],
  );

  /**
   * Uncommitted work travels with a checkout — or blocks it, if the target
   * branch touches the same files. Neither is obvious from a branch list, so a
   * dirty tree asks first; a clean one just switches.
   */
  const handleBranchClick = useCallback(
    (branch: string) => {
      if (branch === status?.branch) return;
      if (hasChanges) {
        setConfirmBranch(branch);
        return;
      }
      runBranchSwitch(branch);
    },
    [status?.branch, hasChanges, runBranchSwitch],
  );

  return (
    <>
      <PanelItem
        icon={<Branch className="size-4" />}
        label={status?.branch || "—"}
        expandable
        expanded={isOpen}
        onClick={() => toggleSection("branch")}
        // Nothing to list without a project: the branch names come from the
        // project's repo, which a worktree workspace shares refs with.
        disabled={!projectId}
        title={
          projectId ? "Show the repo's branches" : "This workspace has no project"
        }
      />
      <PanelCollapse isOpen={isOpen}>
        <div className="max-h-56 overflow-y-auto noscrollbar">
          {branchesFetching && branches.length === 0 ? (
            <PanelItem
              icon={<Refresh className="size-4 animate-spin" />}
              label={
                <Text as="span" size="inherit" tone="faint" weight="normal">
                  Loading…
                </Text>
              }
            />
          ) : (
            branches.map((branch) => {
              const isCurrent = branch === status?.branch;
              return (
                <PanelItem
                  key={branch}
                  icon={<Branch className="size-4" />}
                  label={branch}
                  title={
                    isCurrent
                      ? `${branch} — already checked out`
                      : `Switch to ${branch}`
                  }
                  onClick={isCurrent ? undefined : () => handleBranchClick(branch)}
                  disabled={switchingBranch !== null}
                  loading={switchingBranch === branch}
                  // The checkout it's on, marked rather than offered again.
                  trailing={isCurrent ? <Check className="size-3.5" /> : undefined}
                />
              );
            })
          )}
        </div>
      </PanelCollapse>

      <Alert
        isOpen={!!confirmBranch}
        title={`Switch to ${confirmBranch ?? ""}?`}
        description={`${changedFiles} uncommitted file${
          changedFiles === 1 ? "" : "s"
        } will come along to ${confirmBranch ?? ""}. Git refuses the switch outright if that branch touches the same files.`}
        primaryButtonText="Switch"
        secondaryButtonText="Cancel"
        primaryButtonVariant="primary"
        onPrimary={() => confirmBranch && runBranchSwitch(confirmBranch)}
        onSecondary={() => setConfirmBranch(null)}
        isPrimaryLoading={switchingBranch !== null}
      />
    </>
  );
}
