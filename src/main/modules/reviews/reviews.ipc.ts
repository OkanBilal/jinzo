import { ipcMain } from "electron";
import { reviewsController } from "./reviews.controller";
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
      return reviewsController.getByWorkspace(workspaceId, limit);
    },
  );

  ipcMain.handle(CHANNELS.GET_BY_ID, async (_, id: string) => {
    return reviewsController.getById(id);
  });

  ipcMain.handle(
    CHANNELS.CREATE,
    async (_, payload: CreateReviewPayload) => {
      return reviewsController.create(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.UPDATE,
    async (_, id: string, payload: UpdateReviewPayload) => {
      return reviewsController.update(id, payload);
    },
  );

  ipcMain.handle(CHANNELS.DELETE, async (_, id: string) => {
    return reviewsController.delete(id);
  });
}

export function unregisterReviewsIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
