// ─────────────────────────────────────────────────────────────
// Sync Job Types
// ─────────────────────────────────────────────────────────────
export interface SyncJobResult {
  success: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  total: number;
  duration: number;
  stats: {
    itemsPerSecond: number;
  };
}

export interface SyncJobStats {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

// ─────────────────────────────────────────────────────────────
// Entity Types
// ─────────────────────────────────────────────────────────────
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[];

export interface EntityInput {
  kind: string;
  title: string;
  url: string;
  body: string | null;
  summary: string | null;
  occurredAt: string;
  connectionId?: string | null;
  resourceId?: string | null;
  externalId?: string | null;
  metadata?: JSONValue | null;
}

export interface EntityQueryParams {
  kinds: string[];
  connectionIds: string[];
  limit: number;
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
  data?: SyncJobResult;
  error: string;
}

export type ServiceResponse<T> = SuccessResponse<T> | ErrorResponse;
