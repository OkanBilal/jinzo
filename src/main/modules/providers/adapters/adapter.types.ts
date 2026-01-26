// ─────────────────────────────────────────────────────────────
// Work Run Adapter Types
// Agent/work runtime oriented interfaces for code-writing flows
// ─────────────────────────────────────────────────────────────

/**
 * Context item provided to a work run
 */
export interface WorkRunContextItem {
  kind: "file" | "diff" | "selection" | "note";
  /** Reference (e.g., file path, commit hash) */
  ref?: string;
  /** Inline content */
  content?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Request to start a work run
 */
export interface WorkRunRequest {
  runId: string;
  accountId: string;
  workspace: {
    id: string;
    rootPath: string;
  };
  goal: string;
  model?: string | null;
  systemPrompt?: string | null;
  context?: WorkRunContextItem[];
  toolPolicy?: Record<string, unknown> | null;
}

/**
 * Log event emitted during a run
 */
export interface WorkRunLogEvent {
  type: "log";
  message: string;
  level?: "info" | "warn" | "error";
  ts?: number;
}

/**
 * Tool call event emitted during a run
 */
export interface WorkRunToolCallEvent {
  type: "tool_call";
  toolName: string;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  startedAt?: number;
  endedAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Command execution event emitted during a run
 */
export interface WorkRunCommandEvent {
  type: "command";
  cwd?: string;
  command: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  startedAt?: number;
  endedAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Artifact produced during a run
 */
export interface WorkRunArtifactEvent {
  type: "artifact";
  kind: "patch" | "file" | "log" | "report" | "command_result";
  path?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Status change event emitted during a run
 */
export interface WorkRunStatusEvent {
  type: "status";
  status: "running" | "succeeded" | "failed" | "canceled";
  error?: string;
  ts?: number;
}

/**
 * Union of all possible events emitted during a work run
 */
export type WorkRunEvent =
  | WorkRunLogEvent
  | WorkRunToolCallEvent
  | WorkRunCommandEvent
  | WorkRunArtifactEvent
  | WorkRunStatusEvent;

/**
 * Artifact summary in the result
 */
export interface WorkRunArtifactSummary {
  id?: number;
  kind: string;
  path?: string;
}

/**
 * Result returned when a work run completes
 */
export interface WorkRunResult {
  status: "succeeded" | "failed" | "canceled";
  summary?: string;
  artifacts?: WorkRunArtifactSummary[];
}

/**
 * Callback for receiving events during a work run
 */
export type WorkRunEventHandler = (event: WorkRunEvent) => void | Promise<void>;

/**
 * Request to continue an existing run (resume session)
 */
export interface WorkRunContinueRequest {
  runId: string;
  accountId: string;
  workspace: {
    id: string;
    rootPath: string;
  };
  /** The follow-up message/goal */
  message: string;
  /** Additional context to add */
  context?: WorkRunContextItem[];
}

/**
 * Interface that all work run adapters must implement
 */
export interface WorkRunAdapter {
  /**
   * Start a work run with the given request.
   * Events are emitted via the onEvent callback during execution.
   * @param request - The run configuration
   * @param onEvent - Callback invoked for each event during the run
   * @returns Promise resolving to the final result when the run completes
   */
  startRun(request: WorkRunRequest, onEvent: WorkRunEventHandler): Promise<WorkRunResult>;

  /**
   * Continue an existing run by resuming its session and sending a follow-up message.
   * @param request - The continue request with runId and new message
   * @param onEvent - Callback invoked for each event during the run
   * @returns Promise resolving to the final result when the continuation completes
   */
  continueRun?(request: WorkRunContinueRequest, onEvent: WorkRunEventHandler): Promise<WorkRunResult>;

  /**
   * Abort a currently running work run.
   * @param runId - The ID of the run to abort
   */
  abortRun?(runId: string): Promise<void>;

  /**
   * Check if a session exists and can be resumed.
   * @param runId - The session/run ID to check
   * @returns Promise resolving to true if session can be resumed
   */
  canResumeSession?(runId: string): Promise<boolean>;

  /**
   * Delete a persisted session permanently.
   * @param runId - The session/run ID to delete
   */
  deleteSession?(runId: string): Promise<void>;

  /**
   * Gracefully shutdown the adapter, cleaning up resources.
   */
  shutdown?(): Promise<void>;
}

/**
 * Configuration for Copilot adapter stored in providers.config
 */
export interface CopilotAdapterConfig {
  /** Path to copilot CLI binary (defaults to "copilot" from PATH) */
  binary?: string;
  /** Transport mode: "stdio" (default) or TCP port */
  transport?: "stdio" | "tcp";
  /** TCP port if transport is "tcp" */
  port?: number;
  /** URL of existing CLI server to connect to */
  cliUrl?: string;
  /** Log level for the SDK */
  logLevel?: "debug" | "info" | "warning" | "error" | "none" | "all";
  /** Whether to auto-restart on crash */
  autoRestart?: boolean;
  /** Default model to use */
  defaultModel?: string;
  /** Timeout in milliseconds for operations */
  timeout?: number;
}

/**
 * Configuration for Claude Code adapter (future)
 */
export interface ClaudeCodeAdapterConfig {
  /** Path to claude CLI binary */
  binary?: string;
  /** API key (if not using CLI auth) */
  apiKey?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Timeout in milliseconds */
  timeout?: number;
}
