import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import { emit } from "../../ipc-kit";
import { workspaceRepo } from "./workspace.repo";
import { projectsRepo } from "../projects/projects.repo";
import { normalizeRemoteOrigin } from "../projects/projects.utils";
import { gitService } from "../git";
import { appSettingsService } from "../appSettings/appSettings.service";
import type { CreateProjectPayload, ProjectResponse } from "../projects/projects.dto";
import type {
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  WorkspaceMetadata,
  WorkspaceIntakePayload,
  WorkspaceResponse,
  WorkspaceStatus,
  ScriptCompleteEvent,
  ActivityResponse,
  CreateActivityPayload,
  WorkspaceDiffResponse,
  WorkspaceDiffSummaryResponse,
  CreateDiffPayload,
  ReviewResponse,
  CreateReviewPayload,
  UpdateReviewPayload,
  ReviewFindingResponse,
  CreateReviewFindingPayload,
  UpdateReviewFindingPayload,
} from "./workspace.dto";

// ─────────────────────────────────────────────────────────────
// Script execution helpers (used by workspace lifecycle hooks)
// ─────────────────────────────────────────────────────────────
function validateScriptCwd(cwd: string): void {
  const resolved = path.resolve(cwd);
  if (!existsSync(resolved)) {
    throw new Error(`Script cwd does not exist: ${resolved}`);
  }
}

