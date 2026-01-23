// ─────────────────────────────────────────────────────────────
// Response DTOs
// ─────────────────────────────────────────────────────────────
export interface SuccessResponse {
  success: true;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type ServiceResponse = SuccessResponse | ErrorResponse;
