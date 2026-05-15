import { ipcMain } from "electron";
import { workspaceActivityService } from "./workspaceActivity.service";
import type { CreateActivityPayload } from "./workspaceActivity.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  GET_BY_WORKSPACE: "workspaceActivity:getByWorkspace",
  CREATE: "workspaceActivity:create",
  CREATE_MANY: "workspaceActivity:createMany",
  DELETE: "workspaceActivity:delete",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerWorkspaceActivityIpc(): void {
  ipcMain.handle(
    CHANNELS.GET_BY_WORKSPACE,
    async (_, workspaceId: string, limit?: number) => {
      return workspaceActivityService.getByWorkspace(workspaceId, limit);
    },
  );

  ipcMain.handle(
    CHANNELS.CREATE,
    async (_, payload: CreateActivityPayload) => {
      return workspaceActivityService.create(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.CREATE_MANY,
    async (_, payloads: CreateActivityPayload[]) => {
      return workspaceActivityService.createMany(payloads);
    },
  );

  ipcMain.handle(CHANNELS.DELETE, async (_, id: string) => {
    return workspaceActivityService.delete(id);
  });
}

export function unregisterWorkspaceActivityIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
