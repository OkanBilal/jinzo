// ─────────────────────────────────────────────────────────────
// Workspace Types
// ─────────────────────────────────────────────────────────────

// Re-export Workspace and Provider from API modules as single source of truth
export type { Workspace } from "@/lib/redux/api/workspacesApi";
export type { Provider } from "@/lib/redux/api/providersApi";

export interface RunEvent {
  id: string;
  type: "log" | "tool_call" | "artifact" | "status";
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface Run {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  goal: string;
  title?: string;
  providerId: string;
  startedAt?: Date;
  endedAt?: Date;
  lastError?: string;
  createdAt?: Date;
}

export interface ToolCall {
  id: number;
  runId: string;
  toolId?: string;
  toolName: string;
  toolCallId?: string;
  input?: string;
  output?: string;
  status: string;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
}

export interface RunArtifact {
  id: number;
  runId: string;
  kind: string;
  path?: string;
  content?: string;
  metadata?: string;
  createdAt: Date;
}
