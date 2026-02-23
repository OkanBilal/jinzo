import { fetchAllEntities } from "./sync.fetchers";
// TODO: Re-enable chunking & embedding pipeline
// import { createChunksForEntities, createEntityChunkMap, generateChunkEmbeddings } from "./sync.chunking";
import { syncRepo } from "./sync.repo";
import type { SyncJobResult, SyncJobStats, ServiceResponse } from "./sync.dto";

// ─────────────────────────────────────────────────────────────
// Result Builders
// ─────────────────────────────────────────────────────────────
function calculateStats(
  stats: SyncJobStats,
  totalEntities: number,
  duration: number
): SyncJobResult["stats"] {
  return {
    avgEmbeddingTime: totalEntities > 0 ? Math.round(duration / totalEntities) : 0,
    itemsPerSecond: duration > 0 ? Math.round((totalEntities / duration) * 1000) : 0,
    avgChunksPerItem: stats.inserted > 0
      ? parseFloat((stats.totalChunks / stats.inserted).toFixed(2))
      : 0,
  };
}

function createSuccessResult(
  stats: SyncJobStats,
  totalEntities: number,
  duration: number
): SyncJobResult {
  return {
    success: true,
    inserted: stats.inserted,
    updated: stats.updated,
    skipped: stats.skipped,
    errors: stats.errors,
    total: totalEntities,
    totalChunks: stats.totalChunks,
    duration,
    stats: calculateStats(stats, totalEntities, duration),
  };
}

function createFailureResult(duration: number): SyncJobResult {
  return {
    success: false,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 1,
    total: 0,
    totalChunks: 0,
    duration,
    stats: { avgEmbeddingTime: 0, itemsPerSecond: 0, avgChunksPerItem: 0 },
  };
}

function createEmptyResult(duration: number): SyncJobResult {
  return {
    success: true,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    total: 0,
    totalChunks: 0,
    duration,
    stats: { avgEmbeddingTime: 0, itemsPerSecond: 0, avgChunksPerItem: 0 },
  };
}

// ─────────────────────────────────────────────────────────────
// Service - Business Logic
// ─────────────────────────────────────────────────────────────
export const syncService = {
  async runEntitySync(provider?: string): Promise<ServiceResponse<SyncJobResult>> {
    const startTime = Date.now();

    try {
      const entities = await fetchAllEntities(provider);

      if (entities.length === 0) {
        console.warn("⚠️  No entities fetched from sources");
        const result = createEmptyResult(Date.now() - startTime);
        return { success: true, data: result };
      }

      // TODO: Re-enable chunking & embedding pipeline
      // const chunks = createChunksForEntities(entities);
      // const embeddings = await generateChunkEmbeddings(chunks);
      // const entityChunkMap = createEntityChunkMap(chunks);

      const stats = await syncRepo.upsertEntities(entities);

      const duration = Date.now() - startTime;
      const result = createSuccessResult(stats, entities.length, duration);

      return { success: true, data: result };
    } catch (err) {
      console.error("Sync job failed:", err);

      const duration = Date.now() - startTime;
      const result = createFailureResult(duration);

      return { success: false, data: result, error: "Sync job failed" };
    }
  },
};
