import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import { emit } from "../../ipc-kit";
import { workspaceRepo } from "./workspace.repo";
import { projectsRepo } from "../projects/projects.repo";
import { normalizeRemoteOrigin } from "../projects/projects.utils";
import { gitService } from "../git/git.service";
import { appSettingsService } from "../appSettings/appSettings.service";
import { buildDiffSnapshot } from "./workspace-diff-snapshot";
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
  ServiceResponse,
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

/** Unwrap a git `ServiceResponse`, or throw with a caller-friendly message. */
function expectOk<T>(res: ServiceResponse<T>, fallback: string): T {
  if (res.success && res.data != null) return res.data;
  throw new Error(!res.success ? res.error : fallback);
}

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
  const res = await gitService.getRemotes(rootPath);
  if (!res.success || !res.data) return null;
  return res.data.find((r) => r.name === "origin")?.fetchUrl ?? null;
}

/** Read the checked-out branch of a repo, falling back to `main`. */
async function readCurrentBranch(rootPath: string): Promise<string> {
  const res = await gitService.getCurrentBranch(rootPath);
  return res.success && res.data ? res.data : "main";
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
// ─────────────────────────────────────────────────────────────
export const workspaceService = {
  // ─────────────────────────────────────────────────────────────
  // ── Workspace lifecycle ──
  // ─────────────────────────────────────────────────────────────

  async list(): Promise<ServiceResponse<WorkspaceResponse[]>> {
    try {
      return ok(await workspaceRepo.findAll());
    } catch (error) {
      console.error("[WorkspaceService] Failed to list workspaces:", error);
      return fail("Failed to get workspaces");
    }
  },

  async get(id: string): Promise<ServiceResponse<WorkspaceResponse>> {
    try {
      const workspace = await workspaceRepo.findById(id);
      if (!workspace) return fail("Workspace not found");
      return ok(workspace);
    } catch (error) {
      console.error(`[WorkspaceService] Failed to get workspace ${id}:`, error);
      return fail("Failed to get workspace");
    }
  },

  async listByAccount(
    accountId: string,
  ): Promise<ServiceResponse<WorkspaceResponse[]>> {
    try {
      return ok(await workspaceRepo.findByAccountId(accountId));
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to list workspaces for account ${accountId}:`,
        error,
      );
      return fail("Failed to get workspaces");
    }
  },

  async getByRootPath(
    accountId: string,
    rootPath: string,
  ): Promise<ServiceResponse<WorkspaceResponse>> {
    try {
      const workspace = await workspaceRepo.findByRootPath(accountId, rootPath);
      if (!workspace) return fail("Workspace not found");
      return ok(workspace);
    } catch (error) {
      console.error(`[WorkspaceService] Failed to get workspace by path:`, error);
      return fail("Failed to get workspace");
    }
  },

  async create(
    payload: CreateWorkspacePayload,
  ): Promise<ServiceResponse<WorkspaceResponse>> {
    try {
      const existing = await workspaceRepo.findByRootPath(
        payload.accountId,
        payload.rootPath,
      );
      if (existing) {
        return fail("Workspace with this path already exists");
      }

      const workspacePayload = {
        ...payload,
        id: payload.id || randomUUID(),
      };

      const id = await workspaceRepo.insert(workspacePayload);
      const workspace = await workspaceRepo.findById(id);
      if (!workspace) return fail("Failed to retrieve created workspace");

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

      return ok(workspace);
    } catch (error) {
      console.error("[WorkspaceService] Failed to create workspace:", error);
      return fail("Failed to create workspace");
    }
  },

  /**
   * Turn a git repo into a project + workspace pair. The three sources
   * (picked `folder`, `clone` of a URL, fresh `init`) each yield a local repo
   * path; the shared tail imports it (worktree or direct), finds-or-creates
   * the project, and creates the workspace. The worktree-vs-direct ordering
   * difference lives here, not at call sites. See CONTEXT.md "Workspace intake".
   */
  async createFromSource(
    payload: WorkspaceIntakePayload,
  ): Promise<ServiceResponse<WorkspaceResponse>> {
    try {
      const { accountId, source } = payload;

      // ── init: brand-new empty repo. Always direct, no remote. ──
      if (source.kind === "init") {
        const init = expectOk(
          await gitService.initRepo(source.name),
          "Failed to create project",
        );
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

      // ── folder / clone: obtain a local repo path, then import it. ──
      const sourcePath =
        source.kind === "clone"
          ? expectOk(
              await gitService.cloneRepo(source.url, source.targetPath),
              "Failed to clone repository",
            ).clonedPath
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
        const imported = expectOk(
          await gitService.importLocalRepo(sourcePath, project.name),
          "Not a git repository",
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
      const imported = expectOk(
        await gitService.importLocalRepoDirect(sourcePath),
        "Not a git repository",
      );
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
    } catch (error) {
      console.error("[WorkspaceService] Workspace intake failed:", error);
      return fail(
        error instanceof Error ? error.message : "Failed to create workspace",
      );
    }
  },

  async update(
    id: string,
    payload: UpdateWorkspacePayload,
  ): Promise<ServiceResponse<WorkspaceResponse>> {
    try {
      const updated = await workspaceRepo.update(id, payload);
      if (!updated) return fail("Workspace not found");
      return ok(updated);
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to update workspace ${id}:`,
        error,
      );
      return fail("Failed to update workspace");
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await workspaceRepo.delete(id);
      return ok(undefined);
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to delete workspace ${id}:`,
        error,
      );
      return fail("Failed to delete workspace");
    }
  },

  async updateStatus(
    id: string,
    status: WorkspaceStatus,
  ): Promise<ServiceResponse<WorkspaceResponse>> {
    return this.update(id, { status });
  },

  async archive(id: string): Promise<ServiceResponse<WorkspaceResponse>> {
    try {
      const workspace = await workspaceRepo.findById(id);
      if (!workspace) return fail("Workspace not found");

      const archived = await workspaceRepo.archive(id);
      if (!archived) return fail("Failed to archive workspace");

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

      return ok(archived);
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to archive workspace ${id}:`,
        error,
      );
      return fail("Failed to archive workspace");
    }
  },

  // ─────────────────────────────────────────────────────────────
  // ── Activity ──
  // ─────────────────────────────────────────────────────────────

  async listActivity(
    workspaceId: string,
    limit?: number,
  ): Promise<ServiceResponse<ActivityResponse[]>> {
    try {
      return ok(await workspaceRepo.findActivityByWorkspace(workspaceId, limit));
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to list activity for workspace ${workspaceId}:`,
        error,
      );
      return fail("Failed to get workspace activity");
    }
  },

  async createActivity(
    payload: CreateActivityPayload,
  ): Promise<ServiceResponse<string>> {
    try {
      return ok(await workspaceRepo.insertActivity(payload));
    } catch (error) {
      console.error("[WorkspaceService] Failed to create activity:", error);
      return fail("Failed to create activity");
    }
  },

  async createManyActivity(
    payloads: CreateActivityPayload[],
  ): Promise<ServiceResponse<string[]>> {
    try {
      return ok(await workspaceRepo.insertManyActivity(payloads));
    } catch (error) {
      console.error("[WorkspaceService] Failed to create activities:", error);
      return fail("Failed to create activities");
    }
  },

  async deleteActivity(id: string): Promise<ServiceResponse<void>> {
    try {
      await workspaceRepo.deleteActivity(id);
      return ok(undefined);
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to delete activity ${id}:`,
        error,
      );
      return fail("Failed to delete activity");
    }
  },

  // ─────────────────────────────────────────────────────────────
  // ── Diffs ──
  // ─────────────────────────────────────────────────────────────

  async listDiffs(
    workspaceId: string,
    limit?: number,
  ): Promise<ServiceResponse<WorkspaceDiffResponse[]>> {
    try {
      return ok(await workspaceRepo.findDiffsByWorkspace(workspaceId, limit));
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to list diffs for workspace ${workspaceId}:`,
        error,
      );
      return fail("Failed to get workspace diffs");
    }
  },

  async getLatestDiff(
    workspaceId: string,
  ): Promise<ServiceResponse<WorkspaceDiffResponse>> {
    try {
      const diff = await workspaceRepo.findLatestDiffByWorkspace(workspaceId);
      if (!diff) return fail("No diff found for this workspace");
      return ok(diff);
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to get latest diff for workspace ${workspaceId}:`,
        error,
      );
      return fail("Failed to get latest workspace diff");
    }
  },

  async getLatestDiffSummary(
    workspaceId: string,
  ): Promise<ServiceResponse<WorkspaceDiffSummaryResponse>> {
    try {
      const diff =
        await workspaceRepo.findLatestDiffSummaryByWorkspace(workspaceId);
      if (!diff) return fail("No diff found for this workspace");
      return ok(diff);
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to get latest diff summary for workspace ${workspaceId}:`,
        error,
      );
      return fail("Failed to get latest workspace diff summary");
    }
  },

  async getDiffByRun(
    runId: string,
  ): Promise<ServiceResponse<WorkspaceDiffResponse>> {
    try {
      const diff = await workspaceRepo.findDiffByRun(runId);
      if (!diff) return fail("No diff found for this run");
      return ok(diff);
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to get diff for run ${runId}:`,
        error,
      );
      return fail("Failed to get run diff");
    }
  },

  async deleteLatestDiff(
    workspaceId: string,
  ): Promise<ServiceResponse<void>> {
    try {
      await workspaceRepo.deleteLatestDiffByWorkspace(workspaceId);
      return ok(undefined);
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to delete latest diff for workspace ${workspaceId}:`,
        error,
      );
      return fail("Failed to delete latest workspace diff");
    }
  },

  async createDiff(
    payload: CreateDiffPayload,
  ): Promise<ServiceResponse<string>> {
    try {
      return ok(await workspaceRepo.insertDiff(payload));
    } catch (error) {
      console.error("[WorkspaceService] Failed to create diff:", error);
      return fail("Failed to create workspace diff");
    }
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
  ): Promise<ServiceResponse<WorkspaceDiffSummaryResponse | null>> {
    try {
      const workspace = await workspaceRepo.findById(workspaceId);
      if (!workspace) return fail("Workspace not found");

      const existing = await workspaceRepo.findLatestDiffByWorkspace(workspaceId);

      // Re-anchor to the current HEAD rather than the stored baseRef (captured
      // at run start). Otherwise work committed externally — e.g. via the CLI —
      // stays in the `baseRef..workingTree` range and keeps showing up even
      // though the tree is clean. This mirrors the in-process commit tool, which
      // advances baseRef to the post-commit HEAD (see mains-tools.core.ts).
      const headResult = await gitService.getHeadSha(workspace.rootPath);
      const baseRef =
        headResult.success && headResult.data
          ? headResult.data
          : (existing?.baseRef ?? null);

      // No baseRef means it's not a git repo (or git failed). Drop any stale
      // row defensively, then bail.
      if (!baseRef) {
        if (existing) {
          await workspaceRepo.deleteLatestDiffByWorkspace(workspaceId);
        }
        return ok(null);
      }

      const snapshot = await buildDiffSnapshot({
        rootPath: workspace.rootPath,
        baseRef,
      });
      if (!snapshot) return fail("Failed to compute diff");

      if (snapshot.files.length === 0) {
        if (existing) {
          await workspaceRepo.deleteLatestDiffByWorkspace(workspaceId);
        }
        return ok(null);
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

      const summary =
        await workspaceRepo.findLatestDiffSummaryByWorkspace(workspaceId);
      return ok(summary);
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to resync diff for workspace ${workspaceId}:`,
        error,
      );
      return fail("Failed to resync workspace diff");
    }
  },

  // ─────────────────────────────────────────────────────────────
  // ── Reviews ──
  // ─────────────────────────────────────────────────────────────

  async listReviews(
    workspaceId: string,
    limit?: number,
  ): Promise<ServiceResponse<ReviewResponse[]>> {
    try {
      return ok(await workspaceRepo.findReviewsByWorkspace(workspaceId, limit));
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to list reviews for workspace ${workspaceId}:`,
        error,
      );
      return fail("Failed to get reviews");
    }
  },

  async getReview(id: string): Promise<ServiceResponse<ReviewResponse>> {
    try {
      const review = await workspaceRepo.findReviewById(id);
      if (!review) return fail("Review not found");
      return ok(review);
    } catch (error) {
      console.error(`[WorkspaceService] Failed to get review ${id}:`, error);
      return fail("Failed to get review");
    }
  },

  async createReview(
    payload: CreateReviewPayload,
  ): Promise<ServiceResponse<string>> {
    try {
      return ok(await workspaceRepo.insertReview(payload));
    } catch (error) {
      console.error("[WorkspaceService] Failed to create review:", error);
      return fail("Failed to create review");
    }
  },

  async updateReview(
    id: string,
    payload: UpdateReviewPayload,
  ): Promise<ServiceResponse<ReviewResponse>> {
    try {
      const updated = await workspaceRepo.updateReview(id, payload);
      if (!updated) return fail("Review not found");
      return ok(updated);
    } catch (error) {
      console.error(`[WorkspaceService] Failed to update review ${id}:`, error);
      return fail("Failed to update review");
    }
  },

  async deleteReview(id: string): Promise<ServiceResponse<void>> {
    try {
      await workspaceRepo.deleteReview(id);
      return ok(undefined);
    } catch (error) {
      console.error(`[WorkspaceService] Failed to delete review ${id}:`, error);
      return fail("Failed to delete review");
    }
  },

  // ─────────────────────────────────────────────────────────────
  // ── Findings ──
  // ─────────────────────────────────────────────────────────────

  async listFindings(
    reviewId: string,
    limit?: number,
  ): Promise<ServiceResponse<ReviewFindingResponse[]>> {
    try {
      return ok(await workspaceRepo.findFindingsByReview(reviewId, limit));
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to list findings for review ${reviewId}:`,
        error,
      );
      return fail("Failed to get review findings");
    }
  },

  /**
   * Returns findings for a workspace, deduped per file to only the most
   * recent review's findings. Filtering happens in JS for simplicity; revisit
   * if data volume grows.
   */
  async listFindingsByWorkspace(
    workspaceId: string,
  ): Promise<ServiceResponse<ReviewFindingResponse[]>> {
    try {
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

      const filtered = allFindings
        .filter((f) => latestReviewByFile.get(f.file) === f.reviewId)
        .map(({ reviewCreatedAt: _omit, ...rest }) => rest);

      return ok(filtered);
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to list findings for workspace ${workspaceId}:`,
        error,
      );
      return fail("Failed to get workspace findings");
    }
  },

  async getFinding(
    id: string,
  ): Promise<ServiceResponse<ReviewFindingResponse>> {
    try {
      const finding = await workspaceRepo.findFindingById(id);
      if (!finding) return fail("Review finding not found");
      return ok(finding);
    } catch (error) {
      console.error(`[WorkspaceService] Failed to get finding ${id}:`, error);
      return fail("Failed to get review finding");
    }
  },

  async createFinding(
    payload: CreateReviewFindingPayload,
  ): Promise<ServiceResponse<string>> {
    try {
      return ok(await workspaceRepo.insertFinding(payload));
    } catch (error) {
      console.error("[WorkspaceService] Failed to create finding:", error);
      return fail("Failed to create review finding");
    }
  },

  async createManyFindings(
    payloads: CreateReviewFindingPayload[],
  ): Promise<ServiceResponse<string[]>> {
    try {
      return ok(await workspaceRepo.insertManyFindings(payloads));
    } catch (error) {
      console.error("[WorkspaceService] Failed to create findings:", error);
      return fail("Failed to create review findings");
    }
  },

  async updateFinding(
    id: string,
    payload: UpdateReviewFindingPayload,
  ): Promise<ServiceResponse<ReviewFindingResponse>> {
    try {
      const updated = await workspaceRepo.updateFinding(id, payload);
      if (!updated) return fail("Review finding not found");
      return ok(updated);
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to update finding ${id}:`,
        error,
      );
      return fail("Failed to update review finding");
    }
  },

  async deleteFinding(id: string): Promise<ServiceResponse<void>> {
    try {
      await workspaceRepo.deleteFinding(id);
      return ok(undefined);
    } catch (error) {
      console.error(
        `[WorkspaceService] Failed to delete finding ${id}:`,
        error,
      );
      return fail("Failed to delete review finding");
    }
  },
};
