// ─────────────────────────────────────────────────────────────
// Review Finding Types
// ─────────────────────────────────────────────────────────────

export type FindingSeverity = "critical" | "warning" | "info";

export interface ReviewFindingResponse {
  id: string;
  reviewId: string;
  severity: FindingSeverity;
  file: string;
  lineStart: number | null;
  lineEnd: number | null;
  message: string;
  reason: string;
  suggestion: string | null;
  validated: boolean;
  isApproved: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CreateReviewFindingPayload {
  id?: string;
  reviewId: string;
  severity: FindingSeverity;
  file: string;
  lineStart?: number;
  lineEnd?: number;
  message: string;
  reason: string;
  suggestion?: string;
  validated?: boolean;
  isApproved?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateReviewFindingPayload {
  severity?: FindingSeverity;
  file?: string;
  lineStart?: number | null;
  lineEnd?: number | null;
  message?: string;
  reason?: string;
  suggestion?: string | null;
  validated?: boolean;
  isApproved?: boolean;
  metadata?: Record<string, unknown> | null;
}

// ─────────────────────────────────────────────────────────────
// Service Response
// ─────────────────────────────────────────────────────────────

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
