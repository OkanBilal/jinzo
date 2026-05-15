// ─────────────────────────────────────────────────────────────
// Space Payload Types
// ─────────────────────────────────────────────────────────────
export interface SpacePayload {
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

export interface SanitizedSpaceResult {
  data: Partial<SpacePayload>;
  errors: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────
export interface SpaceRecord {
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

// NOTE: This module's ServiceResponse intentionally diverges from the
// canonical envelope in src/shared/ipc-kit/service-response.ts because the
// failure branch carries per-field validation errors (`errors?: Record<string,
// string>`) used by space form mutations.
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

export function assertOk<T>(r: ServiceResponse<T>): asserts r is SuccessResponse<T> {
  if (!r.success) {
    const detail = r.error ?? (r.errors ? JSON.stringify(r.errors) : "unknown");
    throw new Error(`Expected ok, got error: ${detail}`);
  }
}

export function assertFail<T>(r: ServiceResponse<T>): asserts r is ErrorResponse {
  if (r.success) throw new Error("Expected failure, got ok");
}
