// ─────────────────────────────────────────────────────────────
// Chunk Types
// ─────────────────────────────────────────────────────────────
export interface ChunkData {
  itemIndex: number;
  chunk: {
    content: string;
    index: number;
    tokenCount: number;
  };
}

export interface ItemChunkInfo {
  chunkIndex: number;
  embeddingIndex: number;
}

// ─────────────────────────────────────────────────────────────
// Sync Job Types
// ─────────────────────────────────────────────────────────────
export interface SyncJobResult {
  success: boolean;
  inserted: number;
  skipped: number;
  errors: number;
  total: number;
  totalChunks: number;
  duration: number;
  stats: {
    avgEmbeddingTime: number;
    itemsPerSecond: number;
    avgChunksPerItem: number;
  };
}

export interface SyncJobStats {
  inserted: number;
  skipped: number;
  errors: number;
  totalChunks: number;
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
// Legacy Types (Deprecated)
// ─────────────────────────────────────────────────────────────
/** @deprecated Use SyncJobResult instead */
export type CronJobResult = SyncJobResult;

/** @deprecated Use SyncJobStats instead */
export type CronJobStats = SyncJobStats;

/** @deprecated Use EntityInput instead */
export interface FeedItem {
  title: string;
  url: string;
  description: string | null;
  date: string;
  source: string;
  imageUrl: string | null;
  metadata?: JSONValue | null;
  itemType: string | null;
  connectionId?: string | null;
  resourceId?: string | null;
}

/** Convert legacy FeedItem to EntityInput */
export function feedItemToEntityInput(item: FeedItem): EntityInput {
  return {
    kind: item.itemType || "unknown",
    title: item.title,
    url: item.url,
    body: item.description,
    summary: item.description?.substring(0, 500) || null,
    occurredAt: item.date,
    connectionId: item.connectionId,
    resourceId: item.resourceId,
    externalId: null,
    metadata: {
      source: item.source,
      imageUrl: item.imageUrl,
      ...(typeof item.metadata === "object" && item.metadata !== null
        ? item.metadata
        : {}),
    },
  };
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
