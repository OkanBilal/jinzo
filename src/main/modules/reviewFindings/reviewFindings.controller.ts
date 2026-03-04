import { reviewFindingsService } from "./reviewFindings.service";
import type {
  CreateReviewFindingPayload,
  UpdateReviewFindingPayload,
} from "./reviewFindings.dto";

// ─────────────────────────────────────────────────────────────
// Review Findings Controller
// ─────────────────────────────────────────────────────────────
export const reviewFindingsController = {
  getByWorkspace: (workspaceId: string) =>
    reviewFindingsService.getByWorkspace(workspaceId),
  getByReview: (reviewId: string, limit?: number) =>
    reviewFindingsService.getByReview(reviewId, limit),
  getById: (id: string) => reviewFindingsService.getById(id),
  create: (payload: CreateReviewFindingPayload) =>
    reviewFindingsService.create(payload),
  createMany: (payloads: CreateReviewFindingPayload[]) =>
    reviewFindingsService.createMany(payloads),
  update: (id: string, payload: UpdateReviewFindingPayload) =>
    reviewFindingsService.update(id, payload),
  delete: (id: string) => reviewFindingsService.delete(id),
};
