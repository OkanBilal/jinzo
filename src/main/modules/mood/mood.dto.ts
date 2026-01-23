// ─────────────────────────────────────────────────────────────
// Mood Payload Types
// ─────────────────────────────────────────────────────────────
export interface MoodPayload {
  name: string;
  slug?: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  icon?: string;
  themeConfig?: string;
  uiConfig?: string;
  sortOrder?: number;
}

export interface SanitizedMoodResult {
  data: Partial<MoodPayload>;
  errors: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────
export interface MoodRecord {
  id: string;
  accountId: string;
  name: string;
  slug: string;
  description: string | null;
  systemPrompt: string | null;
  model: string | null;
  icon: string | null;
  themeConfig: string | null;
  uiConfig: string | null;
  sortOrder: number | null;
  isArchived: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error?: string;
  errors?: Record<string, string>;
}

export type ServiceResponse<T> = SuccessResponse<T> | ErrorResponse;
