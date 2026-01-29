import { ipcMain } from "electron";
import { workspaceResourcesController } from "./workspaceResources.controller";
import type { AddResourcePayload, RemoveResourcePayload } from "./workspaceResources.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Constants
// ─────────────────────────────────────────────────────────────

const IPC_CHANNELS = {
  GET_BY_WORKSPACE: "workspaceResources:getByWorkspace",
  GET_AVAILABLE: "workspaceResources:getAvailable",
  ADD_RESOURCE: "workspaceResources:add",
  REMOVE_RESOURCE: "workspaceResources:remove",
  GET_ISSUES: "workspaceResources:getIssues",
} as const;

// ─────────────────────────────────────────────────────────────
// Register Handlers
// ─────────────────────────────────────────────────────────────

export function registerWorkspaceResourcesHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.GET_BY_WORKSPACE,
    async (_event, workspaceId: string) => {
      return workspaceResourcesController.getByWorkspace(workspaceId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_AVAILABLE,
    async (_event, workspaceId: string) => {
      return workspaceResourcesController.getAvailableResources(workspaceId);
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
    async (_event, workspaceId: string) => {
      return workspaceResourcesController.getIssuesByWorkspace(workspaceId);
    }
  );

  console.log("Workspace resources handlers registered");
}

export function unregisterWorkspaceResourcesHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.GET_BY_WORKSPACE);
  ipcMain.removeHandler(IPC_CHANNELS.GET_AVAILABLE);
  ipcMain.removeHandler(IPC_CHANNELS.ADD_RESOURCE);
  ipcMain.removeHandler(IPC_CHANNELS.REMOVE_RESOURCE);
  ipcMain.removeHandler(IPC_CHANNELS.GET_ISSUES);
}
