import type { CronJobResult, CronJobStats } from "../cron";

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

export function calculateStats(
  stats: CronJobStats,
  totalItems: number,
  duration: number
): CronJobResult["stats"] {
  return {
    avgEmbeddingTime: totalItems > 0 ? Math.round(duration / totalItems) : 0,
    itemsPerSecond:
      duration > 0 ? Math.round((totalItems / duration) * 1000) : 0,
    avgChunksPerItem:
      stats.inserted > 0
        ? parseFloat((stats.totalChunks / stats.inserted).toFixed(2))
        : 0,
  };
}

export function createSuccessResult(
  stats: CronJobStats,
  totalItems: number,
  duration: number
): CronJobResult {
  return {
    success: true,
    inserted: stats.inserted,
    skipped: stats.skipped,
    errors: stats.errors,
    total: totalItems,
    totalChunks: stats.totalChunks,
    duration,
    stats: calculateStats(stats, totalItems, duration),
  };
}

export function createFailureResult(duration: number): CronJobResult {
  return {
    success: false,
    inserted: 0,
    skipped: 0,
    errors: 1,
    total: 0,
    totalChunks: 0,
    duration,
    stats: {
      avgEmbeddingTime: 0,
      itemsPerSecond: 0,
      avgChunksPerItem: 0,
    },
  };
}

export function createEmptyResult(duration: number): CronJobResult {
  return {
    success: true,
    inserted: 0,
    skipped: 0,
    errors: 0,
    total: 0,
    totalChunks: 0,
    duration,
    stats: {
      avgEmbeddingTime: 0,
      itemsPerSecond: 0,
      avgChunksPerItem: 0,
    },
  };
}
