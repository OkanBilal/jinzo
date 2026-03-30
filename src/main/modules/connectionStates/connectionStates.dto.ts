import type { connectionStates } from "../../db/schema";

// ─────────────────────────────────────────────────────────────
// Database Record
// ─────────────────────────────────────────────────────────────
export type ConnectionStatesRecord = typeof connectionStates.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Request DTOs
// ─────────────────────────────────────────────────────────────
export interface UpdateConnectionStatesRequest {
  isConnected: boolean;
  connectionId?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Response DTOs
// ─────────────────────────────────────────────────────────────
export interface ConnectionStatesResponse {
  id: string;
  displayName: string | null;
  iconPath: string | null;
  isConnected: boolean;
  connectionId: string | null;
  category: string | null;
  sortOrder: number;
  enabledFeatures: string | null;
  config: string | null;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type ServiceResponse<T> = SuccessResponse<T> | ErrorResponse;
