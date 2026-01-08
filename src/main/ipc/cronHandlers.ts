import { ipcMain } from "electron";
import {
  fetchAllFeedItems,
  createChunksForItems,
  generateChunkEmbeddings,
  createItemChunkMap,
  processAndInsertItems,
  createSuccessResult,
  createFailureResult,
  createEmptyResult,
} from "../../renderer/lib/cron/";

/**
 * Note: Avoid scheduling at 2:00-3:00 AM due to DST changes
 * See: https://www.endpointdev.com/blog/2013/04/avoid-200-and-300-am-cron-jobs/
 */

/**
 * Register all IPC handlers for cron operations
 */
export function registerCronHandlers() {
  // Run the cron job to fetch and process feed items
  ipcMain.handle("cron:runFeedSync", async () => {
    const startTime = Date.now();

    try {
      const items = await fetchAllFeedItems();

      if (items.length === 0) {
        console.warn("⚠️  No items fetched from sources");
        const result = createEmptyResult(Date.now() - startTime);
        return { success: true, data: result };
      }

      const chunks = createChunksForItems(items);
      const embeddings = await generateChunkEmbeddings(chunks);
      const itemChunkMap = createItemChunkMap(chunks);
      const stats = await processAndInsertItems(
        items,
        chunks,
        embeddings,
        itemChunkMap
      );

      const duration = Date.now() - startTime;
      const result = createSuccessResult(stats, items.length, duration);

      return { success: true, data: result };
    } catch (err) {
      console.error("Cron job failed:", err);

      const duration = Date.now() - startTime;
      const result = createFailureResult(duration);

      return { success: false, data: result, error: "Cron job failed" };
    }
  });
}
