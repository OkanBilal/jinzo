import { workspaceActivityService } from "./workspaceActivity.service";
import type { CreateActivityPayload } from "./workspaceActivity.dto";

// ─────────────────────────────────────────────────────────────
// Workspace Activity Controller
// ─────────────────────────────────────────────────────────────
export const workspaceActivityController = {
  getByWorkspace: (workspaceId: string, limit?: number) =>
    workspaceActivityService.getByWorkspace(workspaceId, limit),
  create: (payload: CreateActivityPayload) =>
    workspaceActivityService.create(payload),
  createMany: (payloads: CreateActivityPayload[]) =>
    workspaceActivityService.createMany(payloads),
  delete: (id: string) => workspaceActivityService.delete(id),
};
