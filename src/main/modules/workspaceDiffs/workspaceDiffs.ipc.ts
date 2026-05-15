import { ipcMain } from "electron";
import { workspaceDiffsService } from "./workspaceDiffs.service";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  GET_BY_WORKSPACE: "workspaceDiffs:getByWorkspace",
  GET_LATEST: "workspaceDiffs:getLatest",
  GET_LATEST_SUMMARY: "workspaceDiffs:getLatestSummary",
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
      return workspaceDiffsService.getByWorkspace(workspaceId, limit);
    },
  );

  ipcMain.handle(CHANNELS.GET_LATEST, async (_, workspaceId: string) => {
    return workspaceDiffsService.getLatest(workspaceId);
  });

  ipcMain.handle(
    CHANNELS.GET_LATEST_SUMMARY,
    async (_, workspaceId: string) => {
      return workspaceDiffsService.getLatestSummary(workspaceId);
    },
  );

  ipcMain.handle(CHANNELS.GET_BY_RUN, async (_, runId: string) => {
    return workspaceDiffsService.getByRun(runId);
  });

  ipcMain.handle(CHANNELS.DELETE_LATEST, async (_, workspaceId: string) => {
    return workspaceDiffsService.deleteLatest(workspaceId);
  });
}

export function unregisterWorkspaceDiffsIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
