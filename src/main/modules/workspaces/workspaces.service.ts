import { randomUUID } from "crypto";
import { workspacesRepo } from "./workspaces.repo";
import type {
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  WorkspaceResponse,
  ServiceResponse,
  WorkspaceStatus,
} from "./workspaces.dto";

// ─────────────────────────────────────────────────────────────
// Workspaces Service
// ─────────────────────────────────────────────────────────────
export const workspacesService = {
  async getAll(): Promise<ServiceResponse<WorkspaceResponse[]>> {
    try {
      const workspaces = await workspacesRepo.findAll();
      return { success: true, data: workspaces };
    } catch (error) {
      console.error("[WorkspacesService] Failed to get all workspaces:", error);
      return { success: false, error: "Failed to get workspaces" };
    }
  },

  async getById(id: string): Promise<ServiceResponse<WorkspaceResponse>> {
    try {
      const workspace = await workspacesRepo.findById(id);
      if (!workspace) {
        return { success: false, error: "Workspace not found" };
      }
      return { success: true, data: workspace };
    } catch (error) {
      console.error(`[WorkspacesService] Failed to get workspace ${id}:`, error);
      return { success: false, error: "Failed to get workspace" };
    }
  },

  async getByAccountId(accountId: string): Promise<ServiceResponse<WorkspaceResponse[]>> {
    try {
      const workspaces = await workspacesRepo.findByAccountId(accountId);
      return { success: true, data: workspaces };
    } catch (error) {
      console.error(`[WorkspacesService] Failed to get workspaces for account ${accountId}:`, error);
      return { success: false, error: "Failed to get workspaces" };
    }
  },

  async getByRootPath(
    accountId: string,
    rootPath: string
  ): Promise<ServiceResponse<WorkspaceResponse>> {
    try {
      const workspace = await workspacesRepo.findByRootPath(accountId, rootPath);
      if (!workspace) {
        return { success: false, error: "Workspace not found" };
      }
      return { success: true, data: workspace };
    } catch (error) {
      console.error(`[WorkspacesService] Failed to get workspace by path:`, error);
      return { success: false, error: "Failed to get workspace" };
    }
  },

  async create(payload: CreateWorkspacePayload): Promise<ServiceResponse<WorkspaceResponse>> {
    try {
      // Check if workspace with same path exists
      const existing = await workspacesRepo.findByRootPath(payload.accountId, payload.rootPath);
      if (existing) {
        return { success: false, error: "Workspace with this path already exists" };
      }

      // Generate ID if not provided
      const workspacePayload = {
        ...payload,
        id: payload.id || randomUUID(),
      };

      const id = await workspacesRepo.insert(workspacePayload);
      const workspace = await workspacesRepo.findById(id);
      if (!workspace) {
        return { success: false, error: "Failed to retrieve created workspace" };
      }
      return { success: true, data: workspace };
    } catch (error) {
      console.error("[WorkspacesService] Failed to create workspace:", error);
      return { success: false, error: "Failed to create workspace" };
    }
  },

  async update(
    id: string,
    payload: UpdateWorkspacePayload
  ): Promise<ServiceResponse<WorkspaceResponse>> {
    try {
      const updated = await workspacesRepo.update(id, payload);
      if (!updated) {
        return { success: false, error: "Workspace not found" };
      }
      return { success: true, data: updated };
    } catch (error) {
      console.error(`[WorkspacesService] Failed to update workspace ${id}:`, error);
      return { success: false, error: "Failed to update workspace" };
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await workspacesRepo.delete(id);
      return { success: true };
    } catch (error) {
      console.error(`[WorkspacesService] Failed to delete workspace ${id}:`, error);
      return { success: false, error: "Failed to delete workspace" };
    }
  },

  async updateStatus(
    id: string,
    status: WorkspaceStatus,
  ): Promise<ServiceResponse<WorkspaceResponse>> {
    return this.update(id, { status });
  },

  async archive(id: string): Promise<ServiceResponse<WorkspaceResponse>> {
    try {
      const archived = await workspacesRepo.archive(id);
      if (!archived) {
        return { success: false, error: "Workspace not found" };
      }
      return { success: true, data: archived };
    } catch (error) {
      console.error(`[WorkspacesService] Failed to archive workspace ${id}:`, error);
      return { success: false, error: "Failed to archive workspace" };
    }
  },
};
