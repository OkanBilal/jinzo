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

export type { ServiceResponse } from "../../../shared/ipc-kit/service-response";
