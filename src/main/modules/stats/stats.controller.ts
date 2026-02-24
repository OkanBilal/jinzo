import { statsService } from "./stats.service";
import type { DashboardData, ProviderFilter } from "./stats.dto";

interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const statsController = {
  async getDashboard(filter?: ProviderFilter): Promise<ServiceResponse<DashboardData>> {
    try {
      const data = await statsService.getDashboard(filter ?? "all");
      return { success: true, data };
    } catch (error) {
      console.error("[StatsController] Failed to get dashboard:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get dashboard data",
      };
    }
  },
};
