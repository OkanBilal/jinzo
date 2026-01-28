import {
  ENTITY_TOOLS,
  SYNC_TOOLS,
  MOOD_TOOLS,
  JOURNAL_TOOLS,
  executeEntityTool,
  executeSyncTool,
  executeMoodTool,
  executeJournalTool,
} from "./tools";
import type { OllamaToolDefinition, MCPToolResponse } from "./mcp.dto";

// ─────────────────────────────────────────────────────────────
// MCP Client - Provides unified access to all MCP tools
// ─────────────────────────────────────────────────────────────
export class FeedMCPClient {
  getTools(): OllamaToolDefinition[] {
    return [
      ...ENTITY_TOOLS,
      ...SYNC_TOOLS,
      ...MOOD_TOOLS,
      ...JOURNAL_TOOLS,
    ];
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    try {
      // Sync tools
      if (toolName === "trigger_entity_sync" || toolName === "trigger_feed_sync") {
        return await executeSyncTool(toolName);
      }
      
      // Mood tools
      if (toolName === "switch_to_journal_mood" || toolName === "switch_to_chat_mood") {
        return await executeMoodTool(toolName);
      }
      
      // Journal tools
      if (toolName === "append_to_journal" || toolName === "update_journal_title") {
        return await executeJournalTool(toolName, params as { text?: string; title?: string });
      }
      
      // Entity tools (entity_list, entity_search, feed_list, feed_search)
      return await executeEntityTool(toolName, params);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Tool execution failed: ${message}`);
    }
  }

  getTool(toolName: string): OllamaToolDefinition | undefined {
    const allTools = this.getTools();
    return allTools.find((tool) => tool.function.name === toolName);
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────
let mcpClientInstance: FeedMCPClient | null = null;

export function getMCPClient(): FeedMCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new FeedMCPClient();
  }
  return mcpClientInstance;
}

// ─────────────────────────────────────────────────────────────
// Legacy exports for backwards compatibility
// ─────────────────────────────────────────────────────────────
export {
  // Entity tools
  executeEntityTool,
  ENTITY_TOOLS,
  
  // Sync tools
  executeSyncTool,
  SYNC_TOOLS,
  
  // Mood tools
  executeMoodTool,
  MOOD_TOOLS,
  
  // Journal tools
  executeJournalTool,
  JOURNAL_TOOLS,
};
