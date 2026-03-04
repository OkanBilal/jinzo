import { reviewFindingsRepo } from "./reviewFindings.repo";
import type {
  CreateReviewFindingPayload,
  UpdateReviewFindingPayload,
  ReviewFindingResponse,
  ServiceResponse,
} from "./reviewFindings.dto";

// ─────────────────────────────────────────────────────────────
// Review Findings Service
// ─────────────────────────────────────────────────────────────
export const reviewFindingsService = {
  // TODO: Filtering is done in JS for simplicity. Consider moving to SQL if data volume grows.
  async getByWorkspace(
    workspaceId: string,
  ): Promise<ServiceResponse<ReviewFindingResponse[]>> {
    try {
      const allFindings =
        await reviewFindingsRepo.findByWorkspace(workspaceId);

      // Per file, keep only findings from the most recent review
      const latestReviewByFile = new Map<string, string>();
      const latestTimeByFile = new Map<string, number>();

      for (const f of allFindings) {
        const ts = (f.reviewCreatedAt as any) instanceof Date
          ? f.reviewCreatedAt.getTime()
          : Number(f.reviewCreatedAt) * 1000;
        const existing = latestTimeByFile.get(f.file);
        if (existing === undefined || ts > existing) {
          latestTimeByFile.set(f.file, ts);
          latestReviewByFile.set(f.file, f.reviewId);
        }
      }

      const filtered = allFindings
        .filter((f) => latestReviewByFile.get(f.file) === f.reviewId)
        .map(({ reviewCreatedAt: _, ...rest }) => rest);

      return { success: true, data: filtered };
    } catch (error) {
      console.error(
        `[ReviewFindingsService] Failed to get findings for workspace ${workspaceId}:`,
        error,
      );
      return { success: false, error: "Failed to get workspace findings" };
    }
  },

  async getByReview(
    reviewId: string,
    limit?: number,
  ): Promise<ServiceResponse<ReviewFindingResponse[]>> {
    try {
      const findings = await reviewFindingsRepo.findByReview(reviewId, limit);
      return { success: true, data: findings };
    } catch (error) {
      console.error(
        `[ReviewFindingsService] Failed to get findings for review ${reviewId}:`,
        error,
      );
      return { success: false, error: "Failed to get review findings" };
    }
  },

  async getById(
    id: string,
  ): Promise<ServiceResponse<ReviewFindingResponse>> {
    try {
      const finding = await reviewFindingsRepo.findById(id);
      if (!finding) {
        return { success: false, error: "Review finding not found" };
      }
      return { success: true, data: finding };
    } catch (error) {
      console.error(
        `[ReviewFindingsService] Failed to get finding ${id}:`,
        error,
      );
      return { success: false, error: "Failed to get review finding" };
    }
  },

  async create(
    payload: CreateReviewFindingPayload,
  ): Promise<ServiceResponse<string>> {
    try {
      const id = await reviewFindingsRepo.insert(payload);
      return { success: true, data: id };
    } catch (error) {
      console.error(
        "[ReviewFindingsService] Failed to create finding:",
        error,
      );
      return { success: false, error: "Failed to create review finding" };
    }
  },

  async createMany(
    payloads: CreateReviewFindingPayload[],
  ): Promise<ServiceResponse<string[]>> {
    try {
      const ids = await reviewFindingsRepo.insertMany(payloads);
      return { success: true, data: ids };
    } catch (error) {
      console.error(
        "[ReviewFindingsService] Failed to create findings:",
        error,
      );
      return { success: false, error: "Failed to create review findings" };
    }
  },

  async update(
    id: string,
    payload: UpdateReviewFindingPayload,
  ): Promise<ServiceResponse<ReviewFindingResponse>> {
    try {
      const updated = await reviewFindingsRepo.update(id, payload);
      if (!updated) {
        return { success: false, error: "Review finding not found" };
      }
      return { success: true, data: updated };
    } catch (error) {
      console.error(
        `[ReviewFindingsService] Failed to update finding ${id}:`,
        error,
      );
      return { success: false, error: "Failed to update review finding" };
    }
  },

  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await reviewFindingsRepo.remove(id);
      return { success: true };
    } catch (error) {
      console.error(
        `[ReviewFindingsService] Failed to delete finding ${id}:`,
        error,
      );
      return { success: false, error: "Failed to delete review finding" };
    }
  },
};
