import { reviewsService } from "./reviews.service";
import type { CreateReviewPayload, UpdateReviewPayload } from "./reviews.dto";

// ─────────────────────────────────────────────────────────────
// Reviews Controller
// ─────────────────────────────────────────────────────────────
export const reviewsController = {
  getByWorkspace: (workspaceId: string, limit?: number) =>
    reviewsService.getByWorkspace(workspaceId, limit),
  getById: (id: string) => reviewsService.getById(id),
  create: (payload: CreateReviewPayload) => reviewsService.create(payload),
  update: (id: string, payload: UpdateReviewPayload) =>
    reviewsService.update(id, payload),
  delete: (id: string) => reviewsService.delete(id),
};
