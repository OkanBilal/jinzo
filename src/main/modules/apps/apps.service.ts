import { appsRepo } from "./apps.repo";
import { validateAppId, validateUpdatePayload } from "./apps.validation";
import type { AppResponse, ServiceResponse } from "./apps.dto";

// ─────────────────────────────────────────────────────────────
// Service - Business Logic
// ─────────────────────────────────────────────────────────────
export const appsService = {
  /**
   * Gets all apps
   */
  async getAll(): Promise<ServiceResponse<AppResponse[]>> {
    try {
      const apps = await appsRepo.findAll();
      return { success: true, data: apps };
    } catch (error) {
      console.error("Error fetching apps:", error);
      return { success: false, error: "Failed to fetch apps" };
    }
  },

  /**
   * Updates an app by ID
   */
  async updateById(id: unknown, payload: unknown): Promise<ServiceResponse<null>> {
    try {
      const idError = validateAppId(id);
      if (idError) {
        return { success: false, error: idError };
      }

      const { data, error } = validateUpdatePayload(payload);
      if (error || !data) {
        return { success: false, error: error ?? "Invalid payload" };
      }

      await appsRepo.updateById(id as string, data);

      return { success: true, data: null };
    } catch (error) {
      console.error("Error updating app state:", error);
      return { success: false, error: "Failed to update app state" };
    }
  },
};
