import { ok } from "../../../shared/ipc-kit/service-response";
import { dialog, BrowserWindow } from "electron";
import { ipcMain } from "../../ipc-kit/ipc-main";
import { handle } from "../../ipc-kit/handle";
import { workspaceService } from "./workspace.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import type {
  CreateWorkspacePayload,
  WorkspaceIntakePayload,
  UpdateWorkspacePayload,
  CreateActivityPayload,
  CreateReviewPayload,
  UpdateReviewPayload,
  CreateReviewFindingPayload,
  UpdateReviewFindingPayload,
} from "./workspace.dto";

// ─────────────────────────────────────────────────────────────
// Workspace aggregate IPC handlers
// ─────────────────────────────────────────────────────────────
export function registerWorkspaceIpc(): void {
  // ── lifecycle ──
  ipcMain.handle(CHANNELS.workspace.list, async () => workspaceService.list());

  ipcMain.handle(CHANNELS.workspace.get, async (_, id: string) =>
    workspaceService.get(id),
  );

  ipcMain.handle(
    CHANNELS.workspace.listByAccount,
    async (_, accountId: string) => workspaceService.listByAccount(accountId),
  );

  ipcMain.handle(
    CHANNELS.workspace.getByRootPath,
    async (_, accountId: string, rootPath: string) =>
      workspaceService.getByRootPath(accountId, rootPath),
  );

  ipcMain.handle(
    CHANNELS.workspace.create,
    async (_, payload: CreateWorkspacePayload) =>
      workspaceService.create(payload),
  );

  ipcMain.handle(
    CHANNELS.workspace.createFromSource,
    async (_, payload: WorkspaceIntakePayload) =>
      workspaceService.createFromSource(payload),
  );

  ipcMain.handle(
    CHANNELS.workspace.update,
    async (_, id: string, payload: UpdateWorkspacePayload) =>
      workspaceService.update(id, payload),
  );

  ipcMain.handle(CHANNELS.workspace.delete, async (_, id: string) =>
    workspaceService.delete(id),
  );

  ipcMain.handle(CHANNELS.workspace.archive, async (_, id: string) =>
    workspaceService.archive(id),
  );

  // ── git operations (throw-style services; envelope via handle()) ──
  ipcMain.handle(
    CHANNELS.workspace.renameBranch,
    handle((id: string, newBranchName: string) =>
      workspaceService.renameBranch(id, newBranchName),
    ),
  );

  ipcMain.handle(
    CHANNELS.workspace.discardChanges,
    handle((id: string) => workspaceService.discardChanges(id)),
  );

  ipcMain.handle(CHANNELS.workspace.selectDirectory, async () => {
    const window = BrowserWindow.getFocusedWindow();

    const result = window
      ? await dialog.showOpenDialog(window, {
          properties: ["openDirectory"],
          title: "Select Project Folder",
          buttonLabel: "Select",
        })
      : await dialog.showOpenDialog({
          properties: ["openDirectory"],
          title: "Select Project Folder",
          buttonLabel: "Select",
        });

    if (result.canceled || result.filePaths.length === 0) {
      return ok(null);
    }

    return ok(result.filePaths[0]);
  });

  // ── activity ──
  ipcMain.handle(
    CHANNELS.workspace.listActivity,
    async (_, workspaceId: string, limit?: number) =>
      workspaceService.listActivity(workspaceId, limit),
  );

  ipcMain.handle(
    CHANNELS.workspace.createActivity,
    async (_, payload: CreateActivityPayload) =>
      workspaceService.createActivity(payload),
  );

  ipcMain.handle(
    CHANNELS.workspace.createManyActivity,
    async (_, payloads: CreateActivityPayload[]) =>
      workspaceService.createManyActivity(payloads),
  );

  ipcMain.handle(CHANNELS.workspace.deleteActivity, async (_, id: string) =>
    workspaceService.deleteActivity(id),
  );

  // ── diffs ──
  ipcMain.handle(
    CHANNELS.workspace.listDiffs,
    async (_, workspaceId: string, limit?: number) =>
      workspaceService.listDiffs(workspaceId, limit),
  );

  ipcMain.handle(
    CHANNELS.workspace.getLatestDiff,
    async (_, workspaceId: string) => workspaceService.getLatestDiff(workspaceId),
  );

  ipcMain.handle(
    CHANNELS.workspace.getLatestDiffSummary,
    async (_, workspaceId: string) =>
      workspaceService.getLatestDiffSummary(workspaceId),
  );

  ipcMain.handle(CHANNELS.workspace.getDiffByRun, async (_, runId: string) =>
    workspaceService.getDiffByRun(runId),
  );

  ipcMain.handle(
    CHANNELS.workspace.deleteLatestDiff,
    async (_, workspaceId: string) =>
      workspaceService.deleteLatestDiff(workspaceId),
  );

  ipcMain.handle(
    CHANNELS.workspace.resyncDiff,
    async (_, workspaceId: string) => workspaceService.resyncDiff(workspaceId),
  );

  // ── reviews ──
  ipcMain.handle(
    CHANNELS.workspace.listReviews,
    async (_, workspaceId: string, limit?: number) =>
      workspaceService.listReviews(workspaceId, limit),
  );

  ipcMain.handle(CHANNELS.workspace.getReview, async (_, id: string) =>
    workspaceService.getReview(id),
  );

  ipcMain.handle(
    CHANNELS.workspace.createReview,
    async (_, payload: CreateReviewPayload) =>
      workspaceService.createReview(payload),
  );

  ipcMain.handle(
    CHANNELS.workspace.updateReview,
    async (_, id: string, payload: UpdateReviewPayload) =>
      workspaceService.updateReview(id, payload),
  );

  ipcMain.handle(CHANNELS.workspace.deleteReview, async (_, id: string) =>
    workspaceService.deleteReview(id),
  );

  // ── findings ──
  ipcMain.handle(
    CHANNELS.workspace.listFindings,
    async (_, reviewId: string, limit?: number) =>
      workspaceService.listFindings(reviewId, limit),
  );

  ipcMain.handle(
    CHANNELS.workspace.listFindingsByWorkspace,
    async (_, workspaceId: string) =>
      workspaceService.listFindingsByWorkspace(workspaceId),
  );

  ipcMain.handle(CHANNELS.workspace.getFinding, async (_, id: string) =>
    workspaceService.getFinding(id),
  );

  ipcMain.handle(
    CHANNELS.workspace.createFinding,
    async (_, payload: CreateReviewFindingPayload) =>
      workspaceService.createFinding(payload),
  );

  ipcMain.handle(
    CHANNELS.workspace.createManyFindings,
    async (_, payloads: CreateReviewFindingPayload[]) =>
      workspaceService.createManyFindings(payloads),
  );

  ipcMain.handle(
    CHANNELS.workspace.updateFinding,
    async (_, id: string, payload: UpdateReviewFindingPayload) =>
      workspaceService.updateFinding(id, payload),
  );

  ipcMain.handle(CHANNELS.workspace.deleteFinding, async (_, id: string) =>
    workspaceService.deleteFinding(id),
  );
}

