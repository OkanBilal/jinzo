export interface EntityListParams {
  limit?: number;
  offset?: number;
  kinds?: string[];
  connectionIds?: string[];
  startDate?: string;
  endDate?: string;
}

export interface EntitySearchParams {
  query: string;
  limit?: number;
  kinds?: string[];
  connectionIds?: string[];
  startDate?: string;
  endDate?: string;
}

export interface EntityResult {
  id: string;
  title: string;
  url: string;
  body: string | null;
  summary: string | null;
  kind: string;
  occurredAt: string;
  connectionId: string | null;
  metadata: string | null;
}

export interface EntityListResult {
  entities: EntityResult[];
  total: number;
  limit: number;
  offset: number;
}

export interface EntitySearchResult {
  entities: EntityResult[];
  total: number;
  query: string;
}

/**
 * @deprecated Use EntityListParams instead
 */
export type FeedListParams = EntityListParams;

/**
 * @deprecated Use EntitySearchParams instead
 */
export type FeedSearchParams = EntitySearchParams;

/**
 * @deprecated Use EntityResult instead
 */
export interface FeedItemResult {
  id: number;
  title: string;
  url: string;
  description: string | null;
  itemType: string | null;
  date: string;
  source: string;
  imageUrl: string | null;
  metadata: string | null;
}

/**
 * @deprecated Use EntityListResult instead
 */
export type FeedListResult = EntityListResult;

/**
 * @deprecated Use EntitySearchResult instead
 */
export type FeedSearchResult = EntitySearchResult;

export interface SyncResult {
  success: boolean;
  entitiesProcessed?: number;
  entitiesInserted?: number;
  chunksCreated?: number;
  embeddingsGenerated?: number;
  duration?: number;
  error?: string;
}

/**
 * @deprecated Use SyncResult instead
 */
export type CronSyncResult = SyncResult;

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: string;
  };
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
}

export interface OllamaToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}
