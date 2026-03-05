import { ipcMain } from "electron";
import { connectionsController } from "./connections.controller";
import type { SaveResourcesPayload } from "./connections.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Constants
// ─────────────────────────────────────────────────────────────
const IPC_CHANNELS = {
  GET_GITHUB_REPOS: "connections:getGithubRepos",
  GET_LINEAR_TEAMS: "connections:getLinearTeams",
  GET_JIRA_PROJECTS: "connections:getJiraProjects",
  GET_ASANA_PROJECTS: "connections:getAsanaProjects",
  GET_GITLAB_PROJECTS: "connections:getGitlabProjects",
  SAVE_RESOURCES: "connections:saveResources",
  REMOVE_RESOURCE: "connections:removeResource",
  GET_BY_PROVIDER: "connections:getByProvider",
  GET_SELECTED_RESOURCES: "connections:getSelectedResources",
  DELETE_RESOURCE: "connections:deleteResource",
  REVOKE: "connections:revoke",
} as const;

// ─────────────────────────────────────────────────────────────
// Register Handlers
// ─────────────────────────────────────────────────────────────
export function registerConnectionsHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.GET_GITHUB_REPOS,
    async (_event, connectionId: string) => {
      return connectionsController.getGithubRepos(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_LINEAR_TEAMS,
    async (_event, connectionId: string) => {
      return connectionsController.getLinearTeams(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_JIRA_PROJECTS,
    async (_event, connectionId: string) => {
      return connectionsController.getJiraProjects(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_ASANA_PROJECTS,
    async (_event, connectionId: string) => {
      return connectionsController.getAsanaProjects(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_GITLAB_PROJECTS,
    async (_event, connectionId: string) => {
      return connectionsController.getGitlabProjects(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SAVE_RESOURCES,
    async (_event, payload: SaveResourcesPayload) => {
      return connectionsController.saveResources(payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.REMOVE_RESOURCE,
    async (_event, resourceId: string) => {
      return connectionsController.removeResource(resourceId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_BY_PROVIDER,
    async (_event, provider: string) => {
      return connectionsController.getByProvider(provider);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_SELECTED_RESOURCES,
    async (_event, provider: string) => {
      return connectionsController.getSelectedResources(provider);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DELETE_RESOURCE,
    async (_event, resourceId: string) => {
      return connectionsController.deleteResource(resourceId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.REVOKE,
    async (_event, provider: string) => {
      return connectionsController.revoke(provider);
    }
  );
}

// ─────────────────────────────────────────────────────────────
// Unregister Handlers
// ─────────────────────────────────────────────────────────────
export function unregisterConnectionsHandlers(): void {
  Object.values(IPC_CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
