import { executeFeedTool, FEED_TOOLS } from "./tools/feed-tools";
import type { OllamaToolDefinition } from "./types";

export class FeedMCPClient {
  getTools(): OllamaToolDefinition[] {
    return FEED_TOOLS;
  }

  async executeTool(toolName: string, params: any): Promise<any> {
    try {
      return await executeFeedTool(toolName, params);
    } catch (error: any) {
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  getTool(toolName: string): OllamaToolDefinition | undefined {
    return FEED_TOOLS.find((tool) => tool.function.name === toolName);
  }
}

let mcpClientInstance: FeedMCPClient | null = null;

export function getMCPClient(): FeedMCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new FeedMCPClient();
  }
  return mcpClientInstance;
}
