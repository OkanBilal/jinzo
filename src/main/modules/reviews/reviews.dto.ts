// ─────────────────────────────────────────────────────────────
// Review Types
// ─────────────────────────────────────────────────────────────

export type ReviewStatus = "open" | "in_review" | "approved" | "rejected";

export interface ReviewResponse {
  id: string;
  workspaceId: string | null;
  title: string;
  summary: string | null;
  status: ReviewStatus;
  runId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReviewPayload {
  id?: string;
  workspaceId?: string;
  title: string;
  summary?: string;
  status?: ReviewStatus;
  runId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateReviewPayload {
  title?: string;
  summary?: string;
  status?: ReviewStatus;
  runId?: string;
  metadata?: Record<string, unknown>;
}

export type { ServiceResponse } from "../../../shared/ipc-kit/service-response";
