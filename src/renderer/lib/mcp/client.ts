import { executeEntityTool, ENTITY_TOOLS } from "./tools/feed-tools";
import { executeSyncTool, SYNC_TOOLS } from "./tools/cron-tools";
import { executeMoodTool, MOOD_TOOLS } from "./tools/mood-tools";
import type { OllamaToolDefinition } from "./types";

export class FeedMCPClient {
  getTools(): OllamaToolDefinition[] {
    return [...ENTITY_TOOLS, ...SYNC_TOOLS, ...MOOD_TOOLS];
  }

  async executeTool(toolName: string, params: any): Promise<any> {
    try {
      // Check if it's a sync tool
      if (toolName === 'trigger_entity_sync' || toolName === 'trigger_feed_sync') {
        return await executeSyncTool(toolName, params);
      }
      // Check if it's a mood tool
      if (toolName === 'switch_to_writing_mood' || toolName === 'switch_to_chat_mood') {
        return await executeMoodTool(toolName, params);
      }
      // Otherwise it's an entity tool (entity_list, entity_search, feed_list, feed_search)
      return await executeEntityTool(toolName, params);
    } catch (error: any) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  getTool(toolName: string): OllamaToolDefinition | undefined {
    return [...ENTITY_TOOLS, ...SYNC_TOOLS, ...MOOD_TOOLS].find((tool) => tool.function.name === toolName);
  }
}

let mcpClientInstance: FeedMCPClient | null = null;

export function getMCPClient(): FeedMCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new FeedMCPClient();
  }
  return mcpClientInstance;
}
