// ─────────────────────────────────────────────────────────────
// Workspace Activity Types
// ─────────────────────────────────────────────────────────────

export type ActivityType = "diff" | "review" | "finding" | "commit" | "pr";

export interface ActivityResponse {
  id: string;
  workspaceId: string;
  type: ActivityType;
  title: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  refId: string | null;
  createdAt: Date;
}

export interface CreateActivityPayload {
  id?: string;
  workspaceId: string;
  type: ActivityType;
  title: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  refId?: string;
}

// ─────────────────────────────────────────────────────────────
// Service Response
// ─────────────────────────────────────────────────────────────

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
