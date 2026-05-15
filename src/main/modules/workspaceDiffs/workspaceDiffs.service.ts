import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { workspaceDiffsRepo } from "./workspaceDiffs.repo";
import type {
  WorkspaceDiffResponse,
  WorkspaceDiffSummaryResponse,
  ServiceResponse,
} from "./workspaceDiffs.dto";

// ─────────────────────────────────────────────────────────────
// Workspace Diffs Service
// ─────────────────────────────────────────────────────────────
export const workspaceDiffsService = {
  async getByWorkspace(
    workspaceId: string,
    limit?: number,
  ): Promise<ServiceResponse<WorkspaceDiffResponse[]>> {
    try {
      const diffs = await workspaceDiffsRepo.findByWorkspace(workspaceId, limit);
      return ok(diffs);
    } catch (error) {
      console.error(
        `[WorkspaceDiffsService] Failed to get diffs for workspace ${workspaceId}:`,
        error,
      );
      return fail("Failed to get workspace diffs");
    }
  },

  async getLatest(
    workspaceId: string,
  ): Promise<ServiceResponse<WorkspaceDiffResponse>> {
    try {
      const diff = await workspaceDiffsRepo.findLatestByWorkspace(workspaceId);
      if (!diff) {
        return fail("No diff found for this workspace");
      }
      return ok(diff);
    } catch (error) {
      console.error(
        `[WorkspaceDiffsService] Failed to get latest diff for workspace ${workspaceId}:`,
        error,
      );
      return fail("Failed to get latest workspace diff");
    }
  },

  async getLatestSummary(
    workspaceId: string,
  ): Promise<ServiceResponse<WorkspaceDiffSummaryResponse>> {
    try {
      const diff =
        await workspaceDiffsRepo.findLatestSummaryByWorkspace(workspaceId);
      if (!diff) {
        return fail("No diff found for this workspace");
      }
      return ok(diff);
    } catch (error) {
      console.error(
        `[WorkspaceDiffsService] Failed to get latest diff summary for workspace ${workspaceId}:`,
        error,
      );
      return {
        success: false,
        error: "Failed to get latest workspace diff summary",
      };
    }
  },

  async getByRun(
    runId: string,
  ): Promise<ServiceResponse<WorkspaceDiffResponse>> {
    try {
      const diff = await workspaceDiffsRepo.findByRun(runId);
      if (!diff) {
        return fail("No diff found for this run");
      }
      return ok(diff);
    } catch (error) {
      console.error(
        `[WorkspaceDiffsService] Failed to get diff for run ${runId}:`,
        error,
      );
      return fail("Failed to get run diff");
    }
  },

  async deleteLatest(
    workspaceId: string,
  ): Promise<ServiceResponse<void>> {
    try {
      await workspaceDiffsRepo.deleteLatestByWorkspace(workspaceId);
      return ok(undefined);
    } catch (error) {
      console.error(
        `[WorkspaceDiffsService] Failed to delete latest diff for workspace ${workspaceId}:`,
        error,
      );
      return fail("Failed to delete latest workspace diff");
    }
  },

  async createDiff(payload: {
    id: string;
    workspaceId: string;
    runId?: string;
    baseRef?: string;
    diffText: string;
    filesJson?: string;
    statsJson?: string;
  }): Promise<ServiceResponse<string>> {
    try {
      const id = await workspaceDiffsRepo.insertDiff(payload);
      return ok(id);
    } catch (error) {
      console.error("[WorkspaceDiffsService] Failed to create diff:", error);
      return fail("Failed to create workspace diff");
    }
  },
};
