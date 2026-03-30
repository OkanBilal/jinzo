import { connectionStatesService } from "./connectionStates.service";
import type { ConnectionStatesResponse, ServiceResponse } from "./connectionStates.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const ConnectionStatesController = {
  async getAll(): Promise<ServiceResponse<ConnectionStatesResponse[]>> {
    return connectionStatesService.getAll();
  },

  async updateById(id: unknown, payload: unknown): Promise<ServiceResponse<null>> {
    return connectionStatesService.updateById(id, payload);
  },
};
