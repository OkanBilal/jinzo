import { useRef, useState, useCallback } from "react";
import {
  Commit,
  PullRequest,
  ArrowUp,
  Branch,
  Refresh,
} from "@/components/ui/icons";
import {
  Button,
  Caption,
  Checkbox,
  DropdownMenu,
  Text,
  Textarea,
  toast,
} from "@/components/ui";
import { useAppSelector } from "@/lib/redux/hooks";
import {
  useGetGitFlowStatusQuery,
  useCommitGitFlowMutation,
  usePushGitFlowMutation,
  useCreatePrGitFlowMutation,
  useResyncWorkspaceDiffMutation,
} from "@/lib/redux/api";

type PendingAction = "commit" | "commitPush" | "push" | "pr" | null;
type PanelView = "commit" | "pr";

interface GitActionsDropdownProps {
  providerId?: string;
}

export function GitActionsDropdown({ providerId }: GitActionsDropdownProps) {
  const activeWorkspaceId = useAppSelector(
    (state) => state.workspace.activeWorkspaceId,
  );
  const model = useAppSelector(
    (state) =>
      providerId ? state.workspace.selectedModelByProvider[providerId] : undefined,
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const [view, setView] = useState<PanelView>("commit");
  const [message, setMessage] = useState("");
  const [includeUnstaged, setIncludeUnstaged] = useState(true);
  const [prTitle, setPrTitle] = useState("");
  const [prBody, setPrBody] = useState("");
  const [prDraft, setPrDraft] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  const {
    data: status,
    isFetching,
    refetch,
  } = useGetGitFlowStatusQuery(activeWorkspaceId!, {
    skip: !activeWorkspaceId || !isOpen,
    // Pull fresh status each time the panel opens, so reopening after a
    // commit/push (or any external working-tree change) never shows stale
    // cached numbers.
    refetchOnMountOrArgChange: true,
  });

  const [commitGitFlow] = useCommitGitFlowMutation();
  const [pushGitFlow] = usePushGitFlowMutation();
  const [createPrGitFlow] = useCreatePrGitFlowMutation();
  // Recomputes + persists the canonical workspace diff and invalidates the
  // WorkspaceDiffs cache, so the sidebar workspace item (which reads that
  // stored diff) reflects the same numbers the panel shows live.
  const [resyncWorkspaceDiff] = useResyncWorkspaceDiffMutation();

  const additions = status?.additions ?? 0;
  const deletions = status?.deletions ?? 0;
  const changedFiles = status?.changedFiles ?? 0;
  const ahead = status?.ahead ?? 0;
  const hasChanges = changedFiles > 0;
  const canPush = ahead > 0 || (status ? !status.hasUpstream : false);
  // On the default branch a PR can't be opened (default → default), so the
  // action is disabled. No prompt to branch — opening a PR is a deliberate
  // choice the user would have made via a worktree.
  const isDefaultBranch = status?.isDefaultBranch ?? false;

  // Closing also resets transient form state so the next open starts clean
  // (done here rather than in an effect to avoid cascading-render lint).
  const close = useCallback(() => {
    setIsOpen(false);
    setView("commit");
    setMessage("");
    setPrTitle("");
    setPrBody("");
    setPrDraft(false);
    setPending(null);
  }, []);

  const handleToggle = useCallback(() => {
    if (isOpen) {
      close();
      return;
    }
    if (!triggerRef.current || !activeWorkspaceId) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({ x: rect.right - 384, y: rect.bottom + 6 });
    setIsOpen(true);
    // Refresh the stored workspace diff on open so the sidebar item matches
    // the panel's live numbers (the agent run / manual refresh aren't the only
    // moments the working tree changes).
    resyncWorkspaceDiff(activeWorkspaceId);
  }, [isOpen, close, activeWorkspaceId, resyncWorkspaceDiff]);

  // Manual refresh: re-read the live panel status AND re-persist the workspace
  // diff (which refreshes the sidebar via cache invalidation).
  const handleRefresh = useCallback(() => {
    if (!activeWorkspaceId) return;
    refetch();
    resyncWorkspaceDiff(activeWorkspaceId);
  }, [activeWorkspaceId, refetch, resyncWorkspaceDiff]);

  const handleCommit = useCallback(
    async (push: boolean) => {
      if (!activeWorkspaceId || pending) return;
      setPending(push ? "commitPush" : "commit");
      try {
        const result = await commitGitFlow({
          workspaceId: activeWorkspaceId,
          message: message.trim() || undefined,
          includeUnstaged,
          providerId,
          model,
          push,
        }).unwrap();
        setMessage("");
        toast.success(
          push ? "Committed and pushed" : `Committed ${result.summary}`,
        );
        // Refresh the panel's live status in place for both commit and
        // commit+push. getGitFlowStatus isn't WorkspaceDiffs-tagged (to avoid a
        // resync cascade), so it needs an explicit refetch after the mutation —
        // otherwise the dropdown keeps showing the pre-commit changes.
        refetch();
      } catch (err) {
        toast.error(typeof err === "string" ? err : "Commit failed");
      } finally {
        setPending(null);
      }
    },
    [
      activeWorkspaceId,
      pending,
      commitGitFlow,
      message,
      includeUnstaged,
      providerId,
      model,
      refetch,
    ],
  );

  const handlePush = useCallback(async () => {
    if (!activeWorkspaceId || pending) return;
    setPending("push");
    try {
      await pushGitFlow(activeWorkspaceId).unwrap();
      toast.success("Pushed");
      refetch();
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Push failed");
    } finally {
      setPending(null);
    }
  }, [activeWorkspaceId, pending, pushGitFlow, refetch]);

  const handleCreatePr = useCallback(async () => {
    if (!activeWorkspaceId || pending) return;
    setPending("pr");
    try {
      const result = await createPrGitFlow({
        workspaceId: activeWorkspaceId,
        title: prTitle.trim() || undefined,
        body: prBody.trim() || undefined,
        draft: prDraft,
        providerId,
        model,
      }).unwrap();
      toast.success("Pull request created");
      if (result.url) window.api.shell.openExternal(result.url);
      close();
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Failed to create PR");
    } finally {
      setPending(null);
    }
  }, [
    activeWorkspaceId,
    pending,
    createPrGitFlow,
    prTitle,
    prBody,
    prDraft,
    providerId,
    model,
    close,
  ]);

  if (!activeWorkspaceId) return null;

  const busy = pending !== null;

  return (
    <>
      <Button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex items-center gap-1 px-1.5 py-1.25 rounded-lg cursor-pointer text-primary-700 dark:text-primary-300 hover:bg-primary-100/80 dark:hover:bg-primary/10 transition-all duration-300 ease-out"
      >
        <Branch className="size-3.5" />
        <Caption className="text-s">Git</Caption>
        <ArrowUp className="size-3 transition-transform duration-200 rotate-180" />
      </Button>

      <DropdownMenu
        isOpen={isOpen}
        position={position}
        onClose={close}
        minWidth={384}
        origin="top-right"
      >
        {/* Header: branch + live +/- stats */}
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2">
          <div className="flex min-w-0 items-center gap-1.5 text-primary-700 dark:text-primary-200">
            <Branch className="size-3.5 shrink-0" />
            <Text className="truncate text-s font-medium">
              {status?.branch || "—"}
            </Text>
            <Button
              onClick={handleRefresh}
              disabled={isFetching}
              aria-label="Refresh git state"
              title="Refresh git state"
              className="ml-0.5 rounded-md p-0.5 text-primary-500 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-100 disabled:opacity-50"
            >
              <Refresh className={`size-3 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400">
              +{additions}
            </span>
            <span className="text-red-600 dark:text-red-400">-{deletions}</span>
          </div>
        </div>

        {view === "commit" ? (
          <>
            <div className="px-3.5">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    if (hasChanges && !busy) handleCommit(false);
                  }
                }}
                rows={3}
                placeholder="Commit message (leave blank to generate)…"
                className="w-full resize-none text-xs "
              />
              <label className="mt-1 mb-2 flex cursor-pointer select-none items-center gap-2 text-xs text-primary-600 dark:text-primary-300">
                <Checkbox
                  checked={includeUnstaged}
                  onChange={() => setIncludeUnstaged((v) => !v)}
                />
                Include unstaged changes
              </label>
            </div>

            <div className="mt-1 border-t border-primary-200/40 pt-1 dark:border-primary-700/25">
              <PanelAction
                icon={<Commit className="size-4" />}
                label="Commit"
                onClick={() => handleCommit(false)}
                disabled={!hasChanges || busy}
                loading={pending === "commit"}
              />
              <PanelAction
                icon={<ArrowUp className="size-4" />}
                label="Commit and push"
                onClick={() => handleCommit(true)}
                disabled={!hasChanges || busy}
                loading={pending === "commitPush"}
              />
              <PanelAction
                icon={<ArrowUp className="size-4" />}
                label="Push"
                onClick={handlePush}
                disabled={!canPush || busy}
                loading={pending === "push"}
              />
              <PanelAction
                icon={<PullRequest className="size-4" />}
                label="Create pull request…"
                onClick={() => setView("pr")}
                disabled={busy || isDefaultBranch}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 px-3.5">
              <input
                type="text"
                value={prTitle}
                onChange={(e) => setPrTitle(e.target.value)}
                placeholder="PR title (leave blank to generate)…"
                className="w-full rounded-lg bg-primary-100/40 px-3 py-2 text-xs text-primary-950 placeholder:text-primary-500 focus:outline-none dark:bg-primary-800/40 dark:text-primary-100 dark:placeholder:text-primary-500"
              />
              <textarea
                value={prBody}
                onChange={(e) => setPrBody(e.target.value)}
                rows={4}
                placeholder="Description (optional, leave blank to generate)…"
                className="w-full resize-none rounded-lg bg-primary-100/40 px-3 py-2 text-xs text-primary-950 placeholder:text-primary-500 focus:outline-none dark:bg-primary-800/40 dark:text-primary-100 dark:placeholder:text-primary-500"
              />
              <label className="mb-3 -mt-1 flex cursor-pointer select-none items-center gap-2 text-xs text-primary-600 dark:text-primary-300">
                <Checkbox
                  checked={prDraft}
                  onChange={() => setPrDraft((v) => !v)}
                />
                Create as draft
              </label>
            </div>

            <div className="mt-1 border-t border-primary-200/40 pt-1 dark:border-primary-700/25">
              <PanelAction
                icon={<PullRequest className="size-4" />}
                label="Create pull request"
                onClick={handleCreatePr}
                disabled={busy}
                loading={pending === "pr"}
              />
              <PanelAction
                icon={<ArrowUp className="size-4 -rotate-90 -ml-1" />}
                label="Back"
                onClick={() => setView("commit")}
                disabled={busy}
              />
            </div>
          </>
        )}
      </DropdownMenu>
    </>
  );
}

function PanelAction({
  icon,
  label,
  shortcut,
  onClick,
  disabled,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 px-3.5 py-1.5 text-left text-s text-primary-700 transition-colors hover:bg-primary-100/60 disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-200 dark:hover:bg-primary/10"
    >
      <span className="shrink-0 text-primary-500 dark:text-primary-400">
        {loading ? <Refresh className="size-4 animate-spin" /> : icon}
      </span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {shortcut && (
        <span className="shrink-0 rounded bg-primary-200/50 px-1.5 py-0.5 text-xxs text-primary-500 dark:bg-primary-700/40 dark:text-primary-400">
          {shortcut}
        </span>
      )}
    </Button>
  );
}
