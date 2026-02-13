import { workspaceDiffsService } from "./workspaceDiffs.service";

// ─────────────────────────────────────────────────────────────
// Workspace Diffs Controller
// ─────────────────────────────────────────────────────────────
export const workspaceDiffsController = {
  getByWorkspace: (workspaceId: string, limit?: number) =>
    workspaceDiffsService.getByWorkspace(workspaceId, limit),
  getLatest: (workspaceId: string) =>
    workspaceDiffsService.getLatest(workspaceId),
  getByRun: (runId: string) =>
    workspaceDiffsService.getByRun(runId),
};
