import {
  fetchAllEntities,
  createChunksForEntities,
  createEntityChunkMap,
  generateChunkEmbeddings,
  syncRepo,
} from "../../sync";
import type { OllamaToolDefinition, SyncResult } from "../mcp.dto";

// ─────────────────────────────────────────────────────────────
// Sync Tool
// ─────────────────────────────────────────────────────────────
export async function triggerEntitySync(): Promise<SyncResult> {
  const startTime = Date.now();

  try {
    const entities = await fetchAllEntities();

    if (entities.length === 0) {
      console.warn("⚠️  No entities fetched from sources");
      return {
        success: true,
        entitiesProcessed: 0,
        entitiesInserted: 0,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        duration: Date.now() - startTime,
      };
    }

    const chunks = createChunksForEntities(entities);
    const embeddings = await generateChunkEmbeddings(chunks);
    const entityChunkMap = createEntityChunkMap(chunks);
    const stats = await syncRepo.processAndInsertEntities(
      entities,
      chunks,
      embeddings,
      entityChunkMap
    );

    const duration = Date.now() - startTime;

    return {
      success: true,
      entitiesProcessed: entities.length,
      entitiesInserted: stats.inserted,
      chunksCreated: stats.totalChunks,
      embeddingsGenerated: stats.totalChunks,
      duration,
    };
  } catch (error) {
    console.error("Failed to trigger entity sync:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      duration: Date.now() - startTime,
    };
  }
}


// ─────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────
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


// ─────────────────────────────────────────────────────────────
// Tool Executor
// ─────────────────────────────────────────────────────────────
export async function executeSyncTool(toolName: string): Promise<SyncResult> {
  switch (toolName) {
    case "trigger_entity_sync":
    case "trigger_feed_sync":
      return triggerEntitySync();
    default:
      throw new Error(`Unknown sync tool: ${toolName}`);
  }
}

