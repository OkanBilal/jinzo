import { ipcMain } from "electron";
import { reviewsService } from "./reviews.service";
import type { CreateReviewPayload, UpdateReviewPayload } from "./reviews.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  GET_BY_WORKSPACE: "reviews:getByWorkspace",
  GET_BY_ID: "reviews:getById",
  CREATE: "reviews:create",
  UPDATE: "reviews:update",
  DELETE: "reviews:delete",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerReviewsIpc(): void {
  ipcMain.handle(
    CHANNELS.GET_BY_WORKSPACE,
    async (_, workspaceId: string, limit?: number) => {
      return reviewsService.getByWorkspace(workspaceId, limit);
    },
  );

  ipcMain.handle(CHANNELS.GET_BY_ID, async (_, id: string) => {
    return reviewsService.getById(id);
  });

  ipcMain.handle(
    CHANNELS.CREATE,
    async (_, payload: CreateReviewPayload) => {
      return reviewsService.create(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.UPDATE,
    async (_, id: string, payload: UpdateReviewPayload) => {
      return reviewsService.update(id, payload);
    },
  );

  ipcMain.handle(CHANNELS.DELETE, async (_, id: string) => {
    return reviewsService.delete(id);
  });
}

export function unregisterReviewsIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