function executeScript(
  script: string,
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  validateScriptCwd(cwd);

  const shell = process.platform === "win32" ? "cmd" : "/bin/sh";
  const shellArgs =
    process.platform === "win32" ? ["/c", script] : ["-c", script];

  return new Promise((resolve, reject) => {
    execFile(
      shell,
      shellArgs,
      { cwd, timeout: 300_000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          console.error(
            `[WorkspaceService] Script failed in ${cwd}:`,
            error.message,
          );
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

function emitScriptComplete(event: ScriptCompleteEvent): void {
  emit(CHANNELS.workspace.scriptComplete, event);
}

// ─────────────────────────────────────────────────────────────
// Cross-module writer surface
// ─────────────────────────────────────────────────────────────

/**
 * Fire-and-forget activity logger for cross-module writers (drivers,
 * run-session, guards, mains-tools). Never blocks or throws.
 */
export function logWorkspaceActivity(payload: CreateActivityPayload): void {
  workspaceRepo.insertActivity(payload).catch((err) => {
    console.error("[WorkspaceService] logWorkspaceActivity failed:", err);
  });
}

/**
 * Notifies renderers that findings have changed for a workspace so RTK Query
 * caches (ReviewFindings, WorkspaceActivity) can invalidate. Safe to call from
 * any main-process context that mutates findings outside the IPC mutation path.
 */
export function emitFindingsChanged(workspaceId: string | undefined): void {
  if (!workspaceId) return;
  emit(CHANNELS.workspace.findingsChanged, { workspaceId });
}

// ─────────────────────────────────────────────────────────────
// Workspace intake helpers
//
// Shared internals of `workspaceService.createFromSource`. See CONTEXT.md
// "Workspace intake". Kept against `gitService` / `projectsRepo` (not
// `projectsService`) so the workspace → projects edge stays acyclic —
// projects.service imports the workspace barrel.
// ─────────────────────────────────────────────────────────────

/** Last path segment, e.g. `/a/b/my-repo` → `my-repo`. */
function basename(p: string): string {
  return p.split("/").pop() || "Untitled";
}

/** Honor the global worktree preference (defaults on). */
async function preferWorktrees(): Promise<boolean> {
  const settings = await appSettingsService.ensureSettings();
  return settings.enableWorktrees ?? true;
}

/** Read the `origin` fetch URL of a repo, or null when there's no remote. */
async function readOriginUrl(rootPath: string): Promise<string | null> {
  try {
    const remotes = await gitService.getRemotes(rootPath);
    return remotes.find((r) => r.name === "origin")?.fetchUrl ?? null;
  } catch {
    return null;
  }
}

/** Read the checked-out branch of a repo, falling back to `main`. */
async function readCurrentBranch(rootPath: string): Promise<string> {
  try {
    return (await gitService.getCurrentBranch(rootPath)) || "main";
  } catch {
    return "main";
  }
}

/** A project's worktree dir is the parent of its first worktree. */
function deriveWorkspacesPath(worktreePath: string): string {
  return worktreePath.substring(0, worktreePath.lastIndexOf("/"));
}

/**
 * Find-or-create a project, deduped by normalized remote origin (or by
 * rootPath when origin-less). Mirrors `projectsService.findOrCreate`, kept
 * here against `projectsRepo` to avoid a workspace ↔ projects service cycle.
 */
async function findOrCreateProject(
  payload: CreateProjectPayload,
): Promise<ProjectResponse> {
  const normalized = payload.remoteOrigin
    ? normalizeRemoteOrigin(payload.remoteOrigin)
    : null;

  const existing = normalized
    ? await projectsRepo.findByRemoteOrigin(payload.accountId, normalized)
    : await projectsRepo.findByAccountAndRootPath(
        payload.accountId,
        payload.rootPath,
      );
  if (existing) return existing;

  const id = randomUUID();
  await projectsRepo.insert({ ...payload, id, remoteOrigin: normalized });
  const project = await projectsRepo.findById(id);
  if (!project) throw new Error("Failed to retrieve created project");
  return project;
}

interface MetadataParts {
  tracking: string | null;
  ahead: number;
  behind: number;
  baseBranch: string;
  branchName: string;
  originUrl: string | null;
  worktree: { name: string; path: string; sourcePath: string } | null;
}

/** Assemble the `WorkspaceMetadata` blob stored on the workspace row. */
function buildMetadata(parts: MetadataParts): WorkspaceMetadata {
  return {
    isGitRepo: true,
    tracking: parts.tracking,
    ahead: parts.ahead,
    behind: parts.behind,
    worktree: parts.worktree
      ? {
          enabled: true,
          name: parts.worktree.name,
          path: parts.worktree.path,
          sourcePath: parts.worktree.sourcePath,
          branch: parts.branchName,
        }
      : { enabled: false },
    origin: parts.originUrl ? { url: parts.originUrl } : undefined,
    baseBranch: parts.baseBranch,
  };
}

// ─────────────────────────────────────────────────────────────
// Workspace aggregate service
//
// Throw-style: methods return plain values and throw on failure; the
// ServiceResponse envelope is applied by handle() at the IPC seam.
// Single-item reads return null for absence; mutations on a missing
// target throw (see CONTEXT.md "absence rule").
// ─────────────────────────────────────────────────────────────
export const workspaceService = {
  // ─────────────────────────────────────────────────────────────
  // ── Workspace lifecycle ──
  // ─────────────────────────────────────────────────────────────

  async list(): Promise<WorkspaceResponse[]> {
    return workspaceRepo.findAll();
  },

  async get(id: string): Promise<WorkspaceResponse | null> {
    return workspaceRepo.findById(id);
  },

  async listByAccount(accountId: string): Promise<WorkspaceResponse[]> {
    return workspaceRepo.findByAccountId(accountId);
  },

  async getByRootPath(
    accountId: string,
    rootPath: string,
  ): Promise<WorkspaceResponse | null> {
    return workspaceRepo.findByRootPath(accountId, rootPath);
  },

  async create(
    payload: CreateWorkspacePayload,
  ): Promise<WorkspaceResponse> {
    const existing = await workspaceRepo.findByRootPath(
      payload.accountId,
      payload.rootPath,
    );
    if (existing) {
      throw new Error("Workspace with this path already exists");
    }

    const workspacePayload = {
      ...payload,
      id: payload.id || randomUUID(),
    };

    const id = await workspaceRepo.insert(workspacePayload);
    const workspace = await workspaceRepo.findById(id);
    if (!workspace) throw new Error("Failed to retrieve created workspace");

    // Fire-and-forget: run project setupScript in background
    if (workspace.projectId) {
      const wsId = id;
      const rootPath = workspace.rootPath;
      projectsRepo
        .findById(workspace.projectId)
        .then((project) => {
          if (!project?.setupScript) return;
          console.log(
            `[WorkspaceService] Running setup script for workspace ${wsId} in ${rootPath}`,
          );
          executeScript(project.setupScript, rootPath)
            .then(() => {
              console.log(
                `[WorkspaceService] Setup script completed for workspace ${wsId}`,
              );
              emitScriptComplete({
                workspaceId: wsId,
                script: "setup",
                success: true,
              });
            })
            .catch((err) => {
              console.error(
                `[WorkspaceService] Setup script failed for workspace ${wsId}:`,
                err,
              );
              emitScriptComplete({
                workspaceId: wsId,
                script: "setup",
                success: false,
                error: err?.message,
              });
            });
        })
        .catch(() => {});
    }

    return workspace;
  },

  /**
   * Turn a git repo into a project + workspace pair. The four sources
   * (picked `folder`, `clone` of a URL, fresh `init`, additional `worktree`
   * for an existing project) each yield a local repo path; the shared tail
   * imports it (worktree or direct), finds-or-creates the project, and
   * creates the workspace. The worktree-vs-direct ordering difference lives
   * here, not at call sites. See CONTEXT.md "Workspace intake".
   */
  async createFromSource(
    payload: WorkspaceIntakePayload,
  ): Promise<WorkspaceResponse> {
    const { accountId, source } = payload;

    // ── init: brand-new empty repo. Always direct, no remote. ──
    if (source.kind === "init") {
      const init = await gitService.initRepo(source.name);
      const project = await findOrCreateProject({
        accountId,
        name: source.name,
        rootPath: init.rootPath,
        defaultBranch: "main",
        branches: ["main"],
      });
      return this.create({
        accountId,
        name: source.name,
        rootPath: init.rootPath,
        defaultBranch: "main",
        metadata: buildMetadata({
          tracking: null,
          ahead: 0,
          behind: 0,
          baseBranch: "main",
          branchName: "main",
          originUrl: null,
          worktree: null,
        }),
        projectId: project.id,
      });
    }

    // ── worktree: an additional worktree workspace for an existing project.
    // The project already exists, so find-or-create is a lookup. ──
    if (source.kind === "worktree") {
      const project = await projectsRepo.findById(source.projectId);
      if (!project) throw new Error("Project not found");

      const imported = await gitService.importLocalRepo(
        project.rootPath,
        project.name,
      );
      if (!project.workspacesPath) {
        await projectsRepo.update(project.id, {
          workspacesPath: deriveWorkspacesPath(imported.worktreePath),
        });
      }
      return this.create({
        accountId,
        name: project.name,
        rootPath: imported.worktreePath,
        repoUrl: imported.originUrl ?? project.remoteOrigin ?? undefined,
        defaultBranch: imported.branchName,
        metadata: buildMetadata({
          tracking: imported.tracking,
          ahead: imported.ahead,
          behind: imported.behind,
          baseBranch: imported.baseBranch,
          branchName: imported.branchName,
          originUrl: imported.originUrl ?? project.remoteOrigin ?? null,
          worktree: {
            name: imported.worktreeName,
            path: imported.worktreePath,
            sourcePath: project.rootPath,
          },
        }),
        projectId: project.id,
      });
    }

    // ── folder / clone: obtain a local repo path, then import it. ──
    const sourcePath =
      source.kind === "clone"
        ? (await gitService.cloneRepo(source.url, source.targetPath))
            .clonedPath
        : source.path;
    const name = basename(sourcePath);

    if (await preferWorktrees()) {
      // Worktree lands under worktrees/{projectName}, so the project must
      // exist before the import — source origin/baseBranch up front.
      const originUrl = await readOriginUrl(sourcePath);
      const baseBranch = await readCurrentBranch(sourcePath);
      const project = await findOrCreateProject({
        accountId,
        name,
        rootPath: sourcePath,
        remoteOrigin: originUrl ?? undefined,
        defaultBranch: baseBranch,
      });
      const imported = await gitService.importLocalRepo(
        sourcePath,
        project.name,
      );
      if (!project.workspacesPath) {
        await projectsRepo.update(project.id, {
          workspacesPath: deriveWorkspacesPath(imported.worktreePath),
        });
      }
      return this.create({
        accountId,
        name,
        rootPath: imported.worktreePath,
        repoUrl: originUrl ?? undefined,
        defaultBranch: imported.branchName,
        metadata: buildMetadata({
          tracking: imported.tracking,
          ahead: imported.ahead,
          behind: imported.behind,
          baseBranch,
          branchName: imported.branchName,
          originUrl,
          worktree: {
            name: imported.worktreeName,
            path: imported.worktreePath,
            sourcePath,
          },
        }),
        projectId: project.id,
      });
    }

    // Direct: import in place, then create the project from the result.
    const imported = await gitService.importLocalRepoDirect(sourcePath);
    const project = await findOrCreateProject({
      accountId,
      name,
      rootPath: sourcePath,
      remoteOrigin: imported.originUrl ?? undefined,
      branches: [imported.branchName],
      defaultBranch: imported.baseBranch,
    });
    return this.create({
      accountId,
      name,
      rootPath: sourcePath,
      repoUrl: imported.originUrl ?? undefined,
      defaultBranch: imported.branchName,
      metadata: buildMetadata({
        tracking: imported.tracking,
        ahead: imported.ahead,
        behind: imported.behind,
        baseBranch: imported.baseBranch,
        branchName: imported.branchName,
        originUrl: imported.originUrl,
        worktree: null,
      }),
        projectId: project.id,
      });
  },

  async update(
    id: string,
    payload: UpdateWorkspacePayload,
  ): Promise<WorkspaceResponse> {
    const updated = await workspaceRepo.update(id, payload);
    if (!updated) throw new Error("Workspace not found");
    return updated;
  },

  async delete(id: string): Promise<void> {
    await workspaceRepo.delete(id);
  },

  async updateStatus(
    id: string,
    status: WorkspaceStatus,
  ): Promise<WorkspaceResponse> {
    return this.update(id, { status });
  },

  async archive(id: string): Promise<WorkspaceResponse> {
    const workspace = await workspaceRepo.findById(id);
    if (!workspace) throw new Error("Workspace not found");

    const archived = await workspaceRepo.archive(id);
    if (!archived) throw new Error("Failed to archive workspace");

    // Fire-and-forget: run project archiveScript in background
    if (workspace.projectId) {
    const wsId = id;
    const rootPath = workspace.rootPath;
    projectsRepo
      .findById(workspace.projectId)
      .then((project) => {
        if (!project?.archiveScript) return;
        console.log(
          `[WorkspaceService] Running archive script for workspace ${wsId} in ${rootPath}`,
        );
        executeScript(project.archiveScript, rootPath)
          .then(() => {
            console.log(
              `[WorkspaceService] Archive script completed for workspace ${wsId}`,
            );
            emitScriptComplete({
              workspaceId: wsId,
              script: "archive",
              success: true,
            });
          })
          .catch((err) => {
            console.error(
              `[WorkspaceService] Archive script failed for workspace ${wsId}:`,
              err,
            );
            emitScriptComplete({
              workspaceId: wsId,
              script: "archive",
              success: false,
              error: err?.message,
            });
          });
      })
      .catch(() => {});
    }

    return archived;
  },

  // ─────────────────────────────────────────────────────────────
  // ── Git operations ──
  // Throw-style: these return plain values and throw on failure; the envelope
  // is applied by `handle()` at the IPC seam. See CONTEXT.md "Workspace git
  // operations".
  // ─────────────────────────────────────────────────────────────

  /**
   * Rename the workspace's branch — against the worktree's source repo when
   * applicable — then update `defaultBranch` + `metadata.worktree.branch` in
   * the same operation.
   */
  async renameBranch(
    workspaceId: string,
    newBranchName: string,
  ): Promise<WorkspaceResponse> {
    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    const oldBranch = workspace.defaultBranch;
    if (!oldBranch || !workspace.rootPath) {
    throw new Error("Workspace has no branch to rename");
    }

    // A worktree's branch is owned by its source repo, not the checkout.
    const worktree = workspace.metadata?.worktree;
    const gitPath =
    worktree?.enabled && worktree.sourcePath
      ? worktree.sourcePath
      : workspace.rootPath;
    await gitService.renameBranch(gitPath, oldBranch, newBranchName);

    const metadata: WorkspaceMetadata = workspace.metadata
    ? { ...workspace.metadata }
    : {};
    if (metadata.worktree?.enabled) {
    metadata.worktree = { ...metadata.worktree, branch: newBranchName };
    }
    const updated = await workspaceRepo.update(workspaceId, {
    defaultBranch: newBranchName,
    metadata,
    });
    if (!updated) throw new Error("Workspace not found");
    return updated;
  },

  /**
   * Discard the workspace's pending changes: hard-reset the working tree to
   * the recorded diff's baseRef and drop the latest diff row.
   */
  async discardChanges(workspaceId: string): Promise<void> {
    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    const latest = await workspaceRepo.findLatestDiffByWorkspace(workspaceId);
    if (!latest?.baseRef) throw new Error("No recorded diff to discard");
    await gitService.resetHard(workspace.rootPath, latest.baseRef);
    await workspaceRepo.deleteLatestDiffByWorkspace(workspaceId);
  },

  // ─────────────────────────────────────────────────────────────
  // ── Activity ──
  // ─────────────────────────────────────────────────────────────

  async listActivity(
    workspaceId: string,
    limit?: number,
  ): Promise<ActivityResponse[]> {
    return workspaceRepo.findActivityByWorkspace(workspaceId, limit);
  },

  async createActivity(payload: CreateActivityPayload): Promise<string> {
    return workspaceRepo.insertActivity(payload);
  },

  async createManyActivity(
    payloads: CreateActivityPayload[],
  ): Promise<string[]> {
    return workspaceRepo.insertManyActivity(payloads);
  },

  async deleteActivity(id: string): Promise<void> {
    await workspaceRepo.deleteActivity(id);
  },

  // ─────────────────────────────────────────────────────────────
  // ── Diffs ──
  // ─────────────────────────────────────────────────────────────

  async listDiffs(
    workspaceId: string,
    limit?: number,
  ): Promise<WorkspaceDiffResponse[]> {
    return workspaceRepo.findDiffsByWorkspace(workspaceId, limit);
  },

  async getLatestDiff(
    workspaceId: string,
  ): Promise<WorkspaceDiffResponse | null> {
    return workspaceRepo.findLatestDiffByWorkspace(workspaceId);
  },

  async getLatestDiffSummary(
    workspaceId: string,
  ): Promise<WorkspaceDiffSummaryResponse | null> {
    return workspaceRepo.findLatestDiffSummaryByWorkspace(workspaceId);
  },

  async getDiffByRun(runId: string): Promise<WorkspaceDiffResponse | null> {
    return workspaceRepo.findDiffByRun(runId);
  },

  async deleteLatestDiff(workspaceId: string): Promise<void> {
    await workspaceRepo.deleteLatestDiffByWorkspace(workspaceId);
  },

  async createDiff(payload: CreateDiffPayload): Promise<string> {
    return workspaceRepo.insertDiff(payload);
  },

  /**
   * Re-snapshot the workspace's working tree against its baseRef (or HEAD if
   * none has been captured yet) and reconcile the latest diff row:
   *   - clean tree → delete the latest row
   *   - dirty tree → update the latest row (or insert if none exists)
   *
   * Mirrors the snapshot logic in run-session.ts so the user can manually
   * pick up external git activity (commits made in another IDE, branch
   * switches) without starting a new run.
   *
   * Returns the resulting diff summary (or null when the tree is clean).
   */
  async resyncDiff(
    workspaceId: string,
  ): Promise<WorkspaceDiffSummaryResponse | null> {
    const workspace = await workspaceRepo.findById(workspaceId);
    if (!workspace) throw new Error("Workspace not found");

    const existing = await workspaceRepo.findLatestDiffByWorkspace(workspaceId);

    // Re-anchor to the current HEAD rather than the stored baseRef (captured
    // at run start). Otherwise work committed externally — e.g. via the CLI —
    // stays in the `baseRef..workingTree` range and keeps showing up even
    // though the tree is clean. This mirrors the in-process commit tool, which
    // advances baseRef to the post-commit HEAD (see mains-tools.core.ts).
    const head = await gitService
      .getHeadSha(workspace.rootPath)
      .catch(() => null);
    const baseRef = head ?? existing?.baseRef ?? null;

    // No baseRef means it's not a git repo (or git failed). Drop any stale
    // row defensively, then bail.
    if (!baseRef) {
      if (existing) {
        await workspaceRepo.deleteLatestDiffByWorkspace(workspaceId);
      }
      return null;
    }

    const snapshot = await gitService.captureDiffSnapshot(
      workspace.rootPath,
      baseRef,
    );

    if (snapshot.files.length === 0) {
      if (existing) {
        await workspaceRepo.deleteLatestDiffByWorkspace(workspaceId);
      }
      return null;
    }

    const filesJson = JSON.stringify(snapshot.files);
    const statsJson = JSON.stringify({
      shortstat: snapshot.shortstat,
      files: snapshot.files.length,
      newFiles: snapshot.untrackedFiles.length,
    });

    if (existing) {
      await workspaceRepo.updateDiff(existing.id, {
        diffText: snapshot.diffText,
        filesJson,
        statsJson,
        baseRef: snapshot.baseRef,
      });
    } else {
      await workspaceRepo.insertDiff({
        id: randomUUID(),
        workspaceId,
        baseRef: snapshot.baseRef,
        diffText: snapshot.diffText,
        filesJson,
        statsJson,
      });
    }

    return workspaceRepo.findLatestDiffSummaryByWorkspace(workspaceId);
  },

  // ─────────────────────────────────────────────────────────────
  // ── Reviews ──
  // ─────────────────────────────────────────────────────────────

  async listReviews(
    workspaceId: string,
    limit?: number,
  ): Promise<ReviewResponse[]> {
    return workspaceRepo.findReviewsByWorkspace(workspaceId, limit);
  },

  async getReview(id: string): Promise<ReviewResponse | null> {
    return workspaceRepo.findReviewById(id);
  },

  async createReview(payload: CreateReviewPayload): Promise<string> {
    return workspaceRepo.insertReview(payload);
  },

  async updateReview(
    id: string,
    payload: UpdateReviewPayload,
  ): Promise<ReviewResponse> {
    const updated = await workspaceRepo.updateReview(id, payload);
    if (!updated) throw new Error("Review not found");
    return updated;
  },

  async deleteReview(id: string): Promise<void> {
    await workspaceRepo.deleteReview(id);
  },

  // ─────────────────────────────────────────────────────────────
  // ── Findings ──
  // ─────────────────────────────────────────────────────────────

  async listFindings(
    reviewId: string,
    limit?: number,
  ): Promise<ReviewFindingResponse[]> {
    return workspaceRepo.findFindingsByReview(reviewId, limit);
  },

  /**
   * Returns findings for a workspace, deduped per file to only the most
   * recent review's findings. Filtering happens in JS for simplicity; revisit
   * if data volume grows.
   */
  async listFindingsByWorkspace(
    workspaceId: string,
  ): Promise<ReviewFindingResponse[]> {
    const allFindings =
    await workspaceRepo.findFindingsByWorkspace(workspaceId);

    const latestReviewByFile = new Map<string, string>();
    const latestTimeByFile = new Map<string, number>();

    for (const f of allFindings) {
      const ts =
        (f.reviewCreatedAt as unknown) instanceof Date
          ? f.reviewCreatedAt.getTime()
          : Number(f.reviewCreatedAt) * 1000;
      const existing = latestTimeByFile.get(f.file);
      if (existing === undefined || ts > existing) {
        latestTimeByFile.set(f.file, ts);
        latestReviewByFile.set(f.file, f.reviewId);
      }
    }

    return allFindings
      .filter((f) => latestReviewByFile.get(f.file) === f.reviewId)
      .map(({ reviewCreatedAt: _omit, ...rest }) => rest);
  },

  async getFinding(id: string): Promise<ReviewFindingResponse | null> {
    return workspaceRepo.findFindingById(id);
  },

  async createFinding(payload: CreateReviewFindingPayload): Promise<string> {
    return workspaceRepo.insertFinding(payload);
  },

  async createManyFindings(
    payloads: CreateReviewFindingPayload[],
  ): Promise<string[]> {
    return workspaceRepo.insertManyFindings(payloads);
  },

  async updateFinding(
    id: string,
    payload: UpdateReviewFindingPayload,
  ): Promise<ReviewFindingResponse> {
    const updated = await workspaceRepo.updateFinding(id, payload);
    if (!updated) throw new Error("Review finding not found");
    return updated;
  },

  async deleteFinding(id: string): Promise<void> {
    await workspaceRepo.deleteFinding(id);
  },
};
