import { ipcMain } from "electron";
import { workspaceActivityController } from "./workspaceActivity.controller";
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
      return workspaceActivityController.getByWorkspace(workspaceId, limit);
    },
  );

  ipcMain.handle(
    CHANNELS.CREATE,
    async (_, payload: CreateActivityPayload) => {
      return workspaceActivityController.create(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.CREATE_MANY,
    async (_, payloads: CreateActivityPayload[]) => {
      return workspaceActivityController.createMany(payloads);
    },
  );

  ipcMain.handle(CHANNELS.DELETE, async (_, id: string) => {
    return workspaceActivityController.delete(id);
  });
}

export function unregisterWorkspaceActivityIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
