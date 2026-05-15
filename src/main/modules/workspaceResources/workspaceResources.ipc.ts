import { ipcMain } from "electron";
import { workspaceResourcesService } from "./workspaceResources.service";
import type { AddResourcePayload, RemoveResourcePayload } from "./workspaceResources.dto";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Channel Constants
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Register Handlers
// ─────────────────────────────────────────────────────────────

export function registerWorkspaceResourcesHandlers(): void {
  ipcMain.handle(
    CHANNELS.projectResources.getByProject,
    async (_event, projectId: string) => {
      return workspaceResourcesService.getByProject(projectId);
    }
  );

  ipcMain.handle(
    CHANNELS.projectResources.getAvailable,
    async (_event, projectId: string) => {
      return workspaceResourcesService.getAvailableResources(projectId);
    }
  );

  ipcMain.handle(
    CHANNELS.projectResources.add,
    async (_event, payload: AddResourcePayload) => {
      return workspaceResourcesService.addResource(payload.projectId, payload.resourceId);
    }
  );

  ipcMain.handle(
    CHANNELS.projectResources.remove,
    async (_event, payload: RemoveResourcePayload) => {
      return workspaceResourcesService.removeResource(payload.projectId, payload.resourceId);
    }
  );

  ipcMain.handle(
    CHANNELS.projectResources.getIssues,
    async (_event, projectId: string) => {
      return workspaceResourcesService.getIssuesByProject(projectId);
    }
  );

}

export function unregisterWorkspaceResourcesHandlers(): void {
  ipcMain.removeHandler(CHANNELS.projectResources.getByProject);
  ipcMain.removeHandler(CHANNELS.projectResources.getAvailable);
  ipcMain.removeHandler(CHANNELS.projectResources.add);
  ipcMain.removeHandler(CHANNELS.projectResources.remove);
  ipcMain.removeHandler(CHANNELS.projectResources.getIssues);
}
