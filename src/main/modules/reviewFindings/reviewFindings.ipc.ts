import { ipcMain } from "electron";
import { reviewFindingsService } from "./reviewFindings.service";
import { CHANNELS } from "../../../shared/ipc-kit/channels";
import type {
  CreateReviewFindingPayload,
  UpdateReviewFindingPayload,
} from "./reviewFindings.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerReviewFindingsIpc(): void {
  ipcMain.handle(
    CHANNELS.reviewFindings.getByWorkspace,
    async (_, workspaceId: string) => {
      return reviewFindingsService.getByWorkspace(workspaceId);
    },
  );

  ipcMain.handle(
    CHANNELS.reviewFindings.getByReview,
    async (_, reviewId: string, limit?: number) => {
      return reviewFindingsService.getByReview(reviewId, limit);
    },
  );

  ipcMain.handle(CHANNELS.reviewFindings.getById, async (_, id: string) => {
    return reviewFindingsService.getById(id);
  });

  ipcMain.handle(
    CHANNELS.reviewFindings.create,
    async (_, payload: CreateReviewFindingPayload) => {
      return reviewFindingsService.create(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.reviewFindings.createMany,
    async (_, payloads: CreateReviewFindingPayload[]) => {
      return reviewFindingsService.createMany(payloads);
    },
  );

  ipcMain.handle(
    CHANNELS.reviewFindings.update,
    async (_, id: string, payload: UpdateReviewFindingPayload) => {
      return reviewFindingsService.update(id, payload);
    },
  );

  ipcMain.handle(CHANNELS.reviewFindings.delete, async (_, id: string) => {
    return reviewFindingsService.delete(id);
  });
}

export function unregisterReviewFindingsIpc(): void {
  [
    CHANNELS.reviewFindings.getByWorkspace,
    CHANNELS.reviewFindings.getByReview,
    CHANNELS.reviewFindings.getById,
    CHANNELS.reviewFindings.create,
    CHANNELS.reviewFindings.createMany,
    CHANNELS.reviewFindings.update,
    CHANNELS.reviewFindings.delete,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
