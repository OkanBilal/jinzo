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

/**
 * @deprecated Use SyncJobResult instead
 */
export type CronJobResult = SyncJobResult;

/**
 * @deprecated Use SyncJobStats instead
 */
export type CronJobStats = SyncJobStats;

export interface InsertionResult {
  success: boolean;
  itemId?: number;
  error?: string;
}

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JSONValue }
  | JSONValue[];

/**
 * EntityInput - Used for creating new entities from connection syncs
 * Maps to the entities table in the database
 */
export interface EntityInput {
  /** The kind of entity: issue, task, doc, bookmark, rss_article, podcast_episode, etc. */
  kind: string;
  /** Title of the entity */
  title: string;
  /** URL to the original resource */
  url: string;
  /** Main body/content (markdown or plain text) */
  body: string | null;
  /** Short summary for lists/LLM context */
  summary: string | null;
  /** When the entity was created/published at source */
  occurredAt: string;
  /** Connection ID that created this entity */
  connectionId?: string | null;
  /** Resource ID within the connection */
  resourceId?: string | null;
  /** External ID from the source system */
  externalId?: string | null;
  /** Provider-specific metadata as JSON */
  metadata?: JSONValue | null;
}

/**
 * @deprecated Use EntityInput instead - FeedItem is kept for backward compatibility
 */
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

/**
 * Convert legacy FeedItem to EntityInput
 */
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

export interface EntityQueryParams {
  kinds: string[];
  connectionIds: string[];
  limit: number;
}

export interface ParsedQueryParams {
  kinds: string[];
  connectionIds: string[];
  limit: number;
}
