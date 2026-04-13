import { ipcMain } from "electron";
import { workspaceDiffsController } from "./workspaceDiffs.controller";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  GET_BY_WORKSPACE: "workspaceDiffs:getByWorkspace",
  GET_LATEST: "workspaceDiffs:getLatest",
  GET_BY_RUN: "workspaceDiffs:getByRun",
  DELETE_LATEST: "workspaceDiffs:deleteLatest",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerWorkspaceDiffsIpc(): void {
  ipcMain.handle(
    CHANNELS.GET_BY_WORKSPACE,
    async (_, workspaceId: string, limit?: number) => {
      return workspaceDiffsController.getByWorkspace(workspaceId, limit);
    },
  );

  ipcMain.handle(CHANNELS.GET_LATEST, async (_, workspaceId: string) => {
    return workspaceDiffsController.getLatest(workspaceId);
  });

  ipcMain.handle(CHANNELS.GET_BY_RUN, async (_, runId: string) => {
    return workspaceDiffsController.getByRun(runId);
  });

  ipcMain.handle(CHANNELS.DELETE_LATEST, async (_, workspaceId: string) => {
    return workspaceDiffsController.deleteLatest(workspaceId);
  });
}

export function unregisterWorkspaceDiffsIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
