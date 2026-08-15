import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import NumberFlow from "@number-flow/react";
import {
  Commit,
  PullRequest,
  ArrowUp,
  Branch,
  Diff,
  Github,
  Lock,
  Undo,
  Check,
  Refresh,
  Sparkles,
} from "@/components/ui/icons";
import {
  Alert,
  AsciiSpinner,
  Button,
  Caption,
  Checkbox,
  Input,
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
  useGenerateCommitMessageGitFlowMutation,
  useGeneratePrBodyGitFlowMutation,
  useResyncWorkspaceDiffMutation,
  useGetPublishPreflightQuery,
  usePublishRepoMutation,
  useDiscardWorkspacePathsMutation,
  useSwitchWorkspaceBranchMutation,
  useGetWorkspaceQuery,
  useListProjectBranchesQuery,
  useLazyGetLatestWorkspaceDiffQuery,
  type ChangedFile,
} from "@/lib/redux/api";
import { extractErrorMessage } from "@/lib/extract-error-message";
import { appEvents } from "@/lib/transport";
import { DIFF_ADDED_TEXT, DIFF_REMOVED_TEXT } from "@/features/workspace/lib/severity";
import { useOpenFileInEditor } from "@/features/workspace/hooks/use-open-file-in-editor";
import { useOpenDiffInEditor } from "@/features/workspace/hooks/use-open-diff-in-editor";
import { parseFileDiffSegment } from "@/features/workspace/utils/parse-diff";
import { FileIconComponent } from "@/features/workspace/components/file-explorer/components/file-icon";
import { PanelItem, PanelCollapse, PANEL_ROW_X } from "./panel-item";

type PendingAction = "commit" | "commitPush" | "push" | "pr" | "publish" | null;
/** The panel rows that open in place. */
type Section = "changes" | "branch" | "commit" | "pr" | "publish";

/** An Undo waiting on confirmation. `key` is the row it came from. */
interface DiscardRequest {
  key: string;
  files: ChangedFile[];
}

/**
 * A checkbox with its label. Six of these sit across the commit, PR, and
 * publish forms; giving them one component is what keeps them one size and one
 * colour, instead of six chances to drift apart.
 */
function CheckboxOption({
  checked,
  onChange,
  className,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Text
      as="label"
      size="xs"
      tone="subtle"
      className={`flex cursor-pointer select-none items-center gap-2 ${className ?? ""}`}
    >
      <Checkbox checked={checked} onChange={onChange} />
      {children}
    </Text>
  );
}

/**
 * What the confirmation says. Restoring a committed file is recoverable from
 * git; deleting one that was never committed is not, so that outcome is named
 * outright rather than folded into a generic "cannot be undone".
 */
function describeDiscard(files: ChangedFile[]): {
  title: string;
  description: string;
} {
  const created = files.filter((f) => f.isNew);
  if (files.length === 1) {
    const name = files[0].path.split("/").pop() || files[0].path;
    return created.length === 1
      ? {
          title: `Delete ${name}?`,
          description: `${files[0].path} was never committed, so deleting it can't be undone.`,
        }
      : {
          title: `Revert ${name}?`,
          description: `${files[0].path} goes back to its committed state. Changes to it are lost.`,
        };
  }
  const restored = files.length - created.length;
  const parts = [
    restored > 0 &&
      `${restored} file${restored === 1 ? "" : "s"} go back to their committed state`,
    created.length > 0 &&
      `${created.length} never-committed file${created.length === 1 ? " is" : "s are"} deleted`,
  ].filter(Boolean);
  return {
    title: "Revert all changes?",
    description: `${parts.join(", and ")}. This can't be undone.`,
  };
}

interface GitActionsSectionProps {
  providerId?: string;
  /** Closes the panel this section lives in (a created PR dismisses it). */
  onClose: () => void;
  /**
   * Rendered under the git actions — the session's subagent list. Kept as a
   * slot so this file stays about git and the panel decides the ordering. It
   * brings its own separator, since it renders nothing at all when the session
   * has no subagents.
   */
  footer?: ReactNode;
}

/**
 * Working-tree state and the git actions for the active workspace, as a menu:
 * every line is a `PanelItem`, and the two action rows open their form in
 * place instead of swapping the panel's contents. Commit and PR are mutually
 * exclusive (opening one closes the other); the other rows stack freely, and
 * whether a row is *usable* is the enable/disable rules below.
 *
 * Mounted only while the session panel is open (`DropdownMenu` renders nothing
 * when closed), so its form state resets on close and its status query starts
 * fresh on each open — no manual teardown needed.
 */
