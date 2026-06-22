import { ipcMain } from "../../ipc-kit/ipc-main";
import { connectionsService } from "./connections.service";
import type {
  SaveResourcesPayload,
  SaveCredentialsPayload,
} from "./connections.dto";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// Register Handlers
// ─────────────────────────────────────────────────────────────
export function registerConnectionsHandlers(): void {
  ipcMain.handle(CHANNELS.connections.listStates, () =>
    connectionsService.listStates(),
  );

  ipcMain.handle(
    CHANNELS.connections.updateState,
    async (_event, id: unknown, payload: unknown) => {
      return connectionsService.updateState(id, payload);
    },
  );

  ipcMain.handle(
    CHANNELS.connections.saveCredentials,
    async (_event, payload: SaveCredentialsPayload) => {
      return connectionsService.saveCredentials(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.connections.checkCredentials,
    async (_event, provider: string) => {
      return connectionsService.checkCredentials(provider);
    },
  );

  ipcMain.handle(
    CHANNELS.connections.getGithubRepos,
    async (_event, connectionId: string) => {
      return connectionsService.getGithubRepos(connectionId);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.getLinearTeams,
    async (_event, connectionId: string) => {
      return connectionsService.getLinearTeams(connectionId);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.getJiraProjects,
    async (_event, connectionId: string) => {
      return connectionsService.getJiraProjects(connectionId);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.getAsanaProjects,
    async (_event, connectionId: string) => {
      return connectionsService.getAsanaProjects(connectionId);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.getGitlabProjects,
    async (_event, connectionId: string) => {
      return connectionsService.getGitlabProjects(connectionId);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.getTrelloBoards,
    async (_event, connectionId: string) => {
      return connectionsService.getTrelloBoards(connectionId);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.getSentryProjects,
    async (_event, connectionId: string) => {
      return connectionsService.getSentryProjects(connectionId);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.getSocketDevOrganizations,
    async (_event, connectionId: string) => {
      return connectionsService.getSocketDevOrganizations(connectionId);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.saveResources,
    async (_event, payload: SaveResourcesPayload) => {
      return connectionsService.saveResources(payload);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.removeResource,
    async (_event, resourceId: string) => {
      return connectionsService.removeResource(resourceId);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.getByProvider,
    async (_event, provider: string) => {
      return connectionsService.getByProvider(provider);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.getSelectedResources,
    async (_event, provider: string) => {
      return connectionsService.getSelectedResources(provider);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.deleteResource,
    async (_event, resourceId: string) => {
      return connectionsService.deleteResource(resourceId);
    }
  );

  ipcMain.handle(
    CHANNELS.connections.revoke,
    async (_event, provider: string) => {
      return connectionsService.revoke(provider);
    }
  );
}

// ─────────────────────────────────────────────────────────────
// Unregister Handlers
// ─────────────────────────────────────────────────────────────
export function unregisterConnectionsHandlers(): void {
  [
    CHANNELS.connections.listStates,
    CHANNELS.connections.updateState,
    CHANNELS.connections.saveCredentials,
    CHANNELS.connections.checkCredentials,
    CHANNELS.connections.getGithubRepos,
    CHANNELS.connections.getLinearTeams,
    CHANNELS.connections.getJiraProjects,
    CHANNELS.connections.getAsanaProjects,
    CHANNELS.connections.getGitlabProjects,
    CHANNELS.connections.getTrelloBoards,
    CHANNELS.connections.getSentryProjects,
    CHANNELS.connections.getSocketDevOrganizations,
    CHANNELS.connections.saveResources,
    CHANNELS.connections.removeResource,
    CHANNELS.connections.getByProvider,
    CHANNELS.connections.getSelectedResources,
    CHANNELS.connections.deleteResource,
    CHANNELS.connections.revoke,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
