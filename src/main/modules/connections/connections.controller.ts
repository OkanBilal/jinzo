import { connectionsService } from "./connections.service";
import type { SaveResourcesPayload } from "./connections.dto";

// ─────────────────────────────────────────────────────────────
// Connections Controller
// ─────────────────────────────────────────────────────────────
export const connectionsController = {
  async getGithubRepos(connectionId: string) {
    return connectionsService.getGithubRepos(connectionId);
  },

  async getLinearTeams(connectionId: string) {
    return connectionsService.getLinearTeams(connectionId);
  },

  async getJiraProjects(connectionId: string) {
    return connectionsService.getJiraProjects(connectionId);
  },

  async getAsanaProjects(connectionId: string) {
    return connectionsService.getAsanaProjects(connectionId);
  },

  async getGitlabProjects(connectionId: string) {
    return connectionsService.getGitlabProjects(connectionId);
  },

  async saveResources(payload: SaveResourcesPayload) {
    return connectionsService.saveResources(payload);
  },

  async removeResource(resourceId: string) {
    return connectionsService.removeResource(resourceId);
  },

  async getByProvider(provider: string) {
    return connectionsService.getByProvider(provider);
  },

  async getSelectedResources(provider: string) {
    return connectionsService.getSelectedResources(provider);
  },

  async deleteResource(resourceId: string) {
    return connectionsService.deleteResource(resourceId);
  },

  async revoke(provider: string) {
    return connectionsService.revoke(provider);
  },
};