export function GitActionsSection({
  providerId,
  onClose,
  footer,
}: GitActionsSectionProps) {
  const activeWorkspaceId = useAppSelector(
    (state) => state.workspace.activeWorkspaceId,
  );

  const openFileInEditor = useOpenFileInEditor();
  const openDiffInEditor = useOpenDiffInEditor();

  const [openSections, setOpenSections] = useState<Section[]>([]);
  const [message, setMessage] = useState("");
  const [includeUnstaged, setIncludeUnstaged] = useState(true);
  const [prTitle, setPrTitle] = useState("");
  const [prBody, setPrBody] = useState("");
  const [prDraft, setPrDraft] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  /** Path being discarded, or "*" while the whole tree is. */
  const [discarding, setDiscarding] = useState<string | null>(null);
  /** The pending Undo, held until confirmed — discarding can't be undone. */
  const [confirmDiscard, setConfirmDiscard] = useState<DiscardRequest | null>(
    null,
  );
  /** Path whose diff is being fetched, so its row can spin while it loads. */
  const [openingDiff, setOpeningDiff] = useState<string | null>(null);
  /** Branch being checked out, and the one held for confirmation. */
  const [switchingBranch, setSwitchingBranch] = useState<string | null>(null);
  const [confirmBranch, setConfirmBranch] = useState<string | null>(null);
  // Publish section (offered in place of push/PR when the repo has no remote).
  const [publishOwnerRepo, setPublishOwnerRepo] = useState("");
  const [publishPrivate, setPublishPrivate] = useState(true);
  const [publishSsh, setPublishSsh] = useState(false);
  const [publishRemote, setPublishRemote] = useState("origin");
  const [publishAdvanced, setPublishAdvanced] = useState(false);

  const isSectionOpen = (section: Section) => openSections.includes(section);
  // Commit and PR are mutually exclusive — both forms answer "what happens to
  // my changes next", so opening one closes the other. The rest stack freely.
  const EXCLUSIVE_WITH: Partial<Record<Section, Section>> = {
    commit: "pr",
    pr: "commit",
  };
  const toggleSection = (section: Section) =>
    setOpenSections((prev) => {
      if (prev.includes(section)) return prev.filter((s) => s !== section);
      const rival = EXCLUSIVE_WITH[section];
      return [...(rival ? prev.filter((s) => s !== rival) : prev), section];
    });

  const { data: status, refetch } = useGetGitFlowStatusQuery(activeWorkspaceId!, {
    skip: !activeWorkspaceId,
    // Pull fresh status each time the panel opens, so reopening after a
    // commit/push (or any external working-tree change) never shows stale
    // cached numbers.
    refetchOnMountOrArgChange: true,
  });

  // The branch list comes from the project's repo — a worktree workspace shares
  // its refs, so the names are the same either way. Fetched only while the row
  // is open; `git branch` on a large repo isn't free.
  const { data: workspace } = useGetWorkspaceQuery(activeWorkspaceId!, {
    skip: !activeWorkspaceId,
  });
  const projectId = workspace?.projectId ?? null;
  const { data: branchNames, isFetching: branchesFetching } =
    useListProjectBranchesQuery(projectId!, {
      skip: !projectId || !isSectionOpen("branch"),
    });
  const branches = branchNames ?? [];

  // gh auth + default owner/name, fetched only while the publish form is open.
  const { data: preflight, isFetching: preflightFetching } =
    useGetPublishPreflightQuery(activeWorkspaceId!, {
      skip: !activeWorkspaceId || !isSectionOpen("publish"),
    });

  const [commitGitFlow] = useCommitGitFlowMutation();
  const [pushGitFlow] = usePushGitFlowMutation();
  const [createPrGitFlow] = useCreatePrGitFlowMutation();
  // Explicit "Generate" buttons in the commit / PR forms: fill the fields with
  // a one-shot model call so the action button itself stays instant. Leaving
  // the fields blank and clicking Commit / Create PR still generates inline
  // (the original flow).
  const [generateCommitMessage, { isLoading: generatingMessage }] =
    useGenerateCommitMessageGitFlowMutation();
  const [generatePrBody, { isLoading: generatingPr }] =
    useGeneratePrBodyGitFlowMutation();
  /** Bumped on commit so an in-flight generation for the old changeset is dropped. */
  const prefillSeqRef = useRef(0);
  const [publishRepo] = usePublishRepoMutation();
  const [discardWorkspacePaths] = useDiscardWorkspacePathsMutation();
  // On demand only: the diff text is fetched when a file row is clicked, not
  // alongside the status this panel polls throughout a run.
  const [fetchLatestDiff] = useLazyGetLatestWorkspaceDiffQuery();
  const [switchWorkspaceBranch] = useSwitchWorkspaceBranchMutation();
  // Recomputes + persists the canonical workspace diff and invalidates the
  // WorkspaceDiffs cache, so the sidebar workspace item (which reads that
  // stored diff) reflects the same numbers the panel shows live.
  const [resyncWorkspaceDiff] = useResyncWorkspaceDiffMutation();

  const additions = status?.additions ?? 0;
  const deletions = status?.deletions ?? 0;
  const changedFiles = status?.changedFiles ?? 0;
  const changedFilePaths = status?.files ?? [];
  const ahead = status?.ahead ?? 0;
  const hasChanges = changedFiles > 0;
  // Default to "has remote" until status loads so we don't flash the Publish
  // action for normal repos. Only a loaded status with hasRemote:false swaps in
  // the Publish flow (push/PR are impossible without a remote).
  const hasRemote = status?.hasRemote ?? true;
  const canPush = ahead > 0 || (status ? !status.hasUpstream : false);
  // On the default branch a PR can't be opened (default → default), so the
  // action is disabled. No prompt to branch — opening a PR is a deliberate
  // choice the user would have made via a worktree.
  const isDefaultBranch = status?.isDefaultBranch ?? false;

  // A row that turns unusable closes its own accordion: after a commit+push or
  // a full revert its row goes disabled, and a disabled row can't be clicked —
  // the open form would otherwise stick until the panel is reopened. Mirrors
  // each row's `disabled` rule below.
  const pruneOpenSections = useCallback((s: typeof status) => {
    if (!s) return;
    const hasCh = (s.changedFiles ?? 0) > 0;
    const canP = (s.ahead ?? 0) > 0 || !s.hasUpstream;
    const remote = s.hasRemote ?? true;
    const onDefault = s.isDefaultBranch ?? false;
    setOpenSections((prev) => {
      const next = prev.filter((sec) => {
        if (sec === "changes") return hasCh;
        if (sec === "commit") return hasCh || canP;
        if (sec === "pr") return remote && !onDefault;
        if (sec === "publish") return !remote;
        return true;
      });
      return next.length === prev.length ? prev : next;
    });
  }, []);

  // Every status refresh funnels through here so stale accordions close as
  // soon as the fresh state lands, whatever triggered the change.
  const refreshStatus = useCallback(async () => {
    const res = await refetch();
    pruneOpenSections(res.data);
  }, [refetch, pruneOpenSections]);

  // Default publish target from the gh preflight (authed login + repo name).
  // The input falls back to this until the user types, so no prefill effect
  // (and no cascading-render setState) is needed.
  const defaultOwnerRepo =
    preflight?.ghReady && preflight.login
      ? `${preflight.login}/${preflight.suggestedName}`
      : "";

  // Manual refresh: re-read the live panel status AND re-persist the workspace
  // diff (which refreshes the sidebar via cache invalidation). Tracked
  // separately from `isFetching` so only a click spins the icon — the live
  // refetches below would otherwise flicker it for the whole run.
  const handleRefresh = useCallback(async () => {
    if (!activeWorkspaceId || isManualRefresh) return;
    setIsManualRefresh(true);
    resyncWorkspaceDiff(activeWorkspaceId);
    try {
      await refreshStatus();
    } finally {
      setIsManualRefresh(false);
    }
  }, [activeWorkspaceId, isManualRefresh, refreshStatus, resyncWorkspaceDiff]);

  /**
   * Open a changed file as a diff. The row belongs to a list of *changes*, so a
   * click should show what changed rather than the whole current file — the
   * same thing the sidebar's Changes tab opens.
   *
   * The status payload carries paths and counts only, so the diff text is
   * pulled from the stored workspace diff and sliced down to this one file. A
   * snapshot that predates the change (or was never captured) yields no
   * segment; that's what the resync retry is for. If even that comes up empty —
   * a binary file, or one git no longer reports — the file itself opens, so a
   * click is never a no-op.
   */
  const handleOpenFileDiff = useCallback(
    async (filePath: string) => {
      if (!activeWorkspaceId || openingDiff) return;
      setOpeningDiff(filePath);
      try {
        const cached = await fetchLatestDiff(activeWorkspaceId, true).unwrap();
        const segment = cached?.diffText
          ? parseFileDiffSegment(filePath, cached.diffText)
          : "";
        if (segment) {
          openDiffInEditor(filePath, segment);
          return;
        }

        await resyncWorkspaceDiff(activeWorkspaceId).unwrap();
        const fresh = await fetchLatestDiff(activeWorkspaceId, false).unwrap();
        const freshSegment = fresh?.diffText
          ? parseFileDiffSegment(filePath, fresh.diffText)
          : "";
        if (freshSegment) {
          openDiffInEditor(filePath, freshSegment);
          return;
        }
      } catch {
        // Fall through — the file view is always available.
      } finally {
        setOpeningDiff(null);
      }
      openFileInEditor(filePath);
    },
    [
      activeWorkspaceId,
      openingDiff,
      fetchLatestDiff,
      resyncWorkspaceDiff,
      openDiffInEditor,
      openFileInEditor,
    ],
  );

  /**
   * Run a confirmed Undo: restore those files to their HEAD state. One file
   * from a file row, every listed file from the summary row — the panel undoes
   * exactly what it is showing.
   */
  const handleDiscard = useCallback(
    async ({ key, files }: DiscardRequest) => {
      if (!activeWorkspaceId || discarding || files.length === 0) return;
      const paths = files.map((f) => f.path);
      setDiscarding(key);
      try {
        await discardWorkspacePaths({
          workspaceId: activeWorkspaceId,
          paths,
        }).unwrap();
        toast.success(
          paths.length === 1
            ? `Reverted ${paths[0].split("/").pop()}`
            : `Reverted ${paths.length} files`,
        );
        refreshStatus();
      } catch (err) {
        toast.error(extractErrorMessage(err, "Failed to revert changes."));
      } finally {
        setDiscarding(null);
        setConfirmDiscard(null);
      }
    },
    [activeWorkspaceId, discarding, discardWorkspacePaths, refreshStatus],
  );

  const runBranchSwitch = useCallback(
    async (branch: string) => {
      if (!activeWorkspaceId || switchingBranch) return;
      setSwitchingBranch(branch);
      try {
        await switchWorkspaceBranch({
          workspaceId: activeWorkspaceId,
          branch,
        }).unwrap();
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
    [activeWorkspaceId, switchingBranch, switchWorkspaceBranch, refreshStatus],
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

  // Live counts during a run: the run session recomputes the workspace diff
  // whenever a file-touching tool finishes and broadcasts it. getGitFlowStatus
  // is deliberately not WorkspaceDiffs-tagged (that invalidation cascades into
  // a resync), so it's refetched straight off the same signal. Coalesced,
  // because status runs its own diff snapshot and a burst of edits shouldn't
  // queue one per event.
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = appEvents.runs.onDiffUpdated(({ workspaceId }) => {
      if (workspaceId !== activeWorkspaceId || timer) return;
      timer = setTimeout(() => {
        timer = null;
        refreshStatus();
      }, 400);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [activeWorkspaceId, refreshStatus]);

  /**
   * The Generate button in the commit form: fills the textarea with a model-
   * written message (overwriting what's there — the click is deliberate).
   * `preview: true` keeps the index untouched; the seq guard drops a result
   * that lands after a commit already emptied the field.
   */
  const handleGenerateMessage = useCallback(() => {
    if (!activeWorkspaceId || !providerId || generatingMessage) return;
    const seq = prefillSeqRef.current;
    generateCommitMessage({
      workspaceId: activeWorkspaceId,
      providerId,
      includeUnstaged,
      preview: true,
    })
      .unwrap()
      .then((generated) => {
        if (prefillSeqRef.current !== seq) return;
        setMessage(generated);
      })
      .catch((err) =>
        toast.error(extractErrorMessage(err, "Failed to generate a commit message.")),
      );
  }, [
    activeWorkspaceId,
    providerId,
    generatingMessage,
    includeUnstaged,
    generateCommitMessage,
  ]);

  /** Same explicit generation for the PR form — fills title + body. */
  const handleGeneratePr = useCallback(() => {
    if (!activeWorkspaceId || !providerId || generatingPr) return;
    generatePrBody({ workspaceId: activeWorkspaceId, providerId })
      .unwrap()
      .then((generated) => {
        setPrTitle(generated.title);
        setPrBody(generated.body);
      })
      .catch((err) =>
        toast.error(extractErrorMessage(err, "Failed to generate the PR description.")),
      );
  }, [activeWorkspaceId, providerId, generatingPr, generatePrBody]);

  const handleCommit = useCallback(
    async (push: boolean) => {
      if (!activeWorkspaceId || pending) return;
      setPending(push ? "commitPush" : "commit");
      // Persistent loading toast: the toast store is global, so the progress
      // stays visible (and the outcome lands) even if the panel closes and
      // this component unmounts mid-operation. Success/error reuse the id to
      // swap the same toast in place.
      const toastId = toast.loading(
        push ? "Committing and pushing…" : "Committing…",
      );
      try {
        const result = await commitGitFlow({
          workspaceId: activeWorkspaceId,
          message: message.trim() || undefined,
          includeUnstaged,
          providerId,
          push,
        }).unwrap();
        prefillSeqRef.current++;
        setMessage("");
        toast.success(
          push ? "Committed and pushed" : `Committed ${result.summary}`,
          { id: toastId },
        );
        // Refresh the panel's live status in place for both commit and
        // commit+push. getGitFlowStatus isn't WorkspaceDiffs-tagged (to avoid a
        // resync cascade), so it needs an explicit refetch after the mutation —
        // otherwise the dropdown keeps showing the pre-commit changes.
        refreshStatus();
      } catch (err) {
        toast.error(typeof err === "string" ? err : "Commit failed", {
          id: toastId,
        });
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
      refreshStatus,
    ],
  );

  const handlePush = useCallback(async () => {
    if (!activeWorkspaceId || pending) return;
    setPending("push");
    const toastId = toast.loading("Pushing…");
    try {
      await pushGitFlow(activeWorkspaceId).unwrap();
      toast.success("Pushed", { id: toastId });
      refreshStatus();
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Push failed", {
        id: toastId,
      });
    } finally {
      setPending(null);
    }
  }, [activeWorkspaceId, pending, pushGitFlow, refreshStatus]);

  const handleCreatePr = useCallback(async () => {
    if (!activeWorkspaceId || pending) return;
    setPending("pr");
    const toastId = toast.loading("Creating pull request…");
    try {
      const result = await createPrGitFlow({
        workspaceId: activeWorkspaceId,
        title: prTitle.trim() || undefined,
        body: prBody.trim() || undefined,
        draft: prDraft,
        providerId,
      }).unwrap();
      toast.success("Pull request created", { id: toastId });
      if (result.url) window.api.shell.openExternal(result.url);
      onClose();
    } catch (err) {
      toast.error(typeof err === "string" ? err : "Failed to create PR", {
        id: toastId,
      });
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
    onClose,
  ]);

  const handlePublish = useCallback(async () => {
    if (!activeWorkspaceId || pending) return;
    const ownerRepo = (publishOwnerRepo || defaultOwnerRepo).trim();
    if (!ownerRepo.includes("/") || ownerRepo.split("/").some((s) => !s.trim())) {
      toast.error("Enter the repository as owner/name.");
      return;
    }
    setPending("publish");
    try {
      const result = await publishRepo({
        workspaceId: activeWorkspaceId,
        ownerRepo,
        visibility: publishPrivate ? "private" : "public",
        remoteName: publishRemote.trim() || "origin",
        protocol: publishSsh ? "ssh" : "https",
      }).unwrap();
      toast.success(`Published ${result.owner}/${result.repo}`);
      if (result.url) window.api.shell.openExternal(result.url);
      // Repo now has a remote — collapse the publish form (push/PR rows take
      // its place) and refresh the live status.
      setOpenSections((prev) => prev.filter((s) => s !== "publish"));
      setPublishOwnerRepo("");
      setPublishAdvanced(false);
      refreshStatus();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to publish repository."));
    } finally {
      setPending(null);
    }
  }, [
    activeWorkspaceId,
    pending,
    publishRepo,
    publishOwnerRepo,
    defaultOwnerRepo,
    publishPrivate,
    publishRemote,
    publishSsh,
    refreshStatus,
  ]);

  if (!activeWorkspaceId) return null;

  const busy = pending !== null;

  return (
    <div className="">
      <PanelItem
        icon={<Diff className="size-4" />}
        label="Changes"
        expandable
        expanded={isSectionOpen("changes")}
        onClick={() => toggleSection("changes")}
        disabled={!hasChanges}
        // Refresh moved onto the icon so the row itself is free to expand.
        onIconClick={handleRefresh}
        iconTitle="Refresh git state"
        loading={isManualRefresh}
        hoverAction={
          hasChanges
            ? {
                icon: <Undo className="size-3.5" />,
                title: "Revert every change in the working tree",
                onClick: () =>
                  setConfirmDiscard({ key: "*", files: changedFilePaths }),
                pending: discarding === "*",
              }
            : undefined
        }
        trailing={
          // Animated digits so a count ticking up mid-run reads as movement
          // rather than a silent swap — same treatment as the diff summary bar.
          <Text
            as="span"
            size="xxs"
            tone="inherit"
            weight="medium"
            className="flex items-center gap-1"
          >
            <NumberFlow value={additions} prefix="+" className={DIFF_ADDED_TEXT} />
            <NumberFlow value={deletions} prefix="-" className={DIFF_REMOVED_TEXT} />
          </Text>
        }
      />
      <PanelCollapse isOpen={isSectionOpen("changes")}>
        {/* Capped like the subagent list — a big changeset shouldn't push the
            actions below it off the screen. */}
        <div className="max-h-56 overflow-y-auto noscrollbar">
          {changedFilePaths.map((file) => (
            <ChangedFileRow
              key={file.path}
              file={file}
              onOpen={handleOpenFileDiff}
              opening={openingDiff === file.path}
              onDiscard={() =>
                setConfirmDiscard({ key: file.path, files: [file] })
              }
              discarding={discarding === file.path}
            />
          ))}
        </div>
      </PanelCollapse>

      <PanelItem
        icon={<Branch className="size-4" />}
        label={status?.branch || "—"}
        expandable
        expanded={isSectionOpen("branch")}
        onClick={() => toggleSection("branch")}
        // Nothing to list without a project: the branch names come from the
        // project's repo, which a worktree workspace shares refs with.
        disabled={!projectId}
        title={
          projectId ? "Show the repo's branches" : "This workspace has no project"
        }
        // trailing={
        //   hasChanges
        //     ? `${changedFiles} file${changedFiles === 1 ? "" : "s"}`
        //     : undefined
        // }
      />
      <PanelCollapse isOpen={isSectionOpen("branch")}>
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
                  title={isCurrent ? `${branch} — already checked out` : `Switch to ${branch}`}
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

      <PanelItem
        icon={<Commit className="size-4" />}
        label="Commit or push"
        expandable
        expanded={isSectionOpen("commit")}
        onClick={() => toggleSection("commit")}
        disabled={!hasChanges && !canPush}
      />
      <PanelCollapse isOpen={isSectionOpen("commit")}>
        <div className={`${PANEL_ROW_X} pt-2`}>
          <div className="relative">
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
              placeholder={
                generatingMessage
                  ? "Generating commit message…"
                  : "Commit message (leave blank to generate)…"
              }
              className="w-full resize-none text-xs pb-8"
            />
            <Button
              type="button"
              onClick={handleGenerateMessage}
              disabled={!hasChanges || busy || generatingMessage}
              tooltip="Generate a commit message from the changes"
              tooltipPosition="top-left"
              className="absolute glass-primary bottom-3 right-2 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-100 bg-primary-100/60 hover:bg-primary-200/60 dark:bg-primary-800/40 dark:hover:bg-primary-700/40 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generatingMessage ? (
                <>
                  <AsciiSpinner kind="generate" className="size-3" />
                  Generating
                </>
              ) : (
                <>
                  <Sparkles className="size-3" />
                  Generate
                </>
              )}
            </Button>
          </div>
          <CheckboxOption
            checked={includeUnstaged}
            onChange={() => setIncludeUnstaged((v) => !v)}
            className="mt-1 mb-2"
          >
            Include unstaged changes
          </CheckboxOption>
        </div>
        <PanelItem
              icon={<Commit className="size-4" />}
          label="Commit"
          onClick={() => handleCommit(false)}
          disabled={!hasChanges || busy}
          loading={pending === "commit"}
        />
        {hasRemote && (
          <>
            <PanelItem
              icon={<ArrowUp className="size-4" />}
              label="Commit and push"
              onClick={() => handleCommit(true)}
              disabled={!hasChanges || busy}
              loading={pending === "commitPush"}
            />
            <PanelItem
              icon={<ArrowUp className="size-4" />}
              label="Push"
              onClick={handlePush}
              disabled={!canPush || busy}
              loading={pending === "push"}
            />
          </>
        )}
      </PanelCollapse>

      {hasRemote ? (
        <>
          <PanelItem
            icon={<PullRequest className="size-4" />}
            label="Create pull request"
            expandable
            expanded={isSectionOpen("pr")}
            onClick={() => toggleSection("pr")}
            disabled={isDefaultBranch}
            title={
              isDefaultBranch
                ? "Already on the default branch — nothing to open a PR from."
                : undefined
            }
          />
          <PanelCollapse isOpen={isSectionOpen("pr")}>
            <div className={`space-y-2 pt-2 pb-1 ${PANEL_ROW_X}`}>
              <Input
                type="text"
                value={prTitle}
                onChange={(e) => setPrTitle(e.target.value)}
                placeholder={
                  generatingPr
                    ? "Generating PR title…"
                    : "PR title (leave blank to generate)…"
                }
                className="w-full text-xs"
              />
              <div className="relative">
                <Textarea
                  value={prBody}
                  onChange={(e) => setPrBody(e.target.value)}
                  rows={4}
                  placeholder={
                    generatingPr
                      ? "Generating description…"
                      : "Description (optional, leave blank to generate)…"
                  }
                  className="w-full text-xs pb-8"
                />
                <Button
                  type="button"
                  onClick={handleGeneratePr}
                  disabled={busy || generatingPr}
                  tooltip="Generate the title and description from the branch"
                  tooltipPosition="top-left"
                  className="absolute glass-primary bottom-3 right-2 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-100 bg-primary-100/60 hover:bg-primary-200/60 dark:bg-primary-800/40 dark:hover:bg-primary-700/40 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {generatingPr ? (
                    <>
                      <AsciiSpinner kind="generate" className="size-3" />
                      Generating
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
              <CheckboxOption
                checked={prDraft}
                onChange={() => setPrDraft((v) => !v)}
                className="mb-1 -mt-1"
              >
                Create as draft
              </CheckboxOption>
            </div>
            <PanelItem
              icon={<PullRequest className="size-4" />}
              label="Create pull request"
              onClick={handleCreatePr}
              disabled={busy}
              loading={pending === "pr"}
            />
          </PanelCollapse>
        </>
      ) : (
        // No remote yet — push/PR are impossible. Offer Publish instead, which
        // creates the GitHub repo and wires up origin.
        <>
          <PanelItem
            icon={<Github className="size-4" />}
            label="Publish repository"
            expandable
            expanded={isSectionOpen("publish")}
            onClick={() => toggleSection("publish")}
          />
          <PanelCollapse isOpen={isSectionOpen("publish")}>
            <div className={`space-y-2 pt-2 pb-1 ${PANEL_ROW_X}`}>
              {!preflightFetching && preflight && !preflight.ghReady && (
                <Text
                  as="div"
                  size="xs"
                  tone="warning"
                  className="rounded-lg bg-primary px-3 py-2 dark:bg-warning/10"
                >
                  {preflight.notReadyReason ??
                    "Sign in with the GitHub CLI first."}
                </Text>
              )}

              <div>
                <Caption tone="faint" className="mb-1 block">
                  Repository
                </Caption>
                <div className="flex items-center gap-1.5 rounded-lg bg-primary-100/40 px-2.5 dark:bg-primary-800/40">
                  <Github className="size-3.5 shrink-0 text-primary-500" />
                  <Text as="span" size="xs" tone="faint" className="shrink-0">
                    github.com/
                  </Text>
                  <Input
                    variant="bare"
                    type="text"
                    value={publishOwnerRepo || defaultOwnerRepo}
                    onChange={(e) => setPublishOwnerRepo(e.target.value)}
                    placeholder="owner/repo"
                    aria-label="Repository owner and name"
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="min-w-0 flex-1 bg-transparent py-2 font-mono text-xs text-primary-900 placeholder:text-primary-500 focus:outline-none dark:text-primary-100"
                  />
                </div>
              </div>

              <div>
                <Caption tone="faint" className="mb-1 block">
                  Visibility
                </Caption>
                <div className="flex items-center gap-4">
                  <CheckboxOption
                    checked={publishPrivate}
                    onChange={() => setPublishPrivate(true)}
                  >
                    <Lock className="size-3.5 text-primary-500" />
                    Private
                  </CheckboxOption>
                  <CheckboxOption
                    checked={!publishPrivate}
                    onChange={() => setPublishPrivate(false)}
                  >
                    Public
                  </CheckboxOption>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setPublishAdvanced((v) => !v)}
                className="flex items-center gap-1 pt-2 text-s text-primary-500 hover:text-primary-700 dark:hover:text-primary-300"
              >
                <ArrowUp
                  className={`size-3 transition-transform duration-200 ${publishAdvanced ? "rotate-180" : "rotate-90"}`}
                />
                Advanced
              </Button>

              {/* Smoothly expands/collapses via grid-rows 0fr↔1fr. */}
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                  publishAdvanced
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-2 pt-1">
                    <div>
                      <Caption tone="faint" className="mb-1 block">
                        Remote
                      </Caption>
                      <Input
                        value={publishRemote}
                        onChange={(e) => setPublishRemote(e.target.value)}
                        placeholder="origin"
                        spellCheck={false}
                        className="min-w-0 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <Caption tone="faint" className="mb-1 block">
                        Protocol
                      </Caption>
                      <div className="flex items-center gap-4">
                        <CheckboxOption
                          checked={publishSsh}
                          onChange={() => setPublishSsh(true)}
                        >
                          SSH
                        </CheckboxOption>
                        <CheckboxOption
                          checked={!publishSsh}
                          onChange={() => setPublishSsh(false)}
                        >
                          HTTPS
                        </CheckboxOption>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <PanelItem
              icon={<Github className="size-4" />}
              label="Publish repository"
              onClick={handlePublish}
              disabled={busy || !preflight?.ghReady}
              loading={pending === "publish"}
            />
          </PanelCollapse>
        </>
      )}

      {footer}

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

      {/* Portals to the body, so it isn't clipped by the panel's scroll box. */}
      <Alert
        isOpen={!!confirmDiscard}
        title={confirmDiscard ? describeDiscard(confirmDiscard.files).title : ""}
        description={
          confirmDiscard ? describeDiscard(confirmDiscard.files).description : ""
        }
        primaryButtonText="Revert"
        secondaryButtonText="Cancel"
        primaryButtonVariant="danger"
        onPrimary={() => confirmDiscard && handleDiscard(confirmDiscard)}
        onSecondary={() => setConfirmDiscard(null)}
        isPrimaryLoading={discarding !== null}
      />
    </div>
  );
}

/**
 * One changed file: name, its directory, and its own +/-.
 *
 * The name leads and the directory follows it muted — a panel this narrow
 * truncates a full path down to nothing, and the name is what identifies the
 * file. Zero counts are omitted rather than shown as "+0", so a pure deletion
 * reads as one number instead of two.
 */
function ChangedFileRow({
  file,
  onOpen,
  opening,
  onDiscard,
  discarding,
}: {
  file: ChangedFile;
  onOpen: (filePath: string) => void;
  /** Its diff is being fetched — the icon spins until the tab opens. */
  opening: boolean;
  onDiscard: () => void;
  discarding: boolean;
}) {
  const name = file.path.split("/").pop() || file.path;
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? name.slice(dot + 1) : undefined;

  return (
    <PanelItem
      icon={
        <FileIconComponent
          fileName={name}
          extension={extension}
          className="size-4"
        />
      }
      label={
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{name}</span>
        </span>
      }
      trailing={
        <Text
          as="span"
          size="xxs"
          tone="inherit"
          weight="medium"
          className="flex items-center gap-1"
        >
          {file.additions > 0 && (
            <span className={DIFF_ADDED_TEXT}>+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className={DIFF_REMOVED_TEXT}>-{file.deletions}</span>
          )}
        </Text>
      }
      hoverAction={{
        icon: <Undo className="size-3.5" />,
        title: file.isNew
          ? `Delete ${file.path}`
          : `Revert ${file.path} to its committed state`,
        onClick: onDiscard,
        pending: discarding,
      }}
      loading={opening}
      title={`Open the diff for ${file.path}`}
      onClick={() => onOpen(file.path)}
    />
  );
}
