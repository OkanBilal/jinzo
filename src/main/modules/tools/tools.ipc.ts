import { ipcMain } from "electron";
import { toolsService } from "./tools.service";
import type {
  CreateToolCallPayload,
  UpdateToolCallPayload,
} from "./tools.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  // Tool Calls
  TOOL_CALLS_GET_BY_RUN: "toolCalls:getByRun",
  TOOL_CALLS_GET_BY_ACCOUNT: "toolCalls:getByAccount",
  TOOL_CALLS_CREATE: "toolCalls:create",
  TOOL_CALLS_UPDATE: "toolCalls:update",
  TOOL_CALLS_START: "toolCalls:start",
  TOOL_CALLS_COMPLETE: "toolCalls:complete",
  TOOL_CALLS_FAIL: "toolCalls:fail",

} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerToolsIpc(): void {
  // Tool Calls
  ipcMain.handle(CHANNELS.TOOL_CALLS_GET_BY_RUN, async (_, runId: string) => {
    return toolsService.getToolCallsByRun(runId);
  });

  ipcMain.handle(
    CHANNELS.TOOL_CALLS_GET_BY_ACCOUNT,
    async (_, accountId: string, limit?: number) => {
      return toolsService.getToolCallsByAccount(accountId, limit);
    }
  );

  ipcMain.handle(CHANNELS.TOOL_CALLS_CREATE, async (_, payload: CreateToolCallPayload) => {
    return toolsService.createToolCall(payload);
  });

  ipcMain.handle(
    CHANNELS.TOOL_CALLS_UPDATE,
    async (_, id: number, payload: UpdateToolCallPayload) => {
      return toolsService.updateToolCall(id, payload);
    }
  );

  ipcMain.handle(CHANNELS.TOOL_CALLS_START, async (_, id: number) => {
    return toolsService.startToolCall(id);
  });

  ipcMain.handle(
    CHANNELS.TOOL_CALLS_COMPLETE,
    async (_, id: number, output: Record<string, unknown>, latencyMs?: number) => {
      return toolsService.completeToolCall(id, output, latencyMs);
    }
  );

  ipcMain.handle(CHANNELS.TOOL_CALLS_FAIL, async (_, id: number, error: string) => {
    return toolsService.failToolCall(id, error);
  });

}

export function unregisterToolsIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
