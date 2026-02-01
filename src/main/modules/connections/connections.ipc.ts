import { ipcMain } from "electron";
import { connectionsController } from "./connections.controller";
import type { HackerNewsTogglePayload, SaveResourcesPayload } from "./connections.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Constants
// ─────────────────────────────────────────────────────────────
const IPC_CHANNELS = {
  GET_GITHUB_REPOS: "connections:getGithubRepos",
  GET_RAINDROP_COLLECTIONS: "connections:getRaindropCollections",
  GET_LINEAR_TEAMS: "connections:getLinearTeams",
  GET_JIRA_PROJECTS: "connections:getJiraProjects",
  GET_HACKERNEWS_STATUS: "connections:getHackerNewsStatus",
  TOGGLE_HACKERNEWS: "connections:toggleHackerNews",
  SAVE_RESOURCES: "connections:saveResources",
  REMOVE_RESOURCE: "connections:removeResource",
  GET_BY_PROVIDER: "connections:getByProvider",
  GET_SELECTED_RESOURCES: "connections:getSelectedResources",
  GET_RSS_STATUS: "connections:getRssStatus",
  TOGGLE_RSS: "connections:toggleRss",
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
    IPC_CHANNELS.GET_RAINDROP_COLLECTIONS,
    async (_event, connectionId: string) => {
      return connectionsController.getRaindropCollections(connectionId);
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

  ipcMain.handle(IPC_CHANNELS.GET_HACKERNEWS_STATUS, async () => {
    return connectionsController.getHackerNewsStatus();
  });

  ipcMain.handle(
    IPC_CHANNELS.TOGGLE_HACKERNEWS,
    async (_event, payload: HackerNewsTogglePayload) => {
      return connectionsController.toggleHackerNews(payload);
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

  ipcMain.handle(IPC_CHANNELS.GET_RSS_STATUS, async () => {
    return connectionsController.getRssStatus();
  });

  ipcMain.handle(
    IPC_CHANNELS.TOGGLE_RSS,
    async (_event, enabled: boolean) => {
      return connectionsController.toggleRss(enabled);
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
