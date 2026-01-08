import { ipcMain } from "electron";
import { executeFeedTool, FEED_TOOLS } from "../../renderer/lib/mcp";

/**
 * Register all IPC handlers for MCP (Model Context Protocol) operations
 */
export function registerMcpHandlers() {
  // List available MCP tools
  ipcMain.handle("mcp:listTools", async () => {
    try {
      const tools = FEED_TOOLS.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      }));

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

      const result = await executeFeedTool(name, toolParams || {});

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
}
