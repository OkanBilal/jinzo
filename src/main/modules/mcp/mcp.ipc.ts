import { ipcMain } from "electron";
import { mcpController } from "./mcp.controller";
import type { CallToolPayload } from "./mcp.dto";

// ─────────────────────────────────────────────────────────────
// MCP IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerMcpHandlers() {
  // List available MCP tools
  ipcMain.handle("mcp:listTools", async () => {
    return mcpController.listTools();
  });

  // Execute an MCP tool
  ipcMain.handle("mcp:callTool", async (_, payload: CallToolPayload) => {
    return mcpController.callTool(payload);
  });

}

export function unregisterMcpHandlers() {
  ipcMain.removeHandler("mcp:listTools");
  ipcMain.removeHandler("mcp:callTool");
}
