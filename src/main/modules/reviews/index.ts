export { registerReviewsIpc, unregisterReviewsIpc } from "./reviews.ipc";
export { reviewsService } from "./reviews.service";
export { reviewsRepo } from "./reviews.repo";
export type {
  ReviewStatus,
  ReviewResponse,
  CreateReviewPayload,
  UpdateReviewPayload,
  ServiceResponse,
} from "./reviews.dto";
