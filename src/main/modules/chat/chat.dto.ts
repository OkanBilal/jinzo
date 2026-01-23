import type { ItemTypeId, SourceMetadata as RagSourceMetadata, SourceId } from "./utils/rag";

// ─────────────────────────────────────────────────────────────
// Query Analysis
// ─────────────────────────────────────────────────────────────
export { analyzeQuery } from "./utils/rag";
export type { ItemTypeId, SourceId } from "./utils/rag";

export type QueryAnalysis = ReturnType<typeof import("./utils/rag").analyzeQuery>;

// ─────────────────────────────────────────────────────────────
// Source Metadata
// ─────────────────────────────────────────────────────────────
export interface SourceMetadata {
  title: string;
  url: string;
  source: string;
  itemType: string | null;
  date: Date;
  score: number;
  semanticScore?: number;
  keywordScore?: number;
}

// ─────────────────────────────────────────────────────────────
// Chat Response
// ─────────────────────────────────────────────────────────────
export interface ChatResponse {
  answer: string;
  sources: SourceMetadata[];
  sessionId: number | null;
  metadata: {
    queryType: string;
    totalRetrieved: number;
    usedInContext: number;
    cached?: boolean;
    error?: string;
    breakdown?: Record<string, number>;
    appliedFilters?: {
      sources: string[];
      itemTypes: string[];
      topK: number;
    };
    detectedFromQuery?: {
      sources: string[];
      itemTypes: string[];
    };
  };
}

// ─────────────────────────────────────────────────────────────
// Structured Output
// ─────────────────────────────────────────────────────────────
export interface StructuredOutputProperty {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  isArray: boolean;
  isRequired: boolean;
}

export interface StructuredOutputSchema {
  properties: StructuredOutputProperty[];
}

// ─────────────────────────────────────────────────────────────
// Chat Options
// ─────────────────────────────────────────────────────────────
export interface ChatOptions {
  mode?: "chat" | "rag" | "mcp";
  topK?: number;
  minScore?: number;
  noCache?: boolean;
  temperature?: number;
  top_p?: number;
  includeMetadata?: boolean;
  prioritizeSources?: SourceId[];
  sourceFilter?: SourceId[];
  itemTypeFilter?: ItemTypeId[];
  skipUserSave?: boolean;
  thinkingEnabled?: boolean;
  thinkingLevel?: "low" | "medium" | "high";
  structuredOutputEnabled?: boolean;
  structuredOutputSchema?: StructuredOutputSchema;
  /** User message ID for idempotency tracking - prevents duplicate generations */
  userMessageId?: number;
  /** Tool mode override */
  toolMode?: "chat" | "rag" | "mcp";
}

// ─────────────────────────────────────────────────────────────
// Chat Request
// ─────────────────────────────────────────────────────────────
export interface ChatRequestBody {
  question: string;
  model?: string;
  sessionId?: number;
  options?: ChatOptions;
}

// ─────────────────────────────────────────────────────────────
// Session DTOs (updated for new schema)
// ─────────────────────────────────────────────────────────────
export interface CreateSessionPayload {
  initialQuery?: string;
  model?: string;
  title?: string;
  providerId?: string;
  moodId?: string;
  systemPromptSnapshot?: string;
  providerConfigSnapshot?: string;
}

export interface UpdateSessionPayload {
  title?: string;
  providerId?: string;
  model?: string;
  moodId?: string;
  systemPromptSnapshot?: string;
  providerConfigSnapshot?: string;
}

export interface SessionResponse {
  id: number;
  title: string | null;
  initialQuery: string | null;
  providerId: string | null;
  model: string | null;
  moodId: string | null;
  systemPromptSnapshot: string | null;
  providerConfigSnapshot: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Message DTOs (updated for new schema)
// ─────────────────────────────────────────────────────────────
export interface CreateMessagePayload {
  sessionId: number;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  providerId?: string;
  model?: string;
  traceId?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  toolCallGroupId?: string;
}

export interface MessageResponse {
  id: number;
  sessionId: number;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  providerId: string | null;
  model: string | null;
  traceId: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  toolCallGroupId: string | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────
export interface ValidationResult {
  valid: boolean;
  error?: string;
  statusCode?: number;
}

// ─────────────────────────────────────────────────────────────
// Service Response
// ─────────────────────────────────────────────────────────────
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
export interface ChatConfig {
  temperature: number;
  top_p: number;
  topK: number;
  minScore: number;
  selectedModel: string;
  toolMode: "chat" | "rag" | "mcp";
  structuredOutputEnabled: boolean;
  structuredOutputSchema: StructuredOutputSchema;
}
