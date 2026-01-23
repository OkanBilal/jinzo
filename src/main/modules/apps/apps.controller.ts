import { appsService } from "./apps.service";
import type { AppResponse, ServiceResponse } from "./apps.dto";

// ─────────────────────────────────────────────────────────────
// Controller - Maps IPC requests to service calls
// ─────────────────────────────────────────────────────────────
export const appsController = {
  async getAll(): Promise<ServiceResponse<AppResponse[]>> {
    return appsService.getAll();
  },

  async updateById(id: unknown, payload: unknown): Promise<ServiceResponse<null>> {
    return appsService.updateById(id, payload);
  },
};
