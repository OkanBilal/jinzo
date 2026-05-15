import { ipcMain } from "electron";
import { workspaceResourcesService } from "./workspaceResources.service";
import type { AddResourcePayload, RemoveResourcePayload } from "./workspaceResources.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Constants
// ─────────────────────────────────────────────────────────────

const IPC_CHANNELS = {
  GET_BY_PROJECT: "projectResources:getByProject",
  GET_AVAILABLE: "projectResources:getAvailable",
  ADD_RESOURCE: "projectResources:add",
  REMOVE_RESOURCE: "projectResources:remove",
  GET_ISSUES: "projectResources:getIssues",
} as const;

// ─────────────────────────────────────────────────────────────
// Register Handlers
// ─────────────────────────────────────────────────────────────

export function registerWorkspaceResourcesHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.GET_BY_PROJECT,
    async (_event, projectId: string) => {
      return workspaceResourcesService.getByProject(projectId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_AVAILABLE,
    async (_event, projectId: string) => {
      return workspaceResourcesService.getAvailableResources(projectId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ADD_RESOURCE,
    async (_event, payload: AddResourcePayload) => {
      return workspaceResourcesService.addResource(payload.projectId, payload.resourceId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.REMOVE_RESOURCE,
    async (_event, payload: RemoveResourcePayload) => {
      return workspaceResourcesService.removeResource(payload.projectId, payload.resourceId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_ISSUES,
    async (_event, projectId: string) => {
      return workspaceResourcesService.getIssuesByProject(projectId);
    }
  );

}

export function unregisterWorkspaceResourcesHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.GET_BY_PROJECT);
  ipcMain.removeHandler(IPC_CHANNELS.GET_AVAILABLE);
  ipcMain.removeHandler(IPC_CHANNELS.ADD_RESOURCE);
  ipcMain.removeHandler(IPC_CHANNELS.REMOVE_RESOURCE);
  ipcMain.removeHandler(IPC_CHANNELS.GET_ISSUES);
}
