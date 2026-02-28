import {
  ENTITY_TOOLS,
  SYNC_TOOLS,
  SPACE_TOOLS,
  JOURNAL_TOOLS,
  executeEntityTool,
  executeSyncTool,
  executeSpaceTool,
  executeJournalTool,
} from "./tools";
import type { OllamaToolDefinition, FormattedTool } from "./mcp.dto";
import { isSyncTool, isSpaceTool, isJournalTool } from "./mcp.helpers";

// ─────────────────────────────────────────────────────────────
// Tool Registry
// ─────────────────────────────────────────────────────────────
export function getAllTools(): OllamaToolDefinition[] {
  return [
    ...ENTITY_TOOLS,
    ...SYNC_TOOLS,
    ...SPACE_TOOLS,
    ...JOURNAL_TOOLS,
  ];
}

export function formatToolsForResponse(tools: OllamaToolDefinition[]): FormattedTool[] {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    inputSchema: tool.function.parameters,
  }));
}

export function getToolByName(toolName: string): OllamaToolDefinition | undefined {
  return getAllTools().find((tool) => tool.function.name === toolName);
}

// ─────────────────────────────────────────────────────────────
// Tool Execution Router
// ─────────────────────────────────────────────────────────────
export async function executeToolByName(
  toolName: string,
  params: Record<string, unknown>
): Promise<unknown> {
  if (isSyncTool(toolName)) {
    return await executeSyncTool(toolName);
  }
  
  if (isSpaceTool(toolName)) {
    return await executeSpaceTool(toolName);
  }
  
  if (isJournalTool(toolName)) {
    return await executeJournalTool(toolName, params as { text?: string });
  }
  
  // Default to entity tools
  return await executeEntityTool(toolName, params);
}

// ─────────────────────────────────────────────────────────────
// Service Response Types
// ─────────────────────────────────────────────────────────────
interface ListToolsResponse {
  success: boolean;
  data?: { tools: FormattedTool[] };
  error?: string;
}

interface CallToolResponse {
  success: boolean;
  data?: {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  };
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// MCP Service
// ─────────────────────────────────────────────────────────────
export const mcpService = {
  async listTools(): Promise<ListToolsResponse> {
    try {
      const allTools = getAllTools();
      const tools = formatToolsForResponse(allTools);
      
      return { success: true, data: { tools } };
    } catch (error) {
      console.error("Error listing MCP tools:", error);
      const message = error instanceof Error ? error.message : "Failed to list tools";
      return { success: false, error: message };
    }
  },

  async callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResponse> {
    try {
      if (!name || typeof name !== "string") {
        return { success: false, error: "Tool name is required" };
      }

      const result = await executeToolByName(name, args || {});

      return {
        success: true,
        data: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      console.error("MCP tool execution error:", error);
      const message = error instanceof Error ? error.message : "Tool execution failed";
      
      return {
        success: false,
        error: message,
        data: {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: message }),
            },
          ],
          isError: true,
        },
      };
    }
  },
};
