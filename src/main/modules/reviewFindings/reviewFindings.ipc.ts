import { ipcMain } from "electron";
import { reviewFindingsController } from "./reviewFindings.controller";
import type {
  CreateReviewFindingPayload,
  UpdateReviewFindingPayload,
} from "./reviewFindings.dto";

// ─────────────────────────────────────────────────────────────
// IPC Channel Names
// ─────────────────────────────────────────────────────────────
const CHANNELS = {
  GET_BY_WORKSPACE: "reviewFindings:getByWorkspace",
  GET_BY_REVIEW: "reviewFindings:getByReview",
  GET_BY_ID: "reviewFindings:getById",
  CREATE: "reviewFindings:create",
  CREATE_MANY: "reviewFindings:createMany",
  UPDATE: "reviewFindings:update",
  DELETE: "reviewFindings:delete",
} as const;

// ─────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────
export function registerReviewFindingsIpc(): void {
  ipcMain.handle(
    CHANNELS.GET_BY_WORKSPACE,
    async (_, workspaceId: string) => {
      return reviewFindingsController.getByWorkspace(workspaceId);
    },
  );

  ipcMain.handle(
    CHANNELS.GET_BY_REVIEW,
    async (_, reviewId: string, limit?: number) => {
      return reviewFindingsController.getByReview(reviewId, limit);
    },
  );

  ipcMain.handle(CHANNELS.GET_BY_ID, async (_, id: string) => {
    return reviewFindingsController.getById(id);
  });

  ipcMain.handle(
    CHANNELS.CREATE,
    async (_, payload: CreateReviewFindingPayload) => {
      return reviewFindingsController.create(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.CREATE_MANY,
    async (_, payloads: CreateReviewFindingPayload[]) => {
      return reviewFindingsController.createMany(payloads);
    },
  );

  ipcMain.handle(
    CHANNELS.UPDATE,
    async (_, id: string, payload: UpdateReviewFindingPayload) => {
      return reviewFindingsController.update(id, payload);
    },
  );

  ipcMain.handle(CHANNELS.DELETE, async (_, id: string) => {
    return reviewFindingsController.delete(id);
  });
}

export function unregisterReviewFindingsIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
