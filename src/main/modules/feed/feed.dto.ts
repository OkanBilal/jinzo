// ─────────────────────────────────────────────────────────────
// Query Types
// ─────────────────────────────────────────────────────────────
export interface FeedQueryParams {
  connectionIds: string[];
  eventTypes: string[];
  itemTypes: string[];
  entityId?: string;
  limit: number;
}

export interface FeedQueryOptions {
  connectionIds?: string[];
  eventTypes?: string[];
  itemTypes?: string[];
  entityId?: string;
  limit?: number;
}

// ─────────────────────────────────────────────────────────────
// Feed Item Type
// ─────────────────────────────────────────────────────────────
export interface FeedItemRecord {
  id: number;
  accountId: string;
  entityId: string | null;
  connectionId: string | null;
  eventType: string;
  itemType: string;
  title: string | null;
  snapshot: string | null;
  occurredAt: Date | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type ServiceResponse<T> = SuccessResponse<T> | ErrorResponse;
