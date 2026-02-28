// ─────────────────────────────────────────────────────────────
// Run Types
// ─────────────────────────────────────────────────────────────

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type RunContextKind = "file" | "selection" | "diff" | "git" | "terminal" | "env" | "note";
export type RunArtifactKind = "patch" | "file" | "log" | "report" | "command_result" | "result";
export type RunCommandStatus = "queued" | "running" | "done" | "error" | "canceled";
export type ToolCallStatus = "queued" | "running" | "done" | "error" | "canceled";

// ─────────────────────────────────────────────────────────────
// Run DTOs
// ─────────────────────────────────────────────────────────────
export interface CreateRunPayload {
  id: string;
  accountId: string;
  workspaceId?: string;
  spaceId?: string;
  providerId: string;
  model?: string;
  title?: string;
  goal?: string;
  status?: RunStatus;
  systemPrompt?: string;
  configSnapshot?: Record<string, unknown>;
  toolPolicySnapshot?: Record<string, unknown>;
}

export interface UpdateRunPayload {
  title?: string;
  goal?: string;
  status?: RunStatus;
  model?: string;
  systemPrompt?: string;
  configSnapshot?: Record<string, unknown>;
  toolPolicySnapshot?: Record<string, unknown>;
  startedAt?: Date;
  endedAt?: Date | null;
  lastError?: string | null;
  stopReason?: string | null;
  sessionId?: string | null;
}

export interface RunResponse {
  id: string;
  accountId: string;
  workspaceId: string | null;
  spaceId: string | null;
  providerId: string;
  model: string | null;
  title: string | null;
  goal: string | null;
  status: RunStatus;
  systemPrompt: string | null;
  configSnapshot: Record<string, unknown> | null;
  toolPolicySnapshot: Record<string, unknown> | null;
  startedAt: Date | null;
  endedAt: Date | null;
  lastError: string | null;
  stopReason: string | null;
  sessionId: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Run Context DTOs
// ─────────────────────────────────────────────────────────────
export interface CreateRunContextPayload {
  runId: string;
  kind: RunContextKind;
  ref?: string;
  content?: string;
  entityId?: string;
  contentHash?: string;
  metadata?: Record<string, unknown>;
}

export interface RunContextResponse {
  id: number;
  runId: string;
  kind: RunContextKind;
  ref: string | null;
  content: string | null;
  entityId: string | null;
  contentHash: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Run Artifact DTOs
// ─────────────────────────────────────────────────────────────
export interface CreateRunArtifactPayload {
  runId: string;
  kind: RunArtifactKind;
  path?: string;
  content?: string;
  blobData?: Buffer;
  entityId?: string;
  contentHash?: string;
  metadata?: Record<string, unknown>;
}

export interface RunArtifactResponse {
  id: number;
  runId: string;
  kind: RunArtifactKind;
  path: string | null;
  content: string | null;
  blobData: Buffer | null;
  entityId: string | null;
  contentHash: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Run Command DTOs
// ─────────────────────────────────────────────────────────────
export interface CreateRunCommandPayload {
  runId: string;
  cwd?: string;
  command: string;
  envKeys?: string[];
  status?: RunCommandStatus;
}

export interface UpdateRunCommandPayload {
  status?: RunCommandStatus;
  startedAt?: Date;
  endedAt?: Date;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  metadata?: Record<string, unknown>;
}

export interface RunCommandResponse {
  id: number;
  runId: string;
  cwd: string | null;
  command: string;
  envKeys: string[] | null;
  status: RunCommandStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// Tool Call DTOs
// ─────────────────────────────────────────────────────────────
export interface CreateToolCallPayload {
  accountId: string;
  runId: string;
  providerId?: string;
  toolId?: string;
  toolName: string;
  status?: ToolCallStatus;
  input?: Record<string, unknown>;
  startedAt?: Date;
}

export interface UpdateToolCallPayload {
  status?: ToolCallStatus;
  output?: unknown;
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
  status: ToolCallStatus;
  input: Record<string, unknown> | null;
  output: unknown | null;
  error: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  latencyMs: number | null;
  costMicros: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────
// File Attachment Types
// ─────────────────────────────────────────────────────────────

/** A file attachment serialized for IPC transport (base64-encoded data) */
export interface FileAttachment {
  /** Original file name */
  name: string;
  /** Attachment category */
  type: "image" | "document";
  /** Base64-encoded file data */
  data: string;
  /** MIME type (e.g. "image/png", "application/pdf") */
  mimeType: string;
}

// ─────────────────────────────────────────────────────────────
// Execute Run DTOs (for starting work runs)
// ─────────────────────────────────────────────────────────────

/** Context item provided when starting a run */
export interface StartRunContextItem {
  kind: "file" | "diff" | "selection" | "note";
  ref?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/** Payload for starting a new work run */
export interface StartRunPayload {
  accountId: string;
  workspaceId: string;
  spaceId?: string;
  providerId: string; // e.g., "copilot_cli"
  goal: string;
  model?: string;
  systemPrompt?: string;
  initialContext?: StartRunContextItem[];
  configSnapshot?: Record<string, unknown>;
  toolPolicySnapshot?: Record<string, unknown>;
  /** File attachments (images/documents) serialized as base64 for IPC */
  attachments?: FileAttachment[];
}

/** Response when a run is started */
export interface StartRunResponse {
  runId: string;
}

/** Payload for continuing an existing run (resume session) */
export interface ContinueRunPayload {
  runId: string;
  accountId: string;
  /** The follow-up message to send */
  message: string;
  /** Additional context to add */
  additionalContext?: StartRunContextItem[];
  /** File attachments (images/documents) serialized as base64 for IPC */
  attachments?: FileAttachment[];
}

/** Response when a run is continued */
export interface ContinueRunResponse {
  runId: string;
  resumed: boolean;
}

/** Payload for forking an existing run's session into a new run */
export interface ForkRunPayload {
  /** The source run whose session will be forked */
  sourceRunId: string;
  accountId: string;
  /** The message/goal for the forked session */
  message: string;
  /** Additional context to add */
  additionalContext?: StartRunContextItem[];
  /** File attachments (images/documents) serialized as base64 for IPC */
  attachments?: FileAttachment[];
}

/** Response when a run is forked */
export interface ForkRunResponse {
  /** The new run ID created from the fork */
  runId: string;
  /** The source run that was forked from */
  sourceRunId: string;
}

/** Full run details with related data */
export interface RunDetailsResponse {
  run: RunResponse;
  context: RunContextResponse[];
  artifacts: RunArtifactResponse[];
  commands: RunCommandResponse[];
  toolCalls: ToolCallResponse[];
}

// ─────────────────────────────────────────────────────────────
// Tool Approval DTOs (interactive tool approval + AskUserQuestion)
// ─────────────────────────────────────────────────────────────
export interface ToolApprovalRequest {
  requestId: string;
  runId: string;
  toolName: string;
  toolInput?: Record<string, unknown>;
  kind: "tool_approval" | "ask_user";
  question?: string;
  options?: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
  timestamp: number;
}

export interface ToolApprovalResponse {
  requestId: string;
  approved: boolean;
  answer?: string;
}

// ─────────────────────────────────────────────────────────────
// Service Response
// ─────────────────────────────────────────────────────────────
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
