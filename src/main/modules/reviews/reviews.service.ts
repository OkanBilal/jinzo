import { ok, fail } from "../../../shared/ipc-kit/service-response";
import { reviewsRepo } from "./reviews.repo";
import type {
  CreateReviewPayload,
  UpdateReviewPayload,
  ReviewResponse,
  ServiceResponse,
} from "./reviews.dto";

// ─────────────────────────────────────────────────────────────
// Reviews Service
// ─────────────────────────────────────────────────────────────
export const reviewsService = {
  async getByWorkspace(
    workspaceId: string,
    limit?: number,
  ): Promise<ServiceResponse<ReviewResponse[]>> {
    try {
      const reviews = await reviewsRepo.findByWorkspace(workspaceId, limit);
      return ok(reviews);
    } catch (error) {
      console.error(
        `[ReviewsService] Failed to get reviews for workspace ${workspaceId}:`,
        error,
      );
      return fail("Failed to get reviews");
    }
  },

  async getById(id: string): Promise<ServiceResponse<ReviewResponse>> {
    try {
      const review = await reviewsRepo.findById(id);
      if (!review) {
        return fail("Review not found");
      }
      return ok(review);
    } catch (error) {
      console.error(`[ReviewsService] Failed to get review ${id}:`, error);
      return fail("Failed to get review");
    }
  },

  async create(
    payload: CreateReviewPayload,
  ): Promise<ServiceResponse<string>> {
    try {
      const id = await reviewsRepo.insert(payload);
      return ok(id);
    } catch (error) {
      console.error("[ReviewsService] Failed to create review:", error);
      return fail("Failed to create review");
    }
  },

  async update(
    id: string,
    payload: UpdateReviewPayload,
  ): Promise<ServiceResponse<ReviewResponse>> {
    try {
      const updated = await reviewsRepo.update(id, payload);
      if (!updated) {
        return fail("Review not found");
      }
      return ok(updated);
    } catch (error) {
      console.error(`[ReviewsService] Failed to update review ${id}:`, error);
      return fail("Failed to update review");
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await reviewsRepo.remove(id);
      return ok(undefined);
    } catch (error) {
      console.error(`[ReviewsService] Failed to delete review ${id}:`, error);
      return fail("Failed to delete review");
    }
  },
};
