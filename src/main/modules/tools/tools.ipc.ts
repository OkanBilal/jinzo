import { ipcMain } from "electron";
import { toolsController } from "./tools.controller";
import type {
  CreateToolPayload,
  UpdateToolPayload,
  CreateToolCallPayload,
  UpdateToolCallPayload,
  SpaceToolPermissionPayload,
  ToolSource,
} from "./tools.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  // Tools
  TOOLS_GET_ALL: "tools:getAll",
  TOOLS_GET_BY_ID: "tools:getById",
  TOOLS_GET_BY_SOURCE: "tools:getBySource",
  TOOLS_GET_BY_MCP_SERVER: "tools:getByMcpServer",
  TOOLS_GET_ENABLED: "tools:getEnabled",
  TOOLS_CREATE: "tools:create",
  TOOLS_UPDATE: "tools:update",
  TOOLS_DELETE: "tools:delete",

  // Tool Calls
  TOOL_CALLS_GET_BY_RUN: "toolCalls:getByRun",
  TOOL_CALLS_GET_BY_ACCOUNT: "toolCalls:getByAccount",
  TOOL_CALLS_CREATE: "toolCalls:create",
  TOOL_CALLS_UPDATE: "toolCalls:update",
  TOOL_CALLS_START: "toolCalls:start",
  TOOL_CALLS_COMPLETE: "toolCalls:complete",
  TOOL_CALLS_FAIL: "toolCalls:fail",

  // Space Tool Permissions
  PERMISSIONS_GET_BY_SPACE: "toolPermissions:getBySpace",
  PERMISSIONS_SET: "toolPermissions:set",
  PERMISSIONS_REMOVE: "toolPermissions:remove",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerToolsIpc(): void {
  // Tools
  ipcMain.handle(CHANNELS.TOOLS_GET_ALL, async () => {
    return toolsController.getAllTools();
  });

  ipcMain.handle(CHANNELS.TOOLS_GET_BY_ID, async (_, id: string) => {
    return toolsController.getToolById(id);
  });

  ipcMain.handle(CHANNELS.TOOLS_GET_BY_SOURCE, async (_, source: ToolSource) => {
    return toolsController.getToolsBySource(source);
  });

  ipcMain.handle(CHANNELS.TOOLS_GET_BY_MCP_SERVER, async (_, mcpServerId: string) => {
    return toolsController.getToolsByMcpServer(mcpServerId);
  });

  ipcMain.handle(CHANNELS.TOOLS_GET_ENABLED, async () => {
    return toolsController.getEnabledTools();
  });

  ipcMain.handle(CHANNELS.TOOLS_CREATE, async (_, payload: CreateToolPayload) => {
    return toolsController.createTool(payload);
  });

  ipcMain.handle(CHANNELS.TOOLS_UPDATE, async (_, id: string, payload: UpdateToolPayload) => {
    return toolsController.updateTool(id, payload);
  });

  ipcMain.handle(CHANNELS.TOOLS_DELETE, async (_, id: string) => {
    return toolsController.deleteTool(id);
  });

  // Tool Calls
  ipcMain.handle(CHANNELS.TOOL_CALLS_GET_BY_RUN, async (_, runId: string) => {
    return toolsController.getToolCallsByRun(runId);
  });

  ipcMain.handle(
    CHANNELS.TOOL_CALLS_GET_BY_ACCOUNT,
    async (_, accountId: string, limit?: number) => {
      return toolsController.getToolCallsByAccount(accountId, limit);
    }
  );

  ipcMain.handle(CHANNELS.TOOL_CALLS_CREATE, async (_, payload: CreateToolCallPayload) => {
    return toolsController.createToolCall(payload);
  });

  ipcMain.handle(
    CHANNELS.TOOL_CALLS_UPDATE,
    async (_, id: number, payload: UpdateToolCallPayload) => {
      return toolsController.updateToolCall(id, payload);
    }
  );

  ipcMain.handle(CHANNELS.TOOL_CALLS_START, async (_, id: number) => {
    return toolsController.startToolCall(id);
  });

  ipcMain.handle(
    CHANNELS.TOOL_CALLS_COMPLETE,
    async (_, id: number, output: Record<string, unknown>, latencyMs?: number) => {
      return toolsController.completeToolCall(id, output, latencyMs);
    }
  );

  ipcMain.handle(CHANNELS.TOOL_CALLS_FAIL, async (_, id: number, error: string) => {
    return toolsController.failToolCall(id, error);
  });

  //  Space Tool Permissions
  ipcMain.handle(CHANNELS.PERMISSIONS_GET_BY_SPACE, async (_, spaceId: string) => {
    return toolsController.getPermissionsBySpace(spaceId);
  });

  ipcMain.handle(CHANNELS.PERMISSIONS_SET, async (_, payload: SpaceToolPermissionPayload) => {
    return toolsController.setPermission(payload);
  });

  ipcMain.handle(CHANNELS.PERMISSIONS_REMOVE, async (_, spaceId: string, toolId: string) => {
    return toolsController.removePermission(spaceId, toolId);
  });
}

export function unregisterToolsIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
