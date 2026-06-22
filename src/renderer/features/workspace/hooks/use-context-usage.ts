import { useEffect, useState } from "react";
import { appEvents } from "@/lib/transport";

export interface ContextUsageSnapshot {
  totalTokens: number;
  maxTokens: number;
  percentage: number;
  model?: string;
  isAutoCompactEnabled?: boolean;
  autoCompactThreshold?: number;
  categories?: { name: string; tokens: number; color: string }[];
  ts: number;
}

/**
 * Subscribes to live context-window usage snapshots for the active run.
 * Snapshots are ephemeral (pushed at turn boundaries, never persisted), so the
 * hook holds the most recent one in local state and clears it when the active
 * run changes.
 */
export function useContextUsage(activeRunId: string | null): ContextUsageSnapshot | null {
  const [usageByRun, setUsageByRun] = useState<{
    runId: string;
    snapshot: ContextUsageSnapshot;
  } | null>(null);

  useEffect(() => {
    if (!activeRunId) return;

    const cleanup = appEvents.runs.onContextUsage((data) => {
      if (data.runId !== activeRunId) return;
      const { event } = data;
      setUsageByRun({
        runId: activeRunId,
        snapshot: {
          totalTokens: event.totalTokens,
          maxTokens: event.maxTokens,
          percentage: event.percentage,
          model: event.model,
          isAutoCompactEnabled: event.isAutoCompactEnabled,
          autoCompactThreshold: event.autoCompactThreshold,
          categories: event.categories,
          ts: event.ts ?? Date.now(),
        },
      });
    });

    return () => {
      cleanup();
    };
  }, [activeRunId]);

  if (!activeRunId || usageByRun?.runId !== activeRunId) {
    return null;
  }

  return usageByRun.snapshot;
}
