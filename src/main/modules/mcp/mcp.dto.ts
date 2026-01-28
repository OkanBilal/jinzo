// ─────────────────────────────────────────────────────────────
// Entity Types
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Sync Types
// ─────────────────────────────────────────────────────────────
export interface SyncResult {
  success: boolean;
  entitiesProcessed?: number;
  entitiesInserted?: number;
  chunksCreated?: number;
  embeddingsGenerated?: number;
  duration?: number;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Mood Types
// ─────────────────────────────────────────────────────────────
export interface MoodSwitchResult {
  success: boolean;
  mood: string;
  message: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Journal Types
// ─────────────────────────────────────────────────────────────
export interface JournalMetadata {
  status: "draft" | "published" | "archived";
  wordCount: number;
  mood?: string;
  tags?: string[];
}

export interface JournalAppendResult {
  success: boolean;
  message: string;
  entityId?: string;
  newWordCount?: number;
  error?: string;
}

export interface JournalTitleUpdateResult {
  success: boolean;
  message: string;
  entityId?: string;
  oldTitle?: string;
  newTitle?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// MCP Response Types
// ─────────────────────────────────────────────────────────────
export interface FormattedTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface CallToolPayload {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface MCPToolResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface OllamaToolFunction {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ─────────────────────────────────────────────────────────────
// Ollama Tool Types
// ─────────────────────────────────────────────────────────────
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
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

// ─────────────────────────────────────────────────────────────
// Response Types
// ─────────────────────────────────────────────────────────────
export interface ToolContent {
  type: "text";
  text: string;
}

export interface ToolResponse {
  content: ToolContent[];
  isError?: boolean;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: string;
  data?: ToolResponse;
}

export type ServiceResponse<T> = SuccessResponse<T> | ErrorResponse;

// ─────────────────────────────────────────────────────────────
// Deprecated Types (Backward Compatibility)
// ─────────────────────────────────────────────────────────────
/** @deprecated Use EntityListParams instead */
export type FeedListParams = EntityListParams;

/** @deprecated Use EntitySearchParams instead */
export type FeedSearchParams = EntitySearchParams;

/** @deprecated Use EntityListResult instead */
export type FeedListResult = EntityListResult;

/** @deprecated Use EntitySearchResult instead */
export type FeedSearchResult = EntitySearchResult;

/** @deprecated Use SyncResult instead */
export type CronSyncResult = SyncResult;
