import { ipcMain } from "electron";
import { workspaceDiffsService } from "./workspaceDiffs.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerWorkspaceDiffsIpc(): void {
  ipcMain.handle(
    CHANNELS.workspaceDiffs.getByWorkspace,
    async (_, workspaceId: string, limit?: number) => {
      return workspaceDiffsService.getByWorkspace(workspaceId, limit);
    },
  );

  ipcMain.handle(CHANNELS.workspaceDiffs.getLatest, async (_, workspaceId: string) => {
    return workspaceDiffsService.getLatest(workspaceId);
  });

  ipcMain.handle(
    CHANNELS.workspaceDiffs.getLatestSummary,
    async (_, workspaceId: string) => {
      return workspaceDiffsService.getLatestSummary(workspaceId);
    },
  );

  ipcMain.handle(CHANNELS.workspaceDiffs.getByRun, async (_, runId: string) => {
    return workspaceDiffsService.getByRun(runId);
  });

  ipcMain.handle(CHANNELS.workspaceDiffs.deleteLatest, async (_, workspaceId: string) => {
    return workspaceDiffsService.deleteLatest(workspaceId);
  });
}

export function unregisterWorkspaceDiffsIpc(): void {
  [
    CHANNELS.workspaceDiffs.getByWorkspace,
    CHANNELS.workspaceDiffs.getLatest,
    CHANNELS.workspaceDiffs.getLatestSummary,
    CHANNELS.workspaceDiffs.getByRun,
    CHANNELS.workspaceDiffs.deleteLatest,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
