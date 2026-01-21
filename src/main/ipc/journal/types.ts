export interface JournalMetadata {
  status: "draft" | "published";
  wordCount?: number;
  lastIndexedAt?: number;
}

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

export interface FeedEventSnapshot {
  status: string;
  wordCount: number;
  chars?: number;
}

export interface JournalQueryOptions {
  limit?: number;
}

export interface RevisionQueryOptions {
  limit?: number;
}
