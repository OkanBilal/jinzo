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

export interface CronJobResult {
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

export interface CronJobStats {
  inserted: number;
  skipped: number;
  errors: number;
  totalChunks: number;
}

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

export interface FeedQueryParams {
  sources: string[];
  itemTypes: string[];
  limit: number;
}

export interface ParsedQueryParams {
  sources: string[];
  itemTypes: string[];
  limit: number;
}
