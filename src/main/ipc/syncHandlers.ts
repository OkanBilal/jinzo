import { ipcMain } from "electron";
import {
  fetchAllEntities,
  createChunksForEntities,
  generateChunkEmbeddings,
  createEntityChunkMap,
  processAndInsertEntities,
  createSuccessResult,
  createFailureResult,
  createEmptyResult,
} from "../../renderer/lib/sync";

/**
 * Note: Avoid scheduling at 2:00-3:00 AM due to DST changes
 * See: https://www.endpointdev.com/blog/2013/04/avoid-200-and-300-am-cron-jobs/
 */

/**
 * Register all IPC handlers for sync operations
 */
export function registerSyncHandlers() {
  // Run the sync job to fetch and process entities
  ipcMain.handle("sync:runEntitySync", async () => {
    const startTime = Date.now();

    try {
      const entities = await fetchAllEntities();

      if (entities.length === 0) {
        console.warn("⚠️  No entities fetched from sources");
        const result = createEmptyResult(Date.now() - startTime);
        return { success: true, data: result };
      }

      const chunks = createChunksForEntities(entities);
      const embeddings = await generateChunkEmbeddings(chunks);
      const entityChunkMap = createEntityChunkMap(chunks);
      const stats = await processAndInsertEntities(
        entities,
        chunks,
        embeddings,
        entityChunkMap
      );

      const duration = Date.now() - startTime;
      const result = createSuccessResult(stats, entities.length, duration);

      return { success: true, data: result };
    } catch (err) {
      console.error("Sync job failed:", err);

      const duration = Date.now() - startTime;
      const result = createFailureResult(duration);

      return { success: false, data: result, error: "Sync job failed" };
    }
  });
}

export function unregisterSyncHandlers() {
  ipcMain.removeHandler("sync:runEntitySync");
}
