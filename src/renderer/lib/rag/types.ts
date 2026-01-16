import { SOURCES, ITEM_TYPES } from "../../lib/config";

// Cache
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

export interface CacheStats {
  size: number;
  entries: Array<{
    key: string;
    hits: number;
    age: number;
  }>;
}

// Chunking
export type ChunkConfig = {
  maxChunkSize?: number;
  minChunkSize?: number;
  overlap?: number;
  splitOn?: "paragraph" | "sentence" | "word";
};

export type TextChunk = {
  content: string;
  index: number;
  tokenCount: number;
};

// Prompt Optimizer

export interface SourceMetadata {
  id: string;
  displayName: string;
  patterns: string[];
  itemTypes?: string[];
}

export interface ItemTypeMetadata {
  id: string;
  displayName: string;
  patterns: string[];
  sources?: string[];
}

export type SourceId = (typeof SOURCES)[number]["id"];
export type ItemTypeId = (typeof ITEM_TYPES)[number]["id"];

export interface PromptBuilderOptions {
  maxTokens?: number;
  includeMetadata?: boolean;
  prioritizeSources?: SourceId[];
}

export interface QueryAnalysis {
  keywords: string[];
  detectedSources: SourceId[];
  detectedItemTypes: ItemTypeId[];
}

// Retrieval

export type RetrievedEntity = {
  id: string;
  title: string;
  url: string;
  body: string | null;
  summary: string | null;
  kind: string;
  occurredAt: Date;
  connectionId: string | null;
  score: number;
  semanticScore: number;
  keywordScore: number;
  metadata?: any;
};

/**
 * @deprecated Use RetrievedEntity instead
 */
export type RetrievedFeedItem = {
  id: number;
  title: string;
  url: string;
  description: string | null;
  source: string;
  date: Date;
  imageUrl: string | null;
  itemType: string | null;
  score: number;
  semanticScore: number;
  keywordScore: number;
  metadata?: any;
};

export type RetrievalOptions = {
  topK?: number;
  minScore?: number;
  recencyWeight?: number;
  semanticWeight?: number;
  keywordWeight?: number;
  kindFilter?: string[];
  connectionIdFilter?: string[];
  /** @deprecated Use kindFilter instead */
  sourceFilter?: string[];
  /** @deprecated Use kindFilter instead */
  itemTypeFilter?: string[];
  rerank?: boolean;
};
