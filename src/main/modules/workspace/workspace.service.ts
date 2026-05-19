import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { BrowserWindow } from "electron";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import { workspaceRepo } from "./workspace.repo";
import { projectsRepo } from "../projects/projects.repo";
import type {
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
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
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(CHANNELS.workspace.scriptComplete, event);
  }
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
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(CHANNELS.workspace.findingsChanged, { workspaceId });
  }
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
