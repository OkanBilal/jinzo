import { Chat } from "@/components/ui/icons";
import { ChartCard } from "@/components/ui/charts";
import type { RecentSession } from "@/lib/redux/api";

interface RecentSessionsListProps {
  sessions: RecentSession[];
}

const PROVIDER_COLORS: Record<string, string> = {
  claude_code: "#D97757",
  copilot_cli: "#3010B3",
};

const MODEL_LABELS: Record<string, string> = {
  default: "Opus 4.6",
  sonnet: "Sonnet 4.6",
  haiku: "Haiku 4.5",
};

function displayModel(model: string | null): string | null {
  if (!model) return null;
  return MODEL_LABELS[model] ?? model;
}

function formatCost(usd: number | null): string {
  if (usd === null || usd === 0) return "";
  return `$${usd.toFixed(3)}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

export default function RecentSessionsList({ sessions }: RecentSessionsListProps) {
  return (
    <ChartCard
      title="Recent Sessions"
      icon={Chat}
      isEmpty={sessions.length === 0}
      emptyMessage="No sessions yet"
      emptyHeight="flex-1"
      className="h-full flex flex-col"
    >
      <div className="space-y-2 overflow-y-auto min-h-0 flex-1">
        {sessions.map((s) => (
          <div
            key={s.runId}
            className="flex items-center gap-2.5 py-1.5 text-xs"
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: PROVIDER_COLORS[s.providerId] ?? "#6366F1" }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-primary-800 dark:text-primary-200 truncate">
                {s.title ?? s.goal ?? "Untitled run"}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {s.projectName && (
                  <span className="text-primary-400 dark:text-primary-500 truncate">
                    {s.projectName}
                  </span>
                )}
                {displayModel(s.model) && (
                  <span className="text-primary-400 dark:text-primary-500">
                    {displayModel(s.model)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-primary-400 dark:text-primary-500">
              {s.durationMs !== null && (
                <span>{formatDuration(s.durationMs)}</span>
              )}
              {s.totalCostUsd !== null && s.totalCostUsd > 0 && (
                <span>{formatCost(s.totalCostUsd)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
