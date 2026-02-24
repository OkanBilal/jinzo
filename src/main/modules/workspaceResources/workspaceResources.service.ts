import { workspaceResourcesRepo } from "./workspaceResources.repo";
import type {
  ServiceResponse,
  ProjectResourceWithDetails,
  AvailableResource,
  ProjectResource,
} from "./workspaceResources.dto";

// ─────────────────────────────────────────────────────────────
// Project Resources Service
// ─────────────────────────────────────────────────────────────

// Resource kinds that can be linked to projects
const LINKABLE_KINDS = ["github_repo", "linear_team", "jira_project", "asana_project", "gitlab_project"];

export const workspaceResourcesService = {
  /**
   * Get all resources linked to a project
   */
  async getByProject(
    projectId: string
  ): Promise<ServiceResponse<{ resources: ProjectResourceWithDetails[] }>> {
    try {
      if (!projectId) {
        return { success: false, error: "projectId is required" };
      }

      const resources = await workspaceResourcesRepo.findByProject(projectId);
      return { success: true, data: { resources } };
    } catch (error) {
      console.error("Error getting project resources:", error);
      return { success: false, error: "Failed to get project resources" };
    }
  },

  /**
   * Get available resources that can be linked to a project
   */
  async getAvailableResources(
    projectId: string
  ): Promise<ServiceResponse<{ resources: AvailableResource[] }>> {
    try {
      if (!projectId) {
        return { success: false, error: "projectId is required" };
      }

      const resources = await workspaceResourcesRepo.findAvailableResources(
        projectId,
        LINKABLE_KINDS
      );
      return { success: true, data: { resources } };
    } catch (error) {
      console.error("Error getting available resources:", error);
      return { success: false, error: "Failed to get available resources" };
    }
  },

  /**
   * Add a resource to a project
   */
  async addResource(
    projectId: string,
    resourceId: string
  ): Promise<ServiceResponse<{ resource: ProjectResource }>> {
    try {
      if (!projectId || !resourceId) {
        return { success: false, error: "projectId and resourceId are required" };
      }

      // Check if already linked
      const isLinked = await workspaceResourcesRepo.isLinked(projectId, resourceId);
      if (isLinked) {
        return { success: false, error: "Resource is already linked to this project" };
      }

      const id = crypto.randomUUID();
      const resource = await workspaceResourcesRepo.addResource(id, projectId, resourceId);
      return { success: true, data: { resource } };
    } catch (error) {
      console.error("Error adding resource to project:", error);
      return { success: false, error: "Failed to add resource to project" };
    }
  },

  /**
   * Remove a resource from a project
   */
  async removeResource(
    projectId: string,
    resourceId: string
  ): Promise<ServiceResponse<void>> {
    try {
      if (!projectId || !resourceId) {
        return { success: false, error: "projectId and resourceId are required" };
      }

      await workspaceResourcesRepo.removeResource(projectId, resourceId);
      return { success: true };
    } catch (error) {
      console.error("Error removing resource from project:", error);
      return { success: false, error: "Failed to remove resource from project" };
    }
  },

  /**
   * Get issues for a project via linked resources
   */
  async getIssuesByProject(
    projectId: string
  ): Promise<ServiceResponse<{ issues: any[] }>> {
    try {
      if (!projectId) {
        return { success: false, error: "projectId is required" };
      }

      const issues = await workspaceResourcesRepo.findIssuesByProject(projectId);
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
      console.error("Error getting issues by project:", error);
      return { success: false, error: "Failed to get issues" };
    }
  },
};
