import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { connectionStatesRepo } from "./connectionStates.repo";
import { validateConnectionId, validateUpdatePayload } from "./connectionStates.validation";
import type { ConnectionStatesResponse, ServiceResponse } from "./connectionStates.dto";

// ─────────────────────────────────────────────────────────────
// Service - Business Logic
// ─────────────────────────────────────────────────────────────
export const connectionStatesService = {
  /**
   * Gets all connnectionStates
   */
  async getAll(): Promise<ServiceResponse<ConnectionStatesResponse[]>> {
    try {
      const connnectionStates = await connectionStatesRepo.findAll();
      return ok(connnectionStates);
    } catch (error) {
      console.error("Error fetching connnectionStates:", error);
      return fail("Failed to fetch connnectionStates");
    }
  },

  /**
   * Updates an connection by ID
   */
  async updateById(id: unknown, payload: unknown): Promise<ServiceResponse<null>> {
    try {
      const idError = validateConnectionId(id);
      if (idError) {
        return fail(idError);
      }

      const { data, error } = validateUpdatePayload(payload);
      if (error || !data) {
        return fail(error ?? "Invalid payload");
      }

      await connectionStatesRepo.updateById(id as string, data);

      return ok(null);
    } catch (error) {
      console.error("Error updating connection state:", error);
      return fail("Failed to update connection state");
    }
  },
};
