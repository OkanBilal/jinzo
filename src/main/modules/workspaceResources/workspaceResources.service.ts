import { workspaceResourcesRepo } from "./workspaceResources.repo";
import type {
  ServiceResponse,
  WorkspaceResourceWithDetails,
  AvailableResource,
  WorkspaceResource,
} from "./workspaceResources.dto";

// ─────────────────────────────────────────────────────────────
// Workspace Resources Service
// ─────────────────────────────────────────────────────────────

// Resource kinds that can be linked to workspaces
const LINKABLE_KINDS = ["github_repo", "linear_team", "jira_project", "asana_project", "gitlab_project"];

export const workspaceResourcesService = {
  /**
   * Get all resources linked to a workspace
   */
  async getByWorkspace(
    workspaceId: string
  ): Promise<ServiceResponse<{ resources: WorkspaceResourceWithDetails[] }>> {
    try {
      if (!workspaceId) {
        return { success: false, error: "workspaceId is required" };
      }

      const resources = await workspaceResourcesRepo.findByWorkspace(workspaceId);
      return { success: true, data: { resources } };
    } catch (error) {
      console.error("Error getting workspace resources:", error);
      return { success: false, error: "Failed to get workspace resources" };
    }
  },

  /**
   * Get available resources that can be linked to a workspace
   */
  async getAvailableResources(
    workspaceId: string
  ): Promise<ServiceResponse<{ resources: AvailableResource[] }>> {
    try {
      if (!workspaceId) {
        return { success: false, error: "workspaceId is required" };
      }

      const resources = await workspaceResourcesRepo.findAvailableResources(
        workspaceId,
        LINKABLE_KINDS
      );
      return { success: true, data: { resources } };
    } catch (error) {
      console.error("Error getting available resources:", error);
      return { success: false, error: "Failed to get available resources" };
    }
  },

  /**
   * Add a resource to a workspace
   */
  async addResource(
    workspaceId: string,
    resourceId: string
  ): Promise<ServiceResponse<{ resource: WorkspaceResource }>> {
    try {
      if (!workspaceId || !resourceId) {
        return { success: false, error: "workspaceId and resourceId are required" };
      }

      // Check if already linked
      const isLinked = await workspaceResourcesRepo.isLinked(workspaceId, resourceId);
      if (isLinked) {
        return { success: false, error: "Resource is already linked to this workspace" };
      }

      const id = crypto.randomUUID();
      const resource = await workspaceResourcesRepo.addResource(id, workspaceId, resourceId);
      return { success: true, data: { resource } };
    } catch (error) {
      console.error("Error adding resource to workspace:", error);
      return { success: false, error: "Failed to add resource to workspace" };
    }
  },

  /**
   * Remove a resource from a workspace
   */
  async removeResource(
    workspaceId: string,
    resourceId: string
  ): Promise<ServiceResponse<void>> {
    try {
      if (!workspaceId || !resourceId) {
        return { success: false, error: "workspaceId and resourceId are required" };
      }

      await workspaceResourcesRepo.removeResource(workspaceId, resourceId);
      return { success: true };
    } catch (error) {
      console.error("Error removing resource from workspace:", error);
      return { success: false, error: "Failed to remove resource from workspace" };
    }
  },

  /**
   * Get issues for a workspace via linked resources
   */
  async getIssuesByWorkspace(
    workspaceId: string
  ): Promise<ServiceResponse<{ issues: any[] }>> {
    try {
      if (!workspaceId) {
        return { success: false, error: "workspaceId is required" };
      }

      const issues = await workspaceResourcesRepo.findIssuesByWorkspace(workspaceId);
        //TODO: CHECK SERİALİZE İSSUE LATER
      // Serialize Date objects to ISO strings for Redux compatibility
      const serializedIssues = issues.map((item) => ({
        issue: item.issue,
        entity: {
          ...item.entity,
          occurredAt: item.entity.occurredAt instanceof Date 
            ? item.entity.occurredAt.toISOString() 
            : item.entity.occurredAt,
          createdAt: item.entity.createdAt instanceof Date 
            ? item.entity.createdAt.toISOString() 
            : item.entity.createdAt,
          updatedAt: item.entity.updatedAt instanceof Date 
            ? item.entity.updatedAt.toISOString() 
            : item.entity.updatedAt,
        },
      }));
      
      return { success: true, data: { issues: serializedIssues } };
    } catch (error) {
      console.error("Error getting issues by workspace:", error);
      return { success: false, error: "Failed to get issues" };
    }
  },
};
