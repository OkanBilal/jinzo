import { randomUUID } from "crypto";
import * as fs from "fs";
import { projectsRepo } from "./projects.repo";
import { normalizeRemoteOrigin } from "./projects.utils";
import { workspacesRepo } from "../workspaces/workspaces.repo";
import { runsRepo } from "../runs/runs.repo";
import { reviewsRepo } from "../reviews/reviews.repo";
import { gitService } from "../git/git.service";
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
      const normalized = payload.remoteOrigin
        ? normalizeRemoteOrigin(payload.remoteOrigin)
        : null;

      // Dedup by remote origin when present, otherwise by rootPath (local-only projects).
      const existing = normalized
        ? await projectsRepo.findByRemoteOrigin(payload.accountId, normalized)
        : await projectsRepo.findByAccountAndRootPath(payload.accountId, payload.rootPath);
      if (existing) {
        return { success: true, data: existing };
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
      console.error("[ProjectsService] Failed to find or create project:", error);
      return { success: false, error: "Failed to find or create project" };
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
        return {
          success: false,
          error: normalized
            ? "Project with this remote origin already exists"
            : "Project at this path already exists",
        };
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

  async remove(id: string): Promise<ServiceResponse<void>> {
    try {
      const project = await projectsRepo.findById(id);
      if (!project) {
        return { success: false, error: "Project not found" };
      }

      // Find all workspaces belonging to this project
      const projectWorkspaces = await workspacesRepo.findByProjectId(id);

      // Remove worktrees for each workspace
      for (const ws of projectWorkspaces) {
        // If workspace rootPath is under the project's workspacesPath, it's a worktree
        if (
          project.workspacesPath &&
          ws.rootPath.startsWith(project.workspacesPath)
        ) {
          try {
            await gitService.removeWorktree(project.rootPath, ws.rootPath);
          } catch {
            // If git worktree remove fails, try to remove the directory manually
            if (fs.existsSync(ws.rootPath)) {
              fs.rmSync(ws.rootPath, { recursive: true, force: true });
            }
          }
        }
      }

      // Remove the workspacesPath directory if it exists and is empty
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

      // Delete runs, reviews for each workspace (these are set null on workspace delete, not cascade)
      for (const ws of projectWorkspaces) {
        await runsRepo.deleteRunsByWorkspaceId(ws.id);
        await reviewsRepo.deleteByWorkspaceId(ws.id);
      }

      // Delete all workspaces from DB (cascades: workspaceDiffs)
      await workspacesRepo.deleteByProjectId(id);

      // Delete the project from DB
      await projectsRepo.delete(id);

      return { success: true, data: undefined };
    } catch (error) {
      console.error(`[ProjectsService] Failed to remove project ${id}:`, error);
      return { success: false, error: "Failed to remove project" };
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await projectsRepo.delete(id);
      return { success: true, data: undefined };
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
