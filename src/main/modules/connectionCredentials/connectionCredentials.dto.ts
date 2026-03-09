// ─────────────────────────────────────────────────────────────
// Payload Types
// ─────────────────────────────────────────────────────────────
export interface SaveCredentialsPayload {
  provider: string;
  connectionId: string;
  // Provider-specific fields
  token?: string; // github
  apiKey?: string; // linear
  accessToken?: string; // asana
  apiToken?: string; // jira
  domain?: string; // jira
  email?: string; // jira
  [key: string]: unknown;
}

export interface ParsedCredentials {
  secrets: Record<string, string>;
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
