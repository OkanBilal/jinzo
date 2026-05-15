import { ipcMain } from "electron";
import { reviewsService } from "./reviews.service";
import type { CreateReviewPayload, UpdateReviewPayload } from "./reviews.dto";
import { CHANNELS } from "../../../shared/ipc-kit/channels";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerReviewsIpc(): void {
  ipcMain.handle(
    CHANNELS.reviews.getByWorkspace,
    async (_, workspaceId: string, limit?: number) => {
      return reviewsService.getByWorkspace(workspaceId, limit);
    },
  );

  ipcMain.handle(CHANNELS.reviews.getById, async (_, id: string) => {
    return reviewsService.getById(id);
  });

  ipcMain.handle(
    CHANNELS.reviews.create,
    async (_, payload: CreateReviewPayload) => {
      return reviewsService.create(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.reviews.update,
    async (_, id: string, payload: UpdateReviewPayload) => {
      return reviewsService.update(id, payload);
    },
  );

  ipcMain.handle(CHANNELS.reviews.delete, async (_, id: string) => {
    return reviewsService.delete(id);
  });
}

export function unregisterReviewsIpc(): void {
  [
    CHANNELS.reviews.getByWorkspace,
    CHANNELS.reviews.getById,
    CHANNELS.reviews.create,
    CHANNELS.reviews.update,
    CHANNELS.reviews.delete,
  ].forEach((channel) => ipcMain.removeHandler(channel));
}
