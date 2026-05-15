import { statsService } from "./stats.service";
import type { DashboardData, ProviderFilter } from "./stats.dto";
import { ok, fail, type ServiceResponse } from "../../../shared/ipc-kit/service-response";

export const statsController = {
  async getDashboard(filter?: ProviderFilter): Promise<ServiceResponse<DashboardData>> {
    try {
      const data = await statsService.getDashboard(filter ?? "all");
      return ok(data);
    } catch (error) {
      console.error("[StatsController] Failed to get dashboard:", error);
      return fail(error instanceof Error ? error.message : "Failed to get dashboard data");
    }
  },
};
