import { baseApi } from "./baseApi";

export interface DashboardSummary {
  totalProjects: number;
  runsToday: number;
  totalSessions: number;
  estimatedCostUsd: number;
}

export interface DailyActivity {
  date: string;
  claude: number;
  copilot: number;
  other: number;
}

export interface HourDistribution {
  hour: number;
  count: number;
}

export interface CostByModel {
  model: string;
  costUsd: number;
  runs: number;
}

export interface ToolUsageItem {
  toolName: string;
  count: number;
}

export interface StatusBreakdownDay {
  date: string;
  dayLabel: string;
  succeeded: number;
  failed: number;
  canceled: number;
  other: number;
}

export interface StatusBreakdown {
  days: StatusBreakdownDay[];
  totalSucceeded: number;
  totalFailed: number;
  totalCanceled: number;
  totalOther: number;
}

export interface RecentSession {
  runId: string;
  title: string | null;
  goal: string | null;
  status: string;
  providerId: string;
  model: string | null;
  projectName: string | null;
  durationMs: number | null;
  totalCostUsd: number | null;
  createdAt: number;
}

export interface CodeActivityStats {
  totalDiffs: number;
  totalFilesChanged: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  dailyActivity: DailyActivity[];
  hourDistribution: HourDistribution[];
  costByModel: CostByModel[];
  toolUsage: ToolUsageItem[];
  statusBreakdown: StatusBreakdown;
  recentSessions: RecentSession[];
  codeActivity: CodeActivityStats;
}

export type ProviderFilter = "all" | "claude_code" | "copilot_cli";

export const statsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query<DashboardData, ProviderFilter | void>({
      query: (filter) => ({
        handler: "stats:getDashboard",
        args: [filter ?? "all"],
      }),
      transformResponse: (response: { success: boolean; data: DashboardData }) =>
        response.data,
      providesTags: ["Stats"],
    }),
  }),
});

export const { useGetDashboardQuery, useLazyGetDashboardQuery } = statsApi;
