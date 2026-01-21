import { ipcMain } from "electron";

import {
  getAllTools,
  formatToolsForResponse,
  isSyncTool,
  isMoodTool,
} from "./utils";
import {
  executeSyncTool,
  executeMoodTool,
  executeEntityTool,
} from "./utils/index";


/**
 * Register all IPC handlers for MCP (Model Context Protocol) operations
 */
export function registerMcpHandlers() {
  // List available MCP tools
  ipcMain.handle("mcp:listTools", async () => {
    try {
      const allTools = getAllTools();
      const tools = formatToolsForResponse(allTools);

      return { success: true, data: { tools } };
    } catch (error) {
      console.error("Error listing MCP tools:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to list tools";
      return { success: false, error: errorMessage };
    }
  });

  // Execute an MCP tool
  ipcMain.handle("mcp:callTool", async (_, payload: { name: string; arguments?: any }) => {
    try {
      const { name, arguments: toolParams } = payload;

      if (!name || typeof name !== "string") {
        return { success: false, error: "Tool name is required" };
      }

      // Route to appropriate tool executor based on tool name
      let result;
      if (isSyncTool(name)) {
        result = await executeSyncTool(name);
      } else if (isMoodTool(name)) {
        result = await executeMoodTool(name);
      } else {
        // Default to entity tools (entity_list, entity_search, feed_list, feed_search)
        result = await executeEntityTool(name, toolParams || {});
      }

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
    } catch (error: any) {
      console.error("MCP tool execution error:", error);
      return {
        success: false,
        error: error.message || "Tool execution failed",
        data: {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error.message || "Tool execution failed",
              }),
            },
          ],
          isError: true,
        },
      };
    }
  });

  console.log("MCP handlers registered");
}

export function unregisterMcpHandlers() {
  ipcMain.removeHandler("mcp:listTools");
  ipcMain.removeHandler("mcp:callTool");
}
