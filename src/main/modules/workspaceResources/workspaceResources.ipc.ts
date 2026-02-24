import { ipcMain } from "electron";
import { workspaceResourcesController } from "./workspaceResources.controller";
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
      return workspaceResourcesController.getByProject(projectId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_AVAILABLE,
    async (_event, projectId: string) => {
      return workspaceResourcesController.getAvailableResources(projectId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ADD_RESOURCE,
    async (_event, payload: AddResourcePayload) => {
      return workspaceResourcesController.addResource(payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.REMOVE_RESOURCE,
    async (_event, payload: RemoveResourcePayload) => {
      return workspaceResourcesController.removeResource(payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_ISSUES,
    async (_event, projectId: string) => {
      return workspaceResourcesController.getIssuesByProject(projectId);
    }
  );

  console.log("Project resources handlers registered");
}

export function unregisterWorkspaceResourcesHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.GET_BY_PROJECT);
  ipcMain.removeHandler(IPC_CHANNELS.GET_AVAILABLE);
  ipcMain.removeHandler(IPC_CHANNELS.ADD_RESOURCE);
  ipcMain.removeHandler(IPC_CHANNELS.REMOVE_RESOURCE);
  ipcMain.removeHandler(IPC_CHANNELS.GET_ISSUES);
}
