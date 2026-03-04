import { workspaceActivityRepo } from "./workspaceActivity.repo";
import type {
  CreateActivityPayload,
  ActivityResponse,
  ServiceResponse,
} from "./workspaceActivity.dto";

// ─────────────────────────────────────────────────────────────
// Workspace Activity Service
// ─────────────────────────────────────────────────────────────
export const workspaceActivityService = {
  async getByWorkspace(
    workspaceId: string,
    limit?: number,
  ): Promise<ServiceResponse<ActivityResponse[]>> {
    try {
      const activities = await workspaceActivityRepo.findByWorkspace(
        workspaceId,
        limit,
      );
      return { success: true, data: activities };
    } catch (error) {
      console.error(
        `[WorkspaceActivityService] Failed to get activity for workspace ${workspaceId}:`,
        error,
      );
      return { success: false, error: "Failed to get workspace activity" };
    }
  },

  async create(
    payload: CreateActivityPayload,
  ): Promise<ServiceResponse<string>> {
    try {
      const id = await workspaceActivityRepo.insert(payload);
      return { success: true, data: id };
    } catch (error) {
      console.error(
        "[WorkspaceActivityService] Failed to create activity:",
        error,
      );
      return { success: false, error: "Failed to create activity" };
    }
  },

  async createMany(
    payloads: CreateActivityPayload[],
  ): Promise<ServiceResponse<string[]>> {
    try {
      const ids = await workspaceActivityRepo.insertMany(payloads);
      return { success: true, data: ids };
    } catch (error) {
      console.error(
        "[WorkspaceActivityService] Failed to create activities:",
        error,
      );
      return { success: false, error: "Failed to create activities" };
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await workspaceActivityRepo.remove(id);
      return { success: true };
    } catch (error) {
      console.error(
        `[WorkspaceActivityService] Failed to delete activity ${id}:`,
        error,
      );
      return { success: false, error: "Failed to delete activity" };
    }
  },

  /**
   * Fire-and-forget activity logging. Never blocks or throws.
   */
  log(payload: CreateActivityPayload): void {
    workspaceActivityRepo.insert(payload).catch((err) => {
      console.error("[WorkspaceActivityService] log() failed:", err);
    });
  },
};
