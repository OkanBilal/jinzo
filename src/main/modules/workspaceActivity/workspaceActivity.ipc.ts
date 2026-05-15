import { ipcMain } from "electron";
import { workspaceActivityService } from "./workspaceActivity.service";
import type { CreateActivityPayload } from "./workspaceActivity.dto";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerWorkspaceActivityIpc(): void {
  ipcMain.handle(
    CHANNELS.workspaceActivity.getByWorkspace,
    async (_, workspaceId: string, limit?: number) => {
      return workspaceActivityService.getByWorkspace(workspaceId, limit);
    },
  );

  ipcMain.handle(
    CHANNELS.workspaceActivity.create,
    async (_, payload: CreateActivityPayload) => {
      return workspaceActivityService.create(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.workspaceActivity.createMany,
    async (_, payloads: CreateActivityPayload[]) => {
      return workspaceActivityService.createMany(payloads);
    },
  );

  ipcMain.handle(CHANNELS.workspaceActivity.delete, async (_, id: string) => {
    return workspaceActivityService.delete(id);
  });
}

export function unregisterWorkspaceActivityIpc(): void {
  [
    CHANNELS.workspaceActivity.getByWorkspace,
    CHANNELS.workspaceActivity.create,
    CHANNELS.workspaceActivity.createMany,
    CHANNELS.workspaceActivity.delete,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
