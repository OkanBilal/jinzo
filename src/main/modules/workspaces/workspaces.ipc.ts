import { ok } from "../../../shared/ipc-kit/service-response";
import { ipcMain, dialog, BrowserWindow } from "electron";
import { workspacesService } from "./workspaces.service";
import type { CreateWorkspacePayload, UpdateWorkspacePayload } from "./workspaces.dto";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerWorkspacesIpc(): void {
  ipcMain.handle(CHANNELS.workspaces.getAll, async () => {
    return workspacesService.getAll();
  });

  ipcMain.handle(CHANNELS.workspaces.getById, async (_, id: string) => {
    return workspacesService.getById(id);
  });

  ipcMain.handle(CHANNELS.workspaces.getByAccount, async (_, accountId: string) => {
    return workspacesService.getByAccountId(accountId);
  });

  ipcMain.handle(CHANNELS.workspaces.getByRootPath, async (_, accountId: string, rootPath: string) => {
    return workspacesService.getByRootPath(accountId, rootPath);
  });

  ipcMain.handle(CHANNELS.workspaces.create, async (_, payload: CreateWorkspacePayload) => {
    return workspacesService.create(payload);
  });

  ipcMain.handle(CHANNELS.workspaces.update, async (_, id: string, payload: UpdateWorkspacePayload) => {
    return workspacesService.update(id, payload);
  });

  ipcMain.handle(CHANNELS.workspaces.delete, async (_, id: string) => {
    return workspacesService.delete(id);
  });

  ipcMain.handle(CHANNELS.workspaces.archive, async (_, id: string) => {
    return workspacesService.archive(id);
  });

ipcMain.handle(CHANNELS.workspaces.selectDirectory, async () => {
  const window = BrowserWindow.getFocusedWindow();

  const result = window
    ? await dialog.showOpenDialog(window, {
        properties: ["openDirectory"],
        title: "Select Project Folder",
        buttonLabel: "Select",
      })
    : await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "Select Project Folder",
        buttonLabel: "Select",
      });

  if (result.canceled || result.filePaths.length === 0) {
    return ok(null);
  }

  return ok(result.filePaths[0]);
});
}

export function unregisterWorkspacesIpc(): void {
  [
    CHANNELS.workspaces.getAll,
    CHANNELS.workspaces.getById,
    CHANNELS.workspaces.getByAccount,
    CHANNELS.workspaces.getByRootPath,
    CHANNELS.workspaces.create,
    CHANNELS.workspaces.update,
    CHANNELS.workspaces.delete,
    CHANNELS.workspaces.archive,
    CHANNELS.workspaces.selectDirectory,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
