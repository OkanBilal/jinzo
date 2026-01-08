import type { ItemTypeId, SourceId } from "../rag";

export interface FeedListParams {
  limit?: number;
  offset?: number;
  sources?: SourceId[];
  itemTypes?: ItemTypeId[];
  startDate?: string;
  endDate?: string;
}

export interface FeedSearchParams {
  query: string;
  limit?: number;
  sources?: SourceId[];
  itemTypes?: ItemTypeId[];
  startDate?: string;
  endDate?: string;
}

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

export interface FeedListResult {
  items: FeedItemResult[];
  total: number;
  limit: number;
  offset: number;
}

export interface FeedSearchResult {
  items: FeedItemResult[];
  total: number;
  query: string;
}

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
