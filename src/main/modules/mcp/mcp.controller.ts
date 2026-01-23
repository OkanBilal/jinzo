import { mcpService } from "./mcp.service";
import type { CallToolPayload } from "./mcp.dto";

// ─────────────────────────────────────────────────────────────
// MCP Controller - Maps IPC calls to service methods
// ─────────────────────────────────────────────────────────────
export const mcpController = {
  async listTools() {
    return mcpService.listTools();
  },

  async callTool(payload: CallToolPayload) {
    const { name, arguments: toolArgs } = payload;
    return mcpService.callTool(name, toolArgs);
  },
};
