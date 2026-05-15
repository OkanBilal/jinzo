import { ipcMain } from "electron";
import { connectionsService } from "./connections.service";
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
  GET_TRELLO_BOARDS: "connections:getTrelloBoards",
  GET_SENTRY_PROJECTS: "connections:getSentryProjects",
  GET_SOCKETDEV_ORGS: "connections:getSocketDevOrganizations",
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
      return connectionsService.getGithubRepos(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_LINEAR_TEAMS,
    async (_event, connectionId: string) => {
      return connectionsService.getLinearTeams(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_JIRA_PROJECTS,
    async (_event, connectionId: string) => {
      return connectionsService.getJiraProjects(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_ASANA_PROJECTS,
    async (_event, connectionId: string) => {
      return connectionsService.getAsanaProjects(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_GITLAB_PROJECTS,
    async (_event, connectionId: string) => {
      return connectionsService.getGitlabProjects(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_TRELLO_BOARDS,
    async (_event, connectionId: string) => {
      return connectionsService.getTrelloBoards(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_SENTRY_PROJECTS,
    async (_event, connectionId: string) => {
      return connectionsService.getSentryProjects(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_SOCKETDEV_ORGS,
    async (_event, connectionId: string) => {
      return connectionsService.getSocketDevOrganizations(connectionId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SAVE_RESOURCES,
    async (_event, payload: SaveResourcesPayload) => {
      return connectionsService.saveResources(payload);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.REMOVE_RESOURCE,
    async (_event, resourceId: string) => {
      return connectionsService.removeResource(resourceId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_BY_PROVIDER,
    async (_event, provider: string) => {
      return connectionsService.getByProvider(provider);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_SELECTED_RESOURCES,
    async (_event, provider: string) => {
      return connectionsService.getSelectedResources(provider);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DELETE_RESOURCE,
    async (_event, resourceId: string) => {
      return connectionsService.deleteResource(resourceId);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.REVOKE,
    async (_event, provider: string) => {
      return connectionsService.revoke(provider);
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
