import { ipcMain } from "electron";
import { reviewFindingsService } from "./reviewFindings.service";
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
      return reviewFindingsService.getByWorkspace(workspaceId);
    },
  );

  ipcMain.handle(
    CHANNELS.GET_BY_REVIEW,
    async (_, reviewId: string, limit?: number) => {
      return reviewFindingsService.getByReview(reviewId, limit);
    },
  );

  ipcMain.handle(CHANNELS.GET_BY_ID, async (_, id: string) => {
    return reviewFindingsService.getById(id);
  });

  ipcMain.handle(
    CHANNELS.CREATE,
    async (_, payload: CreateReviewFindingPayload) => {
      return reviewFindingsService.create(payload);
    },
  );

  ipcMain.handle(
    CHANNELS.CREATE_MANY,
    async (_, payloads: CreateReviewFindingPayload[]) => {
      return reviewFindingsService.createMany(payloads);
    },
  );

  ipcMain.handle(
    CHANNELS.UPDATE,
    async (_, id: string, payload: UpdateReviewFindingPayload) => {
      return reviewFindingsService.update(id, payload);
    },
  );

  ipcMain.handle(CHANNELS.DELETE, async (_, id: string) => {
    return reviewFindingsService.delete(id);
  });
}

export function unregisterReviewFindingsIpc(): void {
  Object.values(CHANNELS).forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
}
