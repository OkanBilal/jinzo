import { useState, useCallback, useEffect, type ReactNode } from "react";
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
} from "@/components/ui/icons";
import {
  Alert,
  Button,
  Caption,
  Checkbox,
  Input,
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
  useGetPublishPreflightQuery,
  usePublishRepoMutation,
  useDiscardWorkspacePathsMutation,
  type ChangedFile,
} from "@/lib/redux/api";
import { extractErrorMessage } from "@/lib/extract-error-message";
import { appEvents } from "@/lib/transport";
import { DIFF_ADDED_TEXT, DIFF_REMOVED_TEXT } from "@/features/workspace/lib/severity";
import { useOpenFileInEditor } from "@/features/workspace/hooks/use-open-file-in-editor";
import { FileIconComponent } from "@/features/workspace/components/file-explorer/components/file-icon";
import { PanelItem, PanelCollapse, PANEL_ROW_X } from "./panel-item";

type PendingAction = "commit" | "commitPush" | "push" | "pr" | "publish" | null;
/** The panel rows that open in place. */
type Section = "changes" | "commit" | "pr" | "publish";

/** An Undo waiting on confirmation. `key` is the row it came from. */
interface DiscardRequest {
  key: string;
  files: ChangedFile[];
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
 * place instead of swapping the panel's contents. Both can be open at once —
 * whether a row is *usable* is the enable/disable rules below, not exclusivity.
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
  const model = useAppSelector(
    (state) =>
      providerId ? state.workspace.selectedModelByProvider[providerId] : undefined,
  );

  const openFileInEditor = useOpenFileInEditor();

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
  // Publish section (offered in place of push/PR when the repo has no remote).
  const [publishOwnerRepo, setPublishOwnerRepo] = useState("");
  const [publishPrivate, setPublishPrivate] = useState(true);
  const [publishSsh, setPublishSsh] = useState(false);
  const [publishRemote, setPublishRemote] = useState("origin");
  const [publishAdvanced, setPublishAdvanced] = useState(false);

