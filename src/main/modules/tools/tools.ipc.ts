import { ipcMain } from "electron";
import { toolsService } from "./tools.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import type {
  CreateToolCallPayload,
  UpdateToolCallPayload,
} from "./tools.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerToolsIpc(): void {
  // Tool Calls
  ipcMain.handle(CHANNELS.toolCalls.getByRun, async (_, runId: string) => {
    return toolsService.getToolCallsByRun(runId);
  });

  ipcMain.handle(
    CHANNELS.toolCalls.getByAccount,
    async (_, accountId: string, limit?: number) => {
      return toolsService.getToolCallsByAccount(accountId, limit);
    }
  );

  ipcMain.handle(CHANNELS.toolCalls.create, async (_, payload: CreateToolCallPayload) => {
    return toolsService.createToolCall(payload);
  });

  ipcMain.handle(
    CHANNELS.toolCalls.update,
    async (_, id: number, payload: UpdateToolCallPayload) => {
      return toolsService.updateToolCall(id, payload);
    }
  );

  ipcMain.handle(CHANNELS.toolCalls.start, async (_, id: number) => {
    return toolsService.startToolCall(id);
  });

  ipcMain.handle(
    CHANNELS.toolCalls.complete,
    async (_, id: number, output: Record<string, unknown>, latencyMs?: number) => {
      return toolsService.completeToolCall(id, output, latencyMs);
    }
  );

  ipcMain.handle(CHANNELS.toolCalls.fail, async (_, id: number, error: string) => {
    return toolsService.failToolCall(id, error);
  });

}

export function unregisterToolsIpc(): void {
  [
    CHANNELS.toolCalls.getByRun,
    CHANNELS.toolCalls.getByAccount,
    CHANNELS.toolCalls.create,
    CHANNELS.toolCalls.update,
    CHANNELS.toolCalls.start,
    CHANNELS.toolCalls.complete,
    CHANNELS.toolCalls.fail,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
