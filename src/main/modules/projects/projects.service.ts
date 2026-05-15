import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { randomUUID } from "crypto";
import * as fs from "fs";
import { projectsRepo } from "./projects.repo";
import { LINKABLE_KINDS, normalizeRemoteOrigin } from "./projects.utils";
import { workspaceRepo } from "../workspace";
import { runsRepo } from "../runs/runs.repo";
import { gitService } from "../git/git.service";
import { getIssuesByResourceIds } from "../entities";
import type {
  AvailableResource,
  CreateProjectPayload,
  ProjectResource,
  ProjectResourceWithDetails,
  ProjectResponse,
  ServiceResponse,
  UpdateProjectPayload,
} from "./projects.dto";

// ─────────────────────────────────────────────────────────────
// Projects Service
// ─────────────────────────────────────────────────────────────
export const projectsService = {
  // ─────────────────────────────────────────────────────────────
  // Project lifecycle
  // ─────────────────────────────────────────────────────────────
  async list(): Promise<ServiceResponse<ProjectResponse[]>> {
    try {
      const projects = await projectsRepo.findAll();
      return ok(projects);
    } catch (error) {
      console.error("[ProjectsService] Failed to list projects:", error);
      return fail("Failed to list projects");
    }
  },

  async get(id: string): Promise<ServiceResponse<ProjectResponse>> {
    try {
      const project = await projectsRepo.findById(id);
      if (!project) {
        return fail("Project not found");
      }
      return ok(project);
    } catch (error) {
      console.error(`[ProjectsService] Failed to get project ${id}:`, error);
      return fail("Failed to get project");
    }
  },

  async listByAccount(accountId: string): Promise<ServiceResponse<ProjectResponse[]>> {
    try {
      const projects = await projectsRepo.findByAccountId(accountId);
      return ok(projects);
    } catch (error) {
      console.error(`[ProjectsService] Failed to list projects for account ${accountId}:`, error);
      return fail("Failed to list projects");
    }
  },

  async findByRemoteOrigin(
    accountId: string,
    remoteOrigin: string,
  ): Promise<ServiceResponse<ProjectResponse>> {
    try {
      const normalized = normalizeRemoteOrigin(remoteOrigin);
      const project = await projectsRepo.findByRemoteOrigin(accountId, normalized);
      if (!project) {
        return fail("Project not found");
      }
      return ok(project);
    } catch (error) {
      console.error("[ProjectsService] Failed to find project by remote origin:", error);
      return fail("Failed to find project");
    }
  },

  async findOrCreate(payload: CreateProjectPayload): Promise<ServiceResponse<ProjectResponse>> {
    try {
      const normalized = payload.remoteOrigin
        ? normalizeRemoteOrigin(payload.remoteOrigin)
        : null;

      const existing = normalized
        ? await projectsRepo.findByRemoteOrigin(payload.accountId, normalized)
        : await projectsRepo.findByAccountAndRootPath(payload.accountId, payload.rootPath);
      if (existing) {
        return ok(existing);
      }

      const id = payload.id || randomUUID();
      await projectsRepo.insert({
        ...payload,
        id,
        remoteOrigin: normalized,
      });

      const project = await projectsRepo.findById(id);
      if (!project) {
        return fail("Failed to retrieve created project");
      }
      return ok(project);
    } catch (error) {
      console.error("[ProjectsService] Failed to find or create project:", error);
      return fail("Failed to find or create project");
    }
  },

  async create(payload: CreateProjectPayload): Promise<ServiceResponse<ProjectResponse>> {
    try {
      const normalized = payload.remoteOrigin
        ? normalizeRemoteOrigin(payload.remoteOrigin)
        : null;

      const existing = normalized
        ? await projectsRepo.findByRemoteOrigin(payload.accountId, normalized)
        : await projectsRepo.findByAccountAndRootPath(payload.accountId, payload.rootPath);
      if (existing) {
        return fail(
          normalized
            ? "Project with this remote origin already exists"
            : "Project at this path already exists",
        );
      }

      const id = payload.id || randomUUID();
      await projectsRepo.insert({
        ...payload,
        id,
        remoteOrigin: normalized,
      });

      const project = await projectsRepo.findById(id);
      if (!project) {
        return fail("Failed to retrieve created project");
      }
      return ok(project);
    } catch (error) {
      console.error("[ProjectsService] Failed to create project:", error);
      return fail("Failed to create project");
    }
  },

  async update(
    id: string,
    payload: UpdateProjectPayload,
  ): Promise<ServiceResponse<ProjectResponse>> {
    try {
      const updated = await projectsRepo.update(id, payload);
      if (!updated) {
        return fail("Project not found");
      }
      return ok(updated);
    } catch (error) {
      console.error(`[ProjectsService] Failed to update project ${id}:`, error);
      return fail("Failed to update project");
    }
  },

  async remove(id: string): Promise<ServiceResponse<void>> {
    try {
      const project = await projectsRepo.findById(id);
      if (!project) {
        return fail("Project not found");
      }

      const projectWorkspaces = await workspaceRepo.findByProjectId(id);

      for (const ws of projectWorkspaces) {
        if (
          project.workspacesPath &&
          ws.rootPath.startsWith(project.workspacesPath)
        ) {
          try {
            await gitService.removeWorktree(project.rootPath, ws.rootPath);
          } catch {
            if (fs.existsSync(ws.rootPath)) {
              fs.rmSync(ws.rootPath, { recursive: true, force: true });
            }
          }
        }
      }

      if (project.workspacesPath && fs.existsSync(project.workspacesPath)) {
        try {
          const remaining = fs.readdirSync(project.workspacesPath);
          if (remaining.length === 0) {
            fs.rmSync(project.workspacesPath, { recursive: true, force: true });
          }
        } catch {
          // Ignore cleanup errors
        }
      }

      for (const ws of projectWorkspaces) {
        await runsRepo.deleteRunsByWorkspaceId(ws.id);
        await workspaceRepo.deleteReviewsByWorkspace(ws.id);
      }

      await workspaceRepo.deleteByProjectId(id);
      await projectsRepo.delete(id);

      return ok(undefined);
    } catch (error) {
      console.error(`[ProjectsService] Failed to remove project ${id}:`, error);
      return fail("Failed to remove project");
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await projectsRepo.delete(id);
      return ok(undefined);
    } catch (error) {
      console.error(`[ProjectsService] Failed to delete project ${id}:`, error);
      return fail("Failed to delete project");
    }
  },

  async archive(id: string): Promise<ServiceResponse<ProjectResponse>> {
    try {
      const archived = await projectsRepo.archive(id);
      if (!archived) {
        return fail("Project not found");
      }
      return ok(archived);
    } catch (error) {
      console.error(`[ProjectsService] Failed to archive project ${id}:`, error);
      return fail("Failed to archive project");
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Project resources (formerly workspaceResources/)
  // ─────────────────────────────────────────────────────────────
  async listResources(
    projectId: string,
  ): Promise<ServiceResponse<{ resources: ProjectResourceWithDetails[] }>> {
    try {
      if (!projectId) {
        return fail("projectId is required");
      }
      const resources = await projectsRepo.listResourcesByProject(projectId);
      return ok({ resources });
    } catch (error) {
      console.error("[ProjectsService] Failed to list project resources:", error);
      return fail("Failed to list project resources");
    }
  },

  async listAvailableResources(
    projectId: string,
  ): Promise<ServiceResponse<{ resources: AvailableResource[] }>> {
    try {
      if (!projectId) {
        return fail("projectId is required");
      }
      const resources = await projectsRepo.listAvailableResources(projectId, LINKABLE_KINDS);
      return ok({ resources });
    } catch (error) {
      console.error("[ProjectsService] Failed to list available resources:", error);
      return fail("Failed to list available resources");
    }
  },

  async addResource(
    projectId: string,
    resourceId: string,
  ): Promise<ServiceResponse<{ resource: ProjectResource }>> {
    try {
      if (!projectId || !resourceId) {
        return fail("projectId and resourceId are required");
      }

      const linked = await projectsRepo.isResourceLinked(projectId, resourceId);
      if (linked) {
        return fail("Resource is already linked to this project");
      }

      const id = randomUUID();
      const resource = await projectsRepo.addResource(id, projectId, resourceId);
      return ok({ resource });
    } catch (error) {
      console.error("[ProjectsService] Failed to add resource to project:", error);
      return fail("Failed to add resource to project");
    }
  },

  async removeResource(
    projectId: string,
    resourceId: string,
  ): Promise<ServiceResponse<void>> {
    try {
      if (!projectId || !resourceId) {
        return fail("projectId and resourceId are required");
      }
      await projectsRepo.removeResource(projectId, resourceId);
      return ok(undefined);
    } catch (error) {
      console.error("[ProjectsService] Failed to remove resource from project:", error);
      return fail("Failed to remove resource from project");
    }
  },

  // Cross-aggregate query: stitch projects ⨯ entities at the service layer.
  // The repo never touches the entities/issues schema — callers cross the
  // seam via `getIssuesByResourceIds` on the entities barrel.
  async listIssues(
    projectId: string,
  ): Promise<ServiceResponse<{ issues: unknown[] }>> {
    try {
      if (!projectId) {
        return fail("projectId is required");
      }
      const resourceIds = await projectsRepo.listLinkedResourceIds(projectId);
      if (resourceIds.length === 0) {
        return ok({ issues: [] });
      }
      const rows = await getIssuesByResourceIds(resourceIds);
      const serialized = rows.map((item) => ({
        issue: item.issue,
        entity: {
          ...item.entity,
          occurredAt:
            item.entity.occurredAt instanceof Date
              ? item.entity.occurredAt.toISOString()
              : item.entity.occurredAt,
          createdAt:
            item.entity.createdAt instanceof Date
              ? item.entity.createdAt.toISOString()
              : item.entity.createdAt,
          updatedAt:
            item.entity.updatedAt instanceof Date
              ? item.entity.updatedAt.toISOString()
              : item.entity.updatedAt,
        },
      }));
      return ok({ issues: serialized });
    } catch (error) {
      console.error("[ProjectsService] Failed to list issues for project:", error);
      return fail("Failed to list issues");
    }
  },
};
