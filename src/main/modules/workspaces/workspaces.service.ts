import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { BrowserWindow } from "electron";
import { workspacesRepo } from "./workspaces.repo";
import { projectsRepo } from "../projects/projects.repo";
import type {
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  WorkspaceResponse,
  ServiceResponse,
  WorkspaceStatus,
} from "./workspaces.dto";

// ─────────────────────────────────────────────────────────────
// Script Execution Helper
// ─────────────────────────────────────────────────────────────
function validateScriptCwd(cwd: string): void {
  const resolved = path.resolve(cwd);
  if (!existsSync(resolved)) {
    throw new Error(`Script cwd does not exist: ${resolved}`);
  }
}

function executeScript(script: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  validateScriptCwd(cwd);

  const shell = process.platform === "win32" ? "cmd" : "/bin/sh";
  const shellArgs = process.platform === "win32" ? ["/c", script] : ["-c", script];

  return new Promise((resolve, reject) => {
    execFile(shell, shellArgs, { cwd, timeout: 300_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[WorkspacesService] Script failed in ${cwd}:`, error.message);
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function notifyRenderer(channel: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, data);
  }
}

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

      // Fire-and-forget: run project setupScript in background
      if (workspace.projectId) {
        const wsId = id;
        const rootPath = workspace.rootPath;
        projectsRepo.findById(workspace.projectId).then((project) => {
          if (!project?.setupScript) return;
          console.log(`[WorkspacesService] Running setup script for workspace ${wsId} in ${rootPath}`);
          executeScript(project.setupScript, rootPath)
            .then(() => {
              console.log(`[WorkspacesService] Setup script completed for workspace ${wsId}`);
              notifyRenderer("workspaces:scriptComplete", { workspaceId: wsId, script: "setup", success: true });
            })
            .catch((err) => {
              console.error(`[WorkspacesService] Setup script failed for workspace ${wsId}:`, err);
              notifyRenderer("workspaces:scriptComplete", { workspaceId: wsId, script: "setup", success: false, error: err?.message });
            });
        }).catch(() => {});
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
      return { success: true, data: undefined };
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
      const workspace = await workspacesRepo.findById(id);
      if (!workspace) {
        return { success: false, error: "Workspace not found" };
      }

      const archived = await workspacesRepo.archive(id);
      if (!archived) {
        return { success: false, error: "Failed to archive workspace" };
      }

      // Fire-and-forget: run project archiveScript in background
      if (workspace.projectId) {
        const wsId = id;
        const rootPath = workspace.rootPath;
        projectsRepo.findById(workspace.projectId).then((project) => {
          if (!project?.archiveScript) return;
          console.log(`[WorkspacesService] Running archive script for workspace ${wsId} in ${rootPath}`);
          executeScript(project.archiveScript, rootPath)
            .then(() => {
              console.log(`[WorkspacesService] Archive script completed for workspace ${wsId}`);
              notifyRenderer("workspaces:scriptComplete", { workspaceId: wsId, script: "archive", success: true });
            })
            .catch((err) => {
              console.error(`[WorkspacesService] Archive script failed for workspace ${wsId}:`, err);
              notifyRenderer("workspaces:scriptComplete", { workspaceId: wsId, script: "archive", success: false, error: err?.message });
            });
        }).catch(() => {});
      }

      return { success: true, data: archived };
    } catch (error) {
      console.error(`[WorkspacesService] Failed to archive workspace ${id}:`, error);
      return { success: false, error: "Failed to archive workspace" };
    }
  },
};
