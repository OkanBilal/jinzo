import type { OllamaToolDefinition } from "../types";
import {
  fetchAllFeedItems,
  createChunksForItems,
  generateChunkEmbeddings,
  createItemChunkMap,
  processAndInsertItems,
  createSuccessResult,
  createFailureResult,
  createEmptyResult,
} from "../../cron/";

/**
 * Cron sync result structure
 */
export interface CronSyncResult {
  success: boolean;
  itemsProcessed?: number;
  itemsInserted?: number;
  chunksCreated?: number;
  embeddingsGenerated?: number;
  duration?: number;
  error?: string;
}

/**
 * Trigger a feed synchronization cron job
 * This fetches items from all connected sources, processes them, and stores them in the database
 */
export async function triggerFeedSync(): Promise<CronSyncResult> {
  const startTime = Date.now();

  try {
    const items = await fetchAllFeedItems();

    if (items.length === 0) {
      console.warn("⚠️  No items fetched from sources");
      const result = createEmptyResult(Date.now() - startTime);
      return {
        success: true,
        itemsProcessed: 0,
        itemsInserted: result.inserted,
        chunksCreated: result.totalChunks,
        embeddingsGenerated: result.totalChunks,
        duration: result.duration,
      };
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

    return {
      success: true,
      itemsProcessed: items.length,
      itemsInserted: result.inserted,
      chunksCreated: result.totalChunks,
      embeddingsGenerated: result.totalChunks,
      duration: result.duration,
    };
  } catch (error) {
    console.error("Failed to trigger feed sync:", error);
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      duration,
    };
  }
}

export const CRON_TOOLS: OllamaToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "trigger_feed_sync",
      description:
        "Sync, refresh, update, or fetch new feed items from external sources. This fetches the latest items from all connected sources (GitHub, Hacker News, Raindrop, RSS), processes them, creates embeddings, and stores them in the database. Use this when the user wants to: sync feeds, refresh feeds, update feeds, fetch new items, get latest content, or pull from sources. This is the ONLY tool that actually fetches new data from external APIs.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

export async function executeCronTool(
  toolName: string,
  params?: any
): Promise<any> {
  switch (toolName) {
    case "trigger_feed_sync":
      return triggerFeedSync();
    default:
      throw new Error(`Unknown cron tool: ${toolName}`);
  }
}
