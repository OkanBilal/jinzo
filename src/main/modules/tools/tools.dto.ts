// ─────────────────────────────────────────────────────────────
// Tool Types
// ─────────────────────────────────────────────────────────────

export type ToolSource = "local" | "mcp" | "provider_builtin";

export type ToolCallStatus =
  | "queued"
  | "running"
  | "done"
  | "error"
  | "canceled";

export interface ToolSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface ToolMetadata {
  author?: string;
  version?: string;
  category?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────
// Tool DTOs
// ─────────────────────────────────────────────────────────────
export interface CreateToolPayload {
  id: string;
  source: ToolSource;
  name: string;
  description?: string;
  version?: string;
  isEnabled?: boolean;
  schema?: ToolSchema;
  mcpServerId?: string;
  metadata?: ToolMetadata;
}

export interface UpdateToolPayload {
  name?: string;
  description?: string;
  version?: string;
  isEnabled?: boolean;
  schema?: ToolSchema;
  metadata?: ToolMetadata;
}

export interface ToolResponse {
  id: string;
  source: ToolSource;
  name: string;
  description: string | null;
  version: string | null;
  isEnabled: boolean;
  schema: ToolSchema | null;
  mcpServerId: string | null;
  metadata: ToolMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Tool Call DTOs
// ─────────────────────────────────────────────────────────────
export interface CreateToolCallPayload {
  accountId: string;
  runId?: string;
  providerId?: string;
  toolId?: string;
  toolName: string;
  toolCallId?: string | null;
  parentToolCallId?: string | null;
  status?: ToolCallStatus;
  metadata?: Record<string, unknown> | null;

  input?: Record<string, unknown>;
}

export interface UpdateToolCallPayload {
  status?: ToolCallStatus;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  endedAt?: Date;
  latencyMs?: number;
  costMicros?: number;
  metadata?: Record<string, unknown>;
}

export interface ToolCallResponse {
  id: number;
  accountId: string;
  runId: string | null;
  providerId: string | null;
  toolId: string | null;
  toolName: string;
  toolCallId: string | null;
  parentToolCallId: string | null;
  status: ToolCallStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  latencyMs: number | null;
  costMicros: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Service Response
// ─────────────────────────────────────────────────────────────
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
