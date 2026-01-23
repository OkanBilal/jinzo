// ─────────────────────────────────────────────────────────────
// Metadata Types
// ─────────────────────────────────────────────────────────────
export interface JournalMetadata {
  status: "draft" | "published";
  wordCount?: number;
  lastIndexedAt?: number;
}

export interface FeedEventSnapshot {
  status: string;
  wordCount: number;
  chars?: number;
}

// ─────────────────────────────────────────────────────────────
// Journal Entry Types
// ─────────────────────────────────────────────────────────────
export interface JournalEntry {
  id: string;
  accountId: string;
  title: string | null;
  body: string | null;
  summary: string | null;
  metadata: JournalMetadata;
  occurredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Payload Types
// ─────────────────────────────────────────────────────────────
export interface CreateJournalDraftPayload {
  accountId: string;
  title?: string;
  body?: string;
  occurredAt?: Date;
}

export interface UpdateJournalDraftPayload {
  title?: string;
  body?: string;
  summary?: string;
  metadata?: Partial<JournalMetadata>;
}

// ─────────────────────────────────────────────────────────────
// Query Options
// ─────────────────────────────────────────────────────────────
export interface JournalQueryOptions {
  limit?: number;
}

export interface RevisionQueryOptions {
  limit?: number;
}

// ─────────────────────────────────────────────────────────────
// Revision Type
// ─────────────────────────────────────────────────────────────
export interface DocumentRevision {
  id: number;
  entityId: string;
  title: string | null;
  body: string | null;
  wordCount: number | null;
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
