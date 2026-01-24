import { ipcMain } from "electron";
import { workspacesController } from "./workspaces.controller";
import type { CreateWorkspacePayload, UpdateWorkspacePayload } from "./workspaces.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  GET_ALL: "workspaces:getAll",
  GET_BY_ID: "workspaces:getById",
  GET_BY_ACCOUNT: "workspaces:getByAccount",
  GET_BY_ROOT_PATH: "workspaces:getByRootPath",
  CREATE: "workspaces:create",
  UPDATE: "workspaces:update",
  DELETE: "workspaces:delete",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerWorkspacesIpc(): void {
  ipcMain.handle(CHANNELS.GET_ALL, async () => {
    return workspacesController.getAll();
  });

  ipcMain.handle(CHANNELS.GET_BY_ID, async (_, id: string) => {
    return workspacesController.getById(id);
  });

  ipcMain.handle(CHANNELS.GET_BY_ACCOUNT, async (_, accountId: string) => {
    return workspacesController.getByAccountId(accountId);
  });

  ipcMain.handle(CHANNELS.GET_BY_ROOT_PATH, async (_, accountId: string, rootPath: string) => {
    return workspacesController.getByRootPath(accountId, rootPath);
  });

  ipcMain.handle(CHANNELS.CREATE, async (_, payload: CreateWorkspacePayload) => {
    return workspacesController.create(payload);
  });

  ipcMain.handle(CHANNELS.UPDATE, async (_, id: string, payload: UpdateWorkspacePayload) => {
    return workspacesController.update(id, payload);
  });

  ipcMain.handle(CHANNELS.DELETE, async (_, id: string) => {
    return workspacesController.delete(id);
  });
}

export function unregisterWorkspacesIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
