import { workspaceResourcesService } from "./workspaceResources.service";
import type { AddResourcePayload, RemoveResourcePayload } from "./workspaceResources.dto";

// ─────────────────────────────────────────────────────────────
// Project Resources Controller
// ─────────────────────────────────────────────────────────────

export const workspaceResourcesController = {
  async getByProject(projectId: string) {
    return workspaceResourcesService.getByProject(projectId);
  },

  async getAvailableResources(projectId: string) {
    return workspaceResourcesService.getAvailableResources(projectId);
  },

  async addResource(payload: AddResourcePayload) {
    return workspaceResourcesService.addResource(payload.projectId, payload.resourceId);
  },

  async removeResource(payload: RemoveResourcePayload) {
    return workspaceResourcesService.removeResource(payload.projectId, payload.resourceId);
  },

  async getIssuesByProject(projectId: string) {
    return workspaceResourcesService.getIssuesByProject(projectId);
  },
};
