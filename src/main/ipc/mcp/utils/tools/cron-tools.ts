import { createChunksForEntities, createEmptyResult, createEntityChunkMap, createSuccessResult, fetchAllEntities, generateChunkEmbeddings, processAndInsertEntities } from "../../../sync/utils";
import type { OllamaToolDefinition, SyncResult } from "../types";


/**
 * Trigger an entity synchronization job
 * This fetches entities from all connected sources, processes them, and stores them in the database
 */
export async function triggerEntitySync(): Promise<SyncResult> {
  const startTime = Date.now();

  try {
    const entities = await fetchAllEntities();

    if (entities.length === 0) {
      console.warn("⚠️  No entities fetched from sources");
      const result = createEmptyResult(Date.now() - startTime);
      return {
        success: true,
        entitiesProcessed: 0,
        entitiesInserted: result.inserted,
        chunksCreated: result.totalChunks,
        embeddingsGenerated: result.totalChunks,
        duration: result.duration,
      };
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

    return {
      success: true,
      entitiesProcessed: entities.length,
      entitiesInserted: result.inserted,
      chunksCreated: result.totalChunks,
      embeddingsGenerated: result.totalChunks,
      duration: result.duration,
    };
  } catch (error) {
    console.error("Failed to trigger entity sync:", error);
    const duration = Date.now() - startTime;
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      duration,
    };
  }
}

/**
 * @deprecated Use triggerEntitySync instead
 */
export const triggerFeedSync = triggerEntitySync;

export const SYNC_TOOLS: OllamaToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "trigger_entity_sync",
      description:
        "Sync, refresh, update, or fetch new entities from external sources. This fetches the latest items from all connected sources (GitHub, Hacker News, Raindrop, RSS, Podcasts, etc.), processes them, creates embeddings, and stores them in the database. Use this when the user wants to: sync data, refresh feeds, update content, fetch new items, get latest content, or pull from sources. This is the ONLY tool that actually fetches new data from external APIs.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

/**
 * @deprecated Use SYNC_TOOLS instead
 */
export const CRON_TOOLS = SYNC_TOOLS;

export async function executeSyncTool(
  toolName: string,
): Promise<any> {
  switch (toolName) {
    case "trigger_entity_sync":
    case "trigger_feed_sync": // backward compat
      return triggerEntitySync();
    default:
      throw new Error(`Unknown sync tool: ${toolName}`);
  }
}

/**
 * @deprecated Use executeSyncTool instead
 */
export const executeCronTool = executeSyncTool;
