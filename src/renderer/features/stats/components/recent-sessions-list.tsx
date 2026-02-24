import { Chat } from "@/components/ui/icons";
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
  haiku: "Haiku 4.6",
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
  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/30 p-4">
        <p className="text-xs font-medium text-primary-500 dark:text-primary-400 mb-3">
          Recent Sessions
        </p>
        <div className="h-24 flex items-center justify-center text-sm text-primary-400 dark:text-primary-500">
          No sessions yet
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary-200/60 dark:border-primary-800/40 bg-primary-50/50 dark:bg-primary-900/30 p-4 h-full flex flex-col">
      <p className="text-xs font-medium text-primary-500 dark:text-primary-400 mb-3 flex items-center gap-1.5 shrink-0">
      <Chat className="w-3 h-3" />
        Recent Sessions
      </p>
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
    </div>
  );
}
