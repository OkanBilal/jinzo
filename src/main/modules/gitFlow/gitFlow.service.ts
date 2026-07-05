// ─────────────────────────────────────────────────────────────
// Git Flow Service
//
// Deterministic commit / push / PR orchestration driven from the UI
// (the git-actions panel), plus the shared building blocks the Mains
// MCP tools (CommitChanges / CreatePR) delegate to so the actual git
// work lives in exactly one place.
//
// Unlike the agent path, the UI flow never round-trips through chat:
// it stages with simple-git, optionally generates a message/body via a
// one-shot headless model call (adapter.generateText), commits/pushes,
// and creates the PR with `gh` directly.
// ─────────────────────────────────────────────────────────────

import { execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";
import {
  ok,
  fail,
  type ServiceResponse,
} from "../../../shared/ipc-kit/service-response";
import {
  workspaceRepo,
  logWorkspaceActivity,
  emitFindingsChanged,
  type WorkspaceMetadata,
} from "../workspace";
import { buildDiffSnapshot } from "../workspace/workspace-diff-snapshot";
import { runSessionRegistry } from "../runs/run-session-registry";
import { gitService } from "../git/git.service";
import { projectsRepo } from "../projects/projects.repo";
import { appSettingsRepo } from "../appSettings/appSettings.repo";
import { SETTINGS_ID } from "../appSettings/appSettings.constants";
import { providersRepo } from "../providers/providers.repo";
// `createWorkAdapter` is imported lazily inside the generation methods to break
// the gitFlow ↔ providers/adapters (mains-tools) require cycle.

const execFileAsync = promisify(execFile);

const MAX_DIFF_CHARS = 12_000;

/** Live snapshot the commit panel renders (branch, stats, push state). */
export interface GitFlowStatus {
  branch: string;
  ahead: number;
  behind: number;
  hasUpstream: boolean;
  /** True when the repo has an `origin` remote. When false, push/PR can't work
   * and the panel offers "Publish repository" instead. */
  hasRemote: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  /** True when the current branch is the repo's default — PR creation is
   * disabled here (you can't open a PR from the default branch to itself). */
  isDefaultBranch: boolean;
}

/** Preflight the Publish wizard reads to gate its Provider step + prefill. */
export interface PublishPreflight {
  /** The `gh` CLI is installed and authenticated (GitHub is publish-ready). */
  ghReady: boolean;
  /** Authenticated GitHub login, used as the default repo owner. */
  login: string | null;
  /** Sanitized default repository name (from the project/workspace). */
  suggestedName: string;
  /** The branch that will be published (current HEAD). */
  branch: string;
  /** True when an `origin` remote already exists (publish would be a no-op). */
  hasRemote: boolean;
  /** Human-readable reason GitHub isn't ready (e.g. gh not installed / not authed). */
  notReadyReason?: string;
}

export interface PublishResult {
  url: string;
  branch: string;
  owner: string;
  repo: string;
}

export interface CommitResult {
  hash: string;
  summary: string;
  pushed: boolean;
}

/** What to stage before committing. */
type StageMode = "all" | "none" | string[];

function readBaseBranchFromMetadata(
  metadata: WorkspaceMetadata | null | undefined,
): string | null {
  const baseBranch = metadata?.baseBranch;
  return typeof baseBranch === "string" && baseBranch.trim()
    ? baseBranch.trim()
    : null;
}

/**
 * Normalize a git remote URL so SSH and HTTPS variants match.
 * e.g. "git@github.com:user/repo.git" and "https://github.com/user/repo.git"
 * both become "github.com/user/repo".
 */
/**
 * Coerce an arbitrary project/workspace name into a valid GitHub repo name:
 * GitHub allows [A-Za-z0-9._-]; everything else (spaces included) becomes a
 * hyphen, with runs collapsed and edges trimmed.
 */
function sanitizeRepoName(name: string): string {
  return name
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
}

function normalizeGitUrl(url: string): string {
  return url
    .replace(/^(https?:\/\/|git@|ssh:\/\/git@)/, "")
    .replace(/:(\d+\/)?/, "/")
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

/** Pull insertion/deletion counts out of a git `--shortstat` string. */
function parseShortstat(shortstat: string): {
  additions: number;
  deletions: number;
} {
  return {
    additions: parseInt(shortstat.match(/(\d+) insertion/)?.[1] ?? "0", 10),
    deletions: parseInt(shortstat.match(/(\d+) deletion/)?.[1] ?? "0", 10),
  };
}

/** Strip code fences / surrounding quotes the model sometimes wraps output in. */
function cleanGenerated(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
  }
  return t;
}

export const gitFlowService = {
  // ───────────────────────────────────────────────────────────
  // Internal helpers
  // ───────────────────────────────────────────────────────────

  /** Resolve a workspace's on-disk root, or an error response. */
  async resolveRoot(
    workspaceId: string,
  ): Promise<ServiceResponse<{ rootPath: string; projectId: string | null }>> {
    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace) return fail("Workspace not found");
    if (!workspace.rootPath) return fail("Workspace has no root path");
    return ok({
      rootPath: workspace.rootPath,
      projectId: workspace.projectId ?? null,
    });
  },

  /** Commit instructions, project-level first then app-level. */
  async getCommitInstructions(workspaceId: string): Promise<string | null> {
    const workspace = await workspaceRepo.findById(workspaceId);
    if (workspace?.projectId) {
      const project = await projectsRepo.findById(workspace.projectId);
      if (project?.commitInstructions) return project.commitInstructions;
    }
    const settings = await appSettingsRepo.findById(SETTINGS_ID);
    return settings?.commitInstructions || null;
  },

  /** PR instructions, project-level first then app-level. */
  async getPrInstructions(workspaceId: string): Promise<string | null> {
    const workspace = await workspaceRepo.findById(workspaceId);
    if (workspace?.projectId) {
      const project = await projectsRepo.findById(workspace.projectId);
      if (project?.prInstructions) return project.prInstructions;
    }
    const settings = await appSettingsRepo.findById(SETTINGS_ID);
    return settings?.prInstructions || null;
  },

  async stage(rootPath: string, mode: StageMode): Promise<void> {
    if (mode === "none") return;
    if (mode === "all") {
      await gitService.stageFiles(rootPath);
      return;
    }
    if (Array.isArray(mode) && mode.length > 0) {
      await gitService.stageFiles(rootPath, mode);
    }
  },

  /**
   * Throw if the workspace's `origin` remote has drifted from the project's
   * stored `remoteOrigin`. Must run BEFORE any push/PR so we never upload
   * commits to the wrong repository.
   */
  async assertRemoteMatches(
    workspaceId: string | null,
    rootPath: string,
  ): Promise<void> {
    if (!workspaceId) return;
    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace?.projectId) return;
    const project = await projectsRepo.findById(workspace.projectId);
    if (!project?.remoteOrigin) return;
    const remotesResult = await gitService.getRemotes(rootPath);
    if (!remotesResult.success || !remotesResult.data) return;
    const origin = remotesResult.data.find((r) => r.name === "origin");
    const currentRemote = origin?.fetchUrl || origin?.pushUrl;
    if (
      currentRemote &&
      normalizeGitUrl(currentRemote) !== normalizeGitUrl(project.remoteOrigin)
    ) {
      throw new Error(
        `Remote origin mismatch. Expected "${project.remoteOrigin}" but found "${currentRemote}". Aborting to prevent using the wrong repository.`,
      );
    }
  },

  /**
   * The branch a PR should target: the workspace's stored base branch
   * (`metadata.baseBranch`) first, then the project's default branch. Null when
   * unknown (let gh fall back to the repo default).
   */
  async resolveBaseBranch(workspaceId: string | null): Promise<string | null> {
    if (!workspaceId) return null;
    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace) return null;
    const fromMeta = readBaseBranchFromMetadata(workspace.metadata);
    if (fromMeta) return fromMeta;
    if (workspace.projectId) {
      const project = await projectsRepo.findById(workspace.projectId);
      if (project?.defaultBranch) return project.defaultBranch;
    }
    return null;
  },

  // ───────────────────────────────────────────────────────────
  // Shared building blocks (also used by the MCP tools)
  // ───────────────────────────────────────────────────────────

  /**
   * Stage (per `stage`) + commit + recapture the post-commit diff so the
   * Changes tab reflects a clean tree, clear accepted findings, and log the
   * activity. Shared by the UI flow and the CommitChanges MCP tool.
   */
  async performCommit(params: {
    workspaceId: string | null;
    rootPath: string;
    runId: string | null;
    message: string;
    stage: StageMode;
  }): Promise<{ hash: string; summary: string }> {
    const { workspaceId, rootPath, runId, message } = params;

    await this.stage(rootPath, params.stage);
    const result = await gitService.commit(rootPath, message);

    // Recapture diff from the new HEAD so the Changes tab reflects the
    // post-commit state (clean working tree).
    const headResult = await gitService.getHeadSha(rootPath);
    const newHead = headResult.success ? headResult.data : null;

    if (workspaceId && newHead) {
      const [statusResult, untrackedResult] = await Promise.all([
        gitService.getDiffSince(rootPath, newHead),
        gitService.getUntrackedFiles(rootPath),
      ]);
      const diffText = statusResult.success ? (statusResult.data ?? "") : "";
      const untrackedFiles = untrackedResult.success
        ? (untrackedResult.data ?? [])
        : [];

      await workspaceRepo.deleteDiffsByWorkspace(workspaceId);
      if (untrackedFiles.length > 0 || diffText) {
        await workspaceRepo.insertDiff({
          id: crypto.randomUUID(),
          workspaceId,
          runId: runId ?? undefined,
          baseRef: newHead,
          diffText,
          filesJson: JSON.stringify(untrackedFiles),
          statsJson: JSON.stringify({
            shortstat: "",
            files: untrackedFiles.length,
            newFiles: untrackedFiles.length,
          }),
        });
      }
    }

    if (runId && newHead) {
      runSessionRegistry.get(runId)?.updateBaseRef(newHead);
    }

    // Committed code is accepted — drop its review findings.
    if (workspaceId) {
      await workspaceRepo.deleteFindingsByWorkspace(workspaceId);
      emitFindingsChanged(workspaceId);
      logWorkspaceActivity({
        workspaceId,
        type: "commit",
        title: message.split("\n")[0],
        refId: newHead ?? undefined,
      });
    }

    return result;
  },

  /**
   * Verify the remote, run `gh pr create`, and log the activity. Shared by the
   * UI flow and the CreatePR MCP tool. Throws on failure (callers wrap).
   */
  async performCreatePR(params: {
    workspaceId: string | null;
    rootPath: string;
    title: string;
    body?: string;
    base?: string;
    draft?: boolean;
    labels?: string[];
  }): Promise<{ url: string; stdout: string; stderr?: string }> {
    const { workspaceId, rootPath } = params;

    // Never create a PR against a drifted remote.
    await this.assertRemoteMatches(workspaceId, rootPath);

    // Pass --head explicitly: in worktrees upstream tracking may be unset even
    // after push, so gh can't infer the head branch.
    const branchResult = await gitService.getCurrentBranch(rootPath);
    const currentBranch = branchResult.success ? branchResult.data : null;

    const ghArgs = ["pr", "create", "--title", params.title];
    if (currentBranch) ghArgs.push("--head", currentBranch);
    if (params.body) ghArgs.push("--body", params.body);
    // Only pass --base when it's a real, different branch — base == head is an
    // invalid PR; omitting it lets gh use the repo default.
    if (params.base && params.base !== currentBranch) {
      ghArgs.push("--base", params.base);
    }
    if (params.draft) ghArgs.push("--draft");
    for (const label of params.labels ?? []) ghArgs.push("--label", label);

    const { stdout, stderr } = await execFileAsync("gh", ghArgs, {
      cwd: rootPath,
      timeout: 30_000,
    });

    const output = stdout.trim();
    const prUrl = output.match(/https:\/\/github\.com\/[^\s]+/)?.[0];

    if (workspaceId) {
      logWorkspaceActivity({
        workspaceId,
        type: "pr",
        title: params.title,
        summary: params.body,
        refId: prUrl ?? undefined,
        metadata: {
          base: params.base,
          draft: params.draft,
          labels: params.labels,
        },
      });
    }

    return { url: prUrl ?? output, stdout: output, stderr: stderr?.trim() || undefined };
  },

  // ───────────────────────────────────────────────────────────
  // Headless generation (one-shot, no chat)
  // ───────────────────────────────────────────────────────────

  /**
   * Generate a commit message from the staged diff + commit instructions via a
   * single headless model call. Stages first (per `includeUnstaged`) unless a
   * `stagedDiff` is supplied by the caller.
   */
  async generateCommitMessage(params: {
    workspaceId: string;
    rootPath?: string;
    providerId: string;
    model?: string;
    includeUnstaged?: boolean;
    stagedDiff?: string;
  }): Promise<ServiceResponse<string>> {
    try {
      let rootPath = params.rootPath;
      if (!rootPath) {
        const root = await this.resolveRoot(params.workspaceId);
        if (!root.success) return root;
        rootPath = root.data.rootPath;
      }

      let diff = params.stagedDiff;
      if (diff === undefined) {
        await this.stage(
          rootPath,
          params.includeUnstaged === false ? "none" : "all",
        );
        const staged = await gitService.getStagedDiff(rootPath);
        if (!staged.success) return staged;
        diff = staged.data;
      }
      if (!diff.trim()) return fail("No staged changes to summarize");

      const provider = await providersRepo.findById(params.providerId);
      if (!provider) return fail("Provider not found");
      const { createWorkAdapter } = await import(
        "../providers/adapters/adapter.factory"
      );
      const adapter = createWorkAdapter(provider);
      if (!adapter.generateText) {
        return fail(
          `Provider "${provider.displayName}" does not support message generation`,
        );
      }

      const instructions = await this.getCommitInstructions(params.workspaceId);
      const system = [
        "You are a senior engineer writing a git commit message for a staged diff.",
        "Output ONLY the commit message — nothing else.",
        "Format: a concise summary line (imperative mood, <= 72 chars), then optionally a blank line and a short body.",
        "No surrounding quotes, no code fences, no preamble like 'Here is'.",
        instructions ? `\nProject commit instructions:\n${instructions}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const prompt = `Write a commit message for these staged changes:\n\n${diff.slice(0, MAX_DIFF_CHARS)}`;

      const text = await adapter.generateText(prompt, {
        system,
        model: params.model ?? provider.defaultModel ?? undefined,
      });
      const message = cleanGenerated(text);
      if (!message) return fail("Empty commit message generated");
      return ok(message);
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to generate message",
      );
    }
  },

  /**
   * Generate a PR title + body from the branch diff vs HEAD's base and the PR
   * instructions. First non-empty line becomes the title, the rest the body.
   */
  async generatePrBody(params: {
    workspaceId: string;
    providerId: string;
    model?: string;
  }): Promise<ServiceResponse<{ title: string; body: string }>> {
    try {
      const root = await this.resolveRoot(params.workspaceId);
      if (!root.success) return root;
      const rootPath = root.data.rootPath;

      // Prefer the branch diff vs its base — that's what the PR will actually
      // contain, and unlike the working-tree/staged diffs it's still populated
      // after the branch is committed and the tree is clean. Try the remote
      // base first (the PR target), then the local base. Fall back to the
      // working-tree + staged diff only when no base is known.
      const baseBranch = await this.resolveBaseBranch(params.workspaceId);
      let diff = "";
      let baseRef: string | null = null;
      if (baseBranch) {
        for (const ref of [`origin/${baseBranch}`, baseBranch]) {
          const r = await gitService.getBranchDiff(rootPath, ref);
          if (r.success && r.data.trim()) {
            diff = r.data;
            baseRef = ref;
            break;
          }
        }
      }
      if (!diff.trim()) {
        const stagedResult = await gitService.getStagedDiff(rootPath);
        const diffResult = await gitService.getDiff(rootPath);
        diff = [
          stagedResult.success ? stagedResult.data : "",
          diffResult.success ? diffResult.data : "",
        ]
          .filter(Boolean)
          .join("\n");
      }

      const provider = await providersRepo.findById(params.providerId);
      if (!provider) return fail("Provider not found");
      const { createWorkAdapter } = await import(
        "../providers/adapters/adapter.factory"
      );
      const adapter = createWorkAdapter(provider);
      if (!adapter.generateText) {
        return fail(
          `Provider "${provider.displayName}" does not support generation`,
        );
      }

      const instructions = await this.getPrInstructions(params.workspaceId);
      const system = [
        "You write GitHub pull request descriptions.",
        "Output the PR title on the FIRST line, then a blank line, then the PR body in Markdown.",
        "No code fences around the whole thing, no 'Title:' prefix.",
        instructions ? `\nProject PR instructions:\n${instructions}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      // Prefer commits unique to this branch (base..HEAD) when the base is
      // known, so the summary isn't polluted by the base branch's own history;
      // fall back to recent repo commits only when there's no base ref.
      let commits = "";
      if (baseRef) {
        const branchLog = await gitService.getBranchLog(rootPath, baseRef, 20);
        if (branchLog.success) {
          commits = branchLog.data.map((m) => `- ${m}`).join("\n");
        }
      } else {
        const logResult = await gitService.getLog(rootPath, 20);
        if (logResult.success) {
          commits = logResult.data.map((c) => `- ${c.message}`).join("\n");
        }
      }

      const prompt = [
        "Write a pull request title and body for this branch.",
        commits ? `\nRecent commits:\n${commits}` : "",
        diff ? `\nDiff:\n${diff.slice(0, MAX_DIFF_CHARS)}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const text = cleanGenerated(
        await adapter.generateText(prompt, {
          system,
          model: params.model ?? provider.defaultModel ?? undefined,
        }),
      );

      const lines = text.split("\n");
      const titleIdx = lines.findIndex((l) => l.trim().length > 0);
      if (titleIdx === -1) return fail("Empty PR description generated");
      const title = lines[titleIdx].trim().replace(/^#+\s*/, "");
      const body = lines
        .slice(titleIdx + 1)
        .join("\n")
        .trim();
      return ok({ title, body });
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to generate PR description",
      );
    }
  },

  // ───────────────────────────────────────────────────────────
  // UI-facing deterministic operations
  // ───────────────────────────────────────────────────────────

  /** Live status for the commit panel header + button enablement. */
  async getStatus(
    workspaceId: string,
  ): Promise<ServiceResponse<GitFlowStatus>> {
    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace) return fail("Workspace not found");
    if (!workspace.rootPath) return fail("Workspace has no root path");
    const rootPath = workspace.rootPath;

    const [branchResult, statusResult, headResult, remotesResult] =
      await Promise.all([
        gitService.getCurrentBranch(rootPath),
        gitService.getStatus(rootPath),
        gitService.getHeadSha(rootPath),
        gitService.getRemotes(rootPath),
      ]);

    if (!statusResult.success) return statusResult;
    const status = statusResult.data;
    const hasRemote =
      remotesResult.success &&
      (remotesResult.data ?? []).some((r) => r.name === "origin");
    const branch = branchResult.success
      ? branchResult.data
      : status.current ?? "";

    // Worktree workspaces store their working branch in defaultBranch for
    // historical reasons; metadata.baseBranch is the PR base/default branch.
    let defaultBranch = readBaseBranchFromMetadata(workspace.metadata);
    if (!defaultBranch && workspace.projectId) {
      const project = await projectsRepo.findById(workspace.projectId);
      defaultBranch = project?.defaultBranch ?? null;
    }
    defaultBranch ??= workspace.defaultBranch ?? null;
    const isDefaultBranch = defaultBranch
      ? branch === defaultBranch
      : branch === "main" || branch === "master";

    // Use the exact same computation the sidebar / Changes tab rely on
    // (buildDiffSnapshot), anchored to the current HEAD like resyncDiff — so
    // the panel's +/- matches the workspace item. Crucially this counts every
    // line of each untracked file as an insertion, which a plain `git diff
    // HEAD` omits.
    let additions = 0;
    let deletions = 0;
    let changedFiles = 0;
    if (headResult.success && headResult.data) {
      const snapshot = await buildDiffSnapshot({
        rootPath,
        baseRef: headResult.data,
      });
      if (snapshot) {
        changedFiles = snapshot.files.length;
        const parsed = parseShortstat(snapshot.shortstat);
        additions = parsed.additions;
        deletions = parsed.deletions;
      }
    }

    return ok({
      branch,
      ahead: status.ahead,
      behind: status.behind,
      hasUpstream: !!status.tracking,
      hasRemote,
      additions,
      deletions,
      changedFiles,
      isDefaultBranch,
    });
  },

  /**
   * Stage + (optionally generate) + commit, optionally pushing afterwards.
   * The deterministic replacement for the chat-driven "Commit changes" goal.
   */
  async commit(params: {
    workspaceId: string;
    message?: string;
    includeUnstaged?: boolean;
    providerId?: string;
    model?: string;
    push?: boolean;
  }): Promise<ServiceResponse<CommitResult>> {
    try {
      const root = await this.resolveRoot(params.workspaceId);
      if (!root.success) return root;
      const rootPath = root.data.rootPath;

      const stageMode: StageMode =
        params.includeUnstaged === false ? "none" : "all";
      await this.stage(rootPath, stageMode);

      const staged = await gitService.getStagedDiff(rootPath);
      if (!staged.success) return staged;
      if (!staged.data.trim()) return fail("No staged changes to commit");

      let message = params.message?.trim() || "";
      if (!message) {
        if (!params.providerId) {
          return fail("Provide a commit message or a provider to generate one");
        }
        const gen = await this.generateCommitMessage({
          workspaceId: params.workspaceId,
          rootPath,
          providerId: params.providerId,
          model: params.model,
          stagedDiff: staged.data,
        });
        if (!gen.success) return gen;
        message = gen.data;
      }

      const result = await this.performCommit({
        workspaceId: params.workspaceId,
        rootPath,
        runId: null,
        message,
        stage: "none", // already staged above
      });

      let pushed = false;
      if (params.push) {
        const pushResult = await gitService.push(rootPath);
        if (!pushResult.success) return pushResult;
        pushed = true;
      }

      return ok({ ...result, pushed });
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to commit",
      );
    }
  },

  /** Push the current branch (used by the standalone Push action). */
  async push(workspaceId: string): Promise<ServiceResponse<CommitResult>> {
    const root = await this.resolveRoot(workspaceId);
    if (!root.success) return root;
    const pushResult = await gitService.push(root.data.rootPath);
    if (!pushResult.success) return pushResult;
    return ok({ hash: "", summary: "Pushed", pushed: true });
  },

  // ───────────────────────────────────────────────────────────
  // Publish (create the GitHub repo for a repo with no remote)
  // ───────────────────────────────────────────────────────────

  /**
   * Preflight for the Publish wizard: is `gh` installed + authenticated, what's
   * the authed login (default owner), a sanitized default repo name, and the
   * branch we'd publish. Never throws — surfaces readiness via `ghReady`.
   */
  async getPublishPreflight(
    workspaceId: string,
  ): Promise<ServiceResponse<PublishPreflight>> {
    const root = await this.resolveRoot(workspaceId);
    if (!root.success) return root;
    const { rootPath, projectId } = root.data;

    const [branchResult, remotesResult] = await Promise.all([
      gitService.getCurrentBranch(rootPath),
      gitService.getRemotes(rootPath),
    ]);
    const branch = branchResult.success ? branchResult.data : "main";
    const hasRemote =
      remotesResult.success &&
      (remotesResult.data ?? []).some((r) => r.name === "origin");

    // Default repo name from the project, then the workspace, then the folder.
    let name = "";
    const workspace = await workspaceRepo.findById(workspaceId);
    if (projectId) {
      const project = await projectsRepo.findById(projectId);
      name = project?.name || "";
    }
    if (!name) name = workspace?.name || basename(rootPath);
    const suggestedName = sanitizeRepoName(name);

    // `gh api user` succeeds only when gh is installed AND authenticated.
    let ghReady = false;
    let login: string | null = null;
    let notReadyReason: string | undefined;
    try {
      const { stdout } = await execFileAsync(
        "gh",
        ["api", "user", "--jq", ".login"],
        { timeout: 15_000 },
      );
      login = stdout.trim() || null;
      ghReady = !!login;
      if (!ghReady) notReadyReason = "Could not read your GitHub login.";
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        notReadyReason =
          "The GitHub CLI (gh) isn't installed. Install it, then run `gh auth login`.";
      } else {
        notReadyReason =
          "You're not signed in to the GitHub CLI. Run `gh auth login` in your terminal.";
      }
    }

    return ok({
      ghReady,
      login,
      suggestedName,
      branch,
      hasRemote,
      notReadyReason,
    });
  },

  /**
   * Publish a local repo to GitHub: create the remote repo with `gh`, wire up
   * the `origin` remote using the chosen protocol, push the current branch, and
   * record the origin on the project so subsequent push/PR checks pass.
   */
  async publish(params: {
    workspaceId: string;
    /** "owner/name" — owner is a GitHub user or org the account can create in. */
    ownerRepo: string;
    visibility: "private" | "public";
    remoteName?: string;
    protocol: "ssh" | "https";
  }): Promise<ServiceResponse<PublishResult>> {
    try {
      const root = await this.resolveRoot(params.workspaceId);
      if (!root.success) return root;
      const { rootPath, projectId } = root.data;
      const remoteName = params.remoteName?.trim() || "origin";

      const [owner, rawName] = params.ownerRepo.split("/").map((s) => s.trim());
      const name = sanitizeRepoName(rawName || "");
      if (!owner || !name) {
        return fail("Enter a repository as owner/name (e.g. octocat/my-repo).");
      }

      // Don't clobber an existing remote of the same name.
      const remotesResult = await gitService.getRemotes(rootPath);
      if (
        remotesResult.success &&
        (remotesResult.data ?? []).some((r) => r.name === remoteName)
      ) {
        return fail(`A remote named "${remoteName}" already exists.`);
      }

      // Create the empty repo on GitHub (no --source/--push: we wire the remote
      // ourselves so the SSH/HTTPS choice is honored).
      const ghArgs = [
        "repo",
        "create",
        `${owner}/${name}`,
        params.visibility === "private" ? "--private" : "--public",
      ];
      let htmlUrl = `https://github.com/${owner}/${name}`;
      try {
        const { stdout } = await execFileAsync("gh", ghArgs, {
          cwd: rootPath,
          timeout: 30_000,
        });
        htmlUrl = stdout.match(/https:\/\/github\.com\/[^\s]+/)?.[0] ?? htmlUrl;
      } catch (error) {
        const stderr = (error as any)?.stderr?.trim?.();
        return fail(stderr || "Failed to create the GitHub repository.");
      }

      // Wire the remote with the chosen protocol, then push + set upstream.
      const remoteUrl =
        params.protocol === "ssh"
          ? `git@github.com:${owner}/${name}.git`
          : `https://github.com/${owner}/${name}.git`;

      const branchResult = await gitService.getCurrentBranch(rootPath);
      const branch = branchResult.success ? branchResult.data : "main";

      const added = await gitService.addRemote(rootPath, remoteName, remoteUrl);
      if (!added.success) return added;

      const pushResult = await gitService.push(rootPath, {
        setUpstream: true,
        remote: remoteName,
        branch,
      });
      if (!pushResult.success) return pushResult;

      // Record the origin + default branch on the project so assertRemoteMatches
      // and future push/PR flows treat this as a normal remote-backed repo.
      if (projectId) {
        await projectsRepo.update(projectId, {
          remoteOrigin: htmlUrl,
          defaultBranch: branch,
        });
      }

      return ok({ url: htmlUrl, branch, owner, repo: name });
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : "Failed to publish repository",
      );
    }
  },

  /**
   * Push (idempotent) then create a PR with `gh`, generating title/body when
   * not supplied. Deterministic replacement for the "Create a PR" chat goal.
   */
  async createPr(params: {
    workspaceId: string;
    title?: string;
    body?: string;
    base?: string;
    draft?: boolean;
    providerId?: string;
    model?: string;
  }): Promise<ServiceResponse<{ url: string }>> {
    try {
      const root = await this.resolveRoot(params.workspaceId);
      if (!root.success) return root;
      const rootPath = root.data.rootPath;

      let title = params.title?.trim() || "";
      let body = params.body ?? "";
      if (!title) {
        if (!params.providerId) {
          return fail("Provide a PR title or a provider to generate one");
        }
        const gen = await this.generatePrBody({
          workspaceId: params.workspaceId,
          providerId: params.providerId,
          model: params.model,
        });
        if (!gen.success) return gen;
        title = gen.data.title;
        if (!body) body = gen.data.body;
      }

      // Verify the remote BEFORE pushing — otherwise a drifted origin would
      // upload commits to the wrong repo before performCreatePR's check aborts.
      await this.assertRemoteMatches(params.workspaceId, rootPath);

      // Resolve the PR base: explicit > workspace base branch > project default.
      const base =
        params.base?.trim() ||
        (await this.resolveBaseBranch(params.workspaceId)) ||
        undefined;

      // Branch must exist on the remote before `gh pr create`.
      const pushResult = await gitService.push(rootPath);
      if (!pushResult.success) return pushResult;

      const result = await this.performCreatePR({
        workspaceId: params.workspaceId,
        rootPath,
        title,
        body,
        base,
        draft: params.draft,
      });
      return ok({ url: result.url });
    } catch (error) {
      const stderr = (error as any)?.stderr?.trim?.();
      return fail(
        stderr ||
          (error instanceof Error ? error.message : "Failed to create PR"),
      );
    }
  },
};
