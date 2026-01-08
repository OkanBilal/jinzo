import { analyzeQuery } from "../rag";
import { SourceId, ItemTypeId } from "../rag";

export type QueryAnalysis = ReturnType<typeof analyzeQuery>;

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

export interface StructuredOutputProperty {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  isArray: boolean;
  isRequired: boolean;
}

export interface StructuredOutputSchema {
  properties: StructuredOutputProperty[];
}

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
  thinkingLevel?: 'low' | 'medium' | 'high';
  structuredOutputEnabled?: boolean;
  structuredOutputSchema?: StructuredOutputSchema;
}

export interface ChatRequestBody {
  question: string;
  model?: string;
  sessionId?: number;
  options?: ChatOptions;
}

export interface CreateSessionParams {
  initialQuery?: string;
  model?: string;
  title?: string;
}


export interface ValidationResult {
  valid: boolean;
  error?: string;
  statusCode?: number;
}