  const isSectionOpen = (section: Section) => openSections.includes(section);
  const toggleSection = (section: Section) =>
    setOpenSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section],
    );

  const { data: status, refetch } = useGetGitFlowStatusQuery(activeWorkspaceId!, {
    skip: !activeWorkspaceId,
    // Pull fresh status each time the panel opens, so reopening after a
    // commit/push (or any external working-tree change) never shows stale
    // cached numbers.
    refetchOnMountOrArgChange: true,
  });

  // gh auth + default owner/name, fetched only while the publish form is open.
  const { data: preflight, isFetching: preflightFetching } =
    useGetPublishPreflightQuery(activeWorkspaceId!, {
      skip: !activeWorkspaceId || !isSectionOpen("publish"),
    });

  const [commitGitFlow] = useCommitGitFlowMutation();
  const [pushGitFlow] = usePushGitFlowMutation();
  const [createPrGitFlow] = useCreatePrGitFlowMutation();
  const [publishRepo] = usePublishRepoMutation();
  const [discardWorkspacePaths] = useDiscardWorkspacePathsMutation();
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
      await refetch();
    } finally {
      setIsManualRefresh(false);
    }
  }, [activeWorkspaceId, isManualRefresh, refetch, resyncWorkspaceDiff]);

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
        refetch();
      } catch (err) {
        toast.error(extractErrorMessage(err, "Failed to revert changes."));
      } finally {
        setDiscarding(null);
        setConfirmDiscard(null);
      }
    },
    [activeWorkspaceId, discarding, discardWorkspacePaths, refetch],
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
        refetch();
      }, 400);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [activeWorkspaceId, refetch]);

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
      onClose();
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
      refetch();
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
    refetch,
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
          <span className="flex items-center gap-1 font-medium text-xxs">
            <NumberFlow value={additions} prefix="+" className={DIFF_ADDED_TEXT} />
            <NumberFlow value={deletions} prefix="-" className={DIFF_REMOVED_TEXT} />
          </span>
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
              onOpen={openFileInEditor}
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
        trailing={
          hasChanges
            ? `${changedFiles} file${changedFiles === 1 ? "" : "s"}`
            : undefined
        }
      />

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
            className="w-full resize-none text-xs"
          />
          <label className="mt-1 mb-2 flex cursor-pointer select-none items-center gap-2 text-xs text-primary-600 dark:text-primary-300">
            <Checkbox
              checked={includeUnstaged}
              onChange={() => setIncludeUnstaged((v) => !v)}
            />
            Include unstaged changes
          </label>
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
                placeholder="PR title (leave blank to generate)…"
                className="w-full text-xs"
              />
              <Textarea
                value={prBody}
                onChange={(e) => setPrBody(e.target.value)}
                rows={4}
                placeholder="Description (optional, leave blank to generate)…"
                className="w-full text-xs"
              />
              <label className="mb-1 -mt-1 flex cursor-pointer select-none items-center gap-2 text-s text-primary-600 dark:text-primary-300">
                <Checkbox
                  checked={prDraft}
                  onChange={() => setPrDraft((v) => !v)}
                />
                Create as draft
              </label>
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
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                  {preflight.notReadyReason ??
                    "Sign in with the GitHub CLI first."}
                </div>
              )}

              <div>
                <Caption className="mb-1 block text-xs text-primary-500">
                  Repository
                </Caption>
                <div className="flex items-center gap-1.5 rounded-lg bg-primary-100/40 px-2.5 dark:bg-primary-800/40">
                  <Github className="size-3.5 shrink-0 text-primary-500" />
                  <span className="shrink-0 text-xs text-primary-500">
                    github.com/
                  </span>
                  <input
                    type="text"
                    value={publishOwnerRepo || defaultOwnerRepo}
                    onChange={(e) => setPublishOwnerRepo(e.target.value)}
                    placeholder="owner/repo"
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    className="min-w-0 flex-1 bg-transparent py-2 font-mono text-xs text-primary-950 placeholder:text-primary-500 focus:outline-none dark:text-primary-100"
                  />
                </div>
              </div>

              <div>
                <Caption className="mb-1 block text-xs text-primary-500">
                  Visibility
                </Caption>
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-primary-600 dark:text-primary-300">
                    <Checkbox
                      checked={publishPrivate}
                      onChange={() => setPublishPrivate(true)}
                    />
                    <Lock className="size-3.5 text-primary-500" />
                    Private
                  </label>
                  <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-primary-600 dark:text-primary-300">
                    <Checkbox
                      checked={!publishPrivate}
                      onChange={() => setPublishPrivate(false)}
                    />
                    Public
                  </label>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setPublishAdvanced((v) => !v)}
                className="flex items-center gap-1 pt-2 text-s text-primary-500 hover:text-primary-700 dark:hover:text-primary-200"
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
                      <Caption className="mb-1 block text-xs text-primary-500">
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
                      <Caption className="mb-1 block text-xs text-primary-500">
                        Protocol
                      </Caption>
                      <div className="flex items-center gap-4">
                        <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-primary-600 dark:text-primary-300">
                          <Checkbox
                            checked={publishSsh}
                            onChange={() => setPublishSsh(true)}
                          />
                          SSH
                        </label>
                        <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-primary-600 dark:text-primary-300">
                          <Checkbox
                            checked={!publishSsh}
                            onChange={() => setPublishSsh(false)}
                          />
                          HTTPS
                        </label>
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

      {/* Portals to the body, so it isn't clipped by the panel's scroll box. */}
      <Alert
        isOpen={!!confirmDiscard}
        title={confirmDiscard ? describeDiscard(confirmDiscard.files).title : ""}
        description={
          confirmDiscard ? describeDiscard(confirmDiscard.files).description : ""
        }
        primaryButtonText="Revert"
        secondaryButtonText="Cancel"
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
  onDiscard,
  discarding,
}: {
  file: ChangedFile;
  onOpen: (filePath: string) => void;
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
        <span className="flex items-center gap-1 font-medium text-xxs">
          {file.additions > 0 && (
            <span className={DIFF_ADDED_TEXT}>+{file.additions}</span>
          )}
          {file.deletions > 0 && (
            <span className={DIFF_REMOVED_TEXT}>-{file.deletions}</span>
          )}
        </span>
      }
      hoverAction={{
        icon: <Undo className="size-3.5" />,
        title: file.isNew
          ? `Delete ${file.path}`
          : `Revert ${file.path} to its committed state`,
        onClick: onDiscard,
        pending: discarding,
      }}
      title={`Open ${file.path} in the editor`}
      onClick={() => onOpen(file.path)}
    />
  );
}
