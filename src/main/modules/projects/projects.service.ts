import { randomUUID } from "crypto";
import { projectsRepo } from "./projects.repo";
import { normalizeRemoteOrigin } from "./projects.utils";
import type {
  CreateProjectPayload,
  UpdateProjectPayload,
  ProjectResponse,
  ServiceResponse,
} from "./projects.dto";

// ─────────────────────────────────────────────────────────────
// Projects Service
// ─────────────────────────────────────────────────────────────
export const projectsService = {
  async getAll(): Promise<ServiceResponse<ProjectResponse[]>> {
    try {
      const projects = await projectsRepo.findAll();
      return { success: true, data: projects };
    } catch (error) {
      console.error("[ProjectsService] Failed to get all projects:", error);
      return { success: false, error: "Failed to get projects" };
    }
  },

  async getById(id: string): Promise<ServiceResponse<ProjectResponse>> {
    try {
      const project = await projectsRepo.findById(id);
      if (!project) {
        return { success: false, error: "Project not found" };
      }
      return { success: true, data: project };
    } catch (error) {
      console.error(`[ProjectsService] Failed to get project ${id}:`, error);
      return { success: false, error: "Failed to get project" };
    }
  },

  async getByAccountId(accountId: string): Promise<ServiceResponse<ProjectResponse[]>> {
    try {
      const projects = await projectsRepo.findByAccountId(accountId);
      return { success: true, data: projects };
    } catch (error) {
      console.error(`[ProjectsService] Failed to get projects for account ${accountId}:`, error);
      return { success: false, error: "Failed to get projects" };
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
        return { success: false, error: "Project not found" };
      }
      return { success: true, data: project };
    } catch (error) {
      console.error("[ProjectsService] Failed to find project by remote origin:", error);
      return { success: false, error: "Failed to find project" };
    }
  },

  async findOrCreate(payload: CreateProjectPayload): Promise<ServiceResponse<ProjectResponse>> {
    try {
      const normalized = normalizeRemoteOrigin(payload.remoteOrigin);

      // Check if project with same (accountId, normalizedOrigin) exists
      const existing = await projectsRepo.findByRemoteOrigin(payload.accountId, normalized);
      if (existing) {
        return { success: true, data: existing };
      }

      // Create new project with normalized origin
      const id = payload.id || randomUUID();
      await projectsRepo.insert({
        ...payload,
        id,
        remoteOrigin: normalized,
      });

      const project = await projectsRepo.findById(id);
      if (!project) {
        return { success: false, error: "Failed to retrieve created project" };
      }
      return { success: true, data: project };
    } catch (error) {
      console.error("[ProjectsService] Failed to find or create project:", error);
      return { success: false, error: "Failed to find or create project" };
    }
  },

  async create(payload: CreateProjectPayload): Promise<ServiceResponse<ProjectResponse>> {
    try {
      const normalized = normalizeRemoteOrigin(payload.remoteOrigin);

      // Check for duplicate
      const existing = await projectsRepo.findByRemoteOrigin(payload.accountId, normalized);
      if (existing) {
        return { success: false, error: "Project with this remote origin already exists" };
      }

      const id = payload.id || randomUUID();
      await projectsRepo.insert({
        ...payload,
        id,
        remoteOrigin: normalized,
      });

      const project = await projectsRepo.findById(id);
      if (!project) {
        return { success: false, error: "Failed to retrieve created project" };
      }
      return { success: true, data: project };
    } catch (error) {
      console.error("[ProjectsService] Failed to create project:", error);
      return { success: false, error: "Failed to create project" };
    }
  },

  async update(
    id: string,
    payload: UpdateProjectPayload,
  ): Promise<ServiceResponse<ProjectResponse>> {
    try {
      const updated = await projectsRepo.update(id, payload);
      if (!updated) {
        return { success: false, error: "Project not found" };
      }
      return { success: true, data: updated };
    } catch (error) {
      console.error(`[ProjectsService] Failed to update project ${id}:`, error);
      return { success: false, error: "Failed to update project" };
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await projectsRepo.delete(id);
      return { success: true };
    } catch (error) {
      console.error(`[ProjectsService] Failed to delete project ${id}:`, error);
      return { success: false, error: "Failed to delete project" };
    }
  },

  async archive(id: string): Promise<ServiceResponse<ProjectResponse>> {
    try {
      const archived = await projectsRepo.archive(id);
      if (!archived) {
        return { success: false, error: "Project not found" };
      }
      return { success: true, data: archived };
    } catch (error) {
      console.error(`[ProjectsService] Failed to archive project ${id}:`, error);
      return { success: false, error: "Failed to archive project" };
    }
  },
};
