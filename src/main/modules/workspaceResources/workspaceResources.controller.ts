import { workspaceResourcesService } from "./workspaceResources.service";
import type { AddResourcePayload, RemoveResourcePayload } from "./workspaceResources.dto";

// ─────────────────────────────────────────────────────────────
// Workspace Resources Controller
// ─────────────────────────────────────────────────────────────

export const workspaceResourcesController = {
  async getByWorkspace(workspaceId: string) {
    return workspaceResourcesService.getByWorkspace(workspaceId);
  },

  async getAvailableResources(workspaceId: string) {
    return workspaceResourcesService.getAvailableResources(workspaceId);
  },

  async addResource(payload: AddResourcePayload) {
    return workspaceResourcesService.addResource(payload.workspaceId, payload.resourceId);
  },

  async removeResource(payload: RemoveResourcePayload) {
    return workspaceResourcesService.removeResource(payload.workspaceId, payload.resourceId);
  },

  async getIssuesByWorkspace(workspaceId: string) {
    return workspaceResourcesService.getIssuesByWorkspace(workspaceId);
  },
};
