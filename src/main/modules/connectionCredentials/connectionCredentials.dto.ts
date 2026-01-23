// ─────────────────────────────────────────────────────────────
// Payload Types
// ─────────────────────────────────────────────────────────────
export interface SaveCredentialsPayload {
  provider: string;
  connectionId: string;
  // Provider-specific fields
  token?: string; // github, raindrop
  apiKey?: string; // podcast
  userId?: string; // podcast
  developerToken?: string; // apple-music
  userToken?: string; // apple-music
  accessToken?: string; // spotify
  [key: string]: unknown;
}

export interface ParsedCredentials {
  accessToken: string | null;
  refreshToken: string | null;
  tokensForHash: string[];
}

// ─────────────────────────────────────────────────────────────
// Result Types
// ─────────────────────────────────────────────────────────────
export interface CredentialsCheckResult {
  hasCredentials: boolean;
  status: string;
  connectionId: string;
}

export interface SaveCredentialsResult {
  message: string;
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
