import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { statsRepo } from "./stats.repo";
import type { DashboardData, ProviderFilter, ServiceResponse } from "./stats.dto";

export const statsService = {
  async getDashboard(
    filter: ProviderFilter = "all",
  ): Promise<ServiceResponse<DashboardData>> {
    try {
      const [
        summary,
        dailyActivity,
        hourDistribution,
        costByModel,
        toolUsage,
        statusBreakdown,
        recentSessions,
        codeActivity,
      ] = await Promise.all([
        statsRepo.getSummary(filter),
        statsRepo.getDailyActivity(30, filter),
        statsRepo.getHourDistribution(filter),
        statsRepo.getCostByModel(filter),
        statsRepo.getToolUsage(15, filter),
        statsRepo.getStatusBreakdown(filter),
        statsRepo.getRecentSessions(15, filter),
        statsRepo.getCodeActivity(filter),
      ]);

      return ok({
        summary,
        dailyActivity,
        hourDistribution,
        costByModel,
        toolUsage,
        statusBreakdown,
        recentSessions,
        codeActivity,
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Unknown error");
    }
  },
};
