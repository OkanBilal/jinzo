// ─────────────────────────────────────────────────────────────
// Stats DTO — Types for the statistics dashboard
// ─────────────────────────────────────────────────────────────

export interface InsertRunUsagePayload {
  runId: string;
  totalCostMicros?: number | null;
  durationMs?: number | null;
  numTurns?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  providerId?: string | null;
  model?: string | null;
}

export interface DashboardSummary {
  totalProjects: number;
  runsToday: number;
  totalSessions: number;
  estimatedCostUsd: number;
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  claude: number;
  copilot: number;
  other: number;
}

export interface HourDistribution {
  hour: number; // 0-23
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

export type ProviderFilter = "all" | "claude_code" | "copilot_cli";

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
