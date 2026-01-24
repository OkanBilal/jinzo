import { workspacesService } from "./workspaces.service";
import type { CreateWorkspacePayload, UpdateWorkspacePayload } from "./workspaces.dto";

// ─────────────────────────────────────────────────────────────
// Workspaces Controller
// ─────────────────────────────────────────────────────────────
export const workspacesController = {
  getAll: () => workspacesService.getAll(),
  getById: (id: string) => workspacesService.getById(id),
  getByAccountId: (accountId: string) => workspacesService.getByAccountId(accountId),
  getByRootPath: (accountId: string, rootPath: string) =>
    workspacesService.getByRootPath(accountId, rootPath),
  create: (payload: CreateWorkspacePayload) => workspacesService.create(payload),
  update: (id: string, payload: UpdateWorkspacePayload) => workspacesService.update(id, payload),
  delete: (id: string) => workspacesService.delete(id),
};
