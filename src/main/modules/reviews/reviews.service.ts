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
      return { success: true, data: reviews };
    } catch (error) {
      console.error(
        `[ReviewsService] Failed to get reviews for workspace ${workspaceId}:`,
        error,
      );
      return { success: false, error: "Failed to get reviews" };
    }
  },

  async getById(id: string): Promise<ServiceResponse<ReviewResponse>> {
    try {
      const review = await reviewsRepo.findById(id);
      if (!review) {
        return { success: false, error: "Review not found" };
      }
      return { success: true, data: review };
    } catch (error) {
      console.error(`[ReviewsService] Failed to get review ${id}:`, error);
      return { success: false, error: "Failed to get review" };
    }
  },

  async create(
    payload: CreateReviewPayload,
  ): Promise<ServiceResponse<string>> {
    try {
      const id = await reviewsRepo.insert(payload);
      return { success: true, data: id };
    } catch (error) {
      console.error("[ReviewsService] Failed to create review:", error);
      return { success: false, error: "Failed to create review" };
    }
  },

  async update(
    id: string,
    payload: UpdateReviewPayload,
  ): Promise<ServiceResponse<ReviewResponse>> {
    try {
      const updated = await reviewsRepo.update(id, payload);
      if (!updated) {
        return { success: false, error: "Review not found" };
      }
      return { success: true, data: updated };
    } catch (error) {
      console.error(`[ReviewsService] Failed to update review ${id}:`, error);
      return { success: false, error: "Failed to update review" };
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await reviewsRepo.remove(id);
      return { success: true };
    } catch (error) {
      console.error(`[ReviewsService] Failed to delete review ${id}:`, error);
      return { success: false, error: "Failed to delete review" };
    }
  },
};