export function unregisterWorkspaceIpc(): void {
  [
    // lifecycle
    CHANNELS.workspace.list,
    CHANNELS.workspace.get,
    CHANNELS.workspace.listByAccount,
    CHANNELS.workspace.getByRootPath,
    CHANNELS.workspace.create,
    CHANNELS.workspace.update,
    CHANNELS.workspace.delete,
    CHANNELS.workspace.archive,
    CHANNELS.workspace.renameBranch,
    CHANNELS.workspace.discardChanges,
    CHANNELS.workspace.selectDirectory,
    // activity
    CHANNELS.workspace.listActivity,
    CHANNELS.workspace.createActivity,
    CHANNELS.workspace.createManyActivity,
    CHANNELS.workspace.deleteActivity,
    // diffs
    CHANNELS.workspace.listDiffs,
    CHANNELS.workspace.getLatestDiff,
    CHANNELS.workspace.getLatestDiffSummary,
    CHANNELS.workspace.getDiffByRun,
    CHANNELS.workspace.deleteLatestDiff,
    CHANNELS.workspace.resyncDiff,
    // reviews
    CHANNELS.workspace.listReviews,
    CHANNELS.workspace.getReview,
    CHANNELS.workspace.createReview,
    CHANNELS.workspace.updateReview,
    CHANNELS.workspace.deleteReview,
    // findings
    CHANNELS.workspace.listFindings,
    CHANNELS.workspace.listFindingsByWorkspace,
    CHANNELS.workspace.getFinding,
    CHANNELS.workspace.createFinding,
    CHANNELS.workspace.createManyFindings,
    CHANNELS.workspace.updateFinding,
    CHANNELS.workspace.deleteFinding,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
