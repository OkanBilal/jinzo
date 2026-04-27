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
 * A file attachment serialized for IPC transport (base64-encoded data).
 * Re-exported from runs.dto for adapter-level use.
 */
export interface FileAttachment {
  name: string;
  type: "image" | "document";
  /** Base64-encoded data — optional when `sourcePath` is provided. */
  data?: string;
  /** Absolute path to an existing on-disk file. Preferred over `data` to avoid base64 in memory. */
  sourcePath?: string;
  mimeType: string;
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
  /** File attachments (images/documents) to include in the prompt */
  attachments?: FileAttachment[];
  /** Structured context issues passed from the UI */
  contextIssues?: Array<{ provider: string; number?: number | null; title: string; body?: string | null }>;
  /** Structured context signals (error reports) passed from the UI */
  contextSignals?: Array<{ source: string; level: string; category: string; title: string; body?: string | null; stackTrace?: string | null; eventCount?: number }>;
  /** Structured context files passed from the UI */
  contextFiles?: Array<{ path: string }>;
  /**
   * Per-run hooks configuration that overrides or extends adapter-level hooks.
   * Useful for dynamic hook configuration based on the specific run context.
   */
  hooks?: HooksConfig;
  /**
   * Per-run subagents configuration that extends adapter-level agents.
   * Useful for defining task-specific subagents or overriding existing ones.
   *
   * Note: Include 'Task' in allowedTools to enable subagent invocation.
   */
  agents?: AgentsConfig;
}

/**
 * Log event emitted during a run
 */
export interface WorkRunLogEvent {
  type: "log";
  message: string;
  level?: "info" | "warn" | "error" | "resume" | "start" | "end" | "sdk-user";
  ts?: number;
  metadata?: Record<string, unknown>;
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
 * Artifact produced during a run
 */
export interface WorkRunArtifactEvent {
  type: "artifact";
  kind: "patch" | "file" | "log" | "report" | "command_result" | "user-prompt" | string;
  path?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  /** When true, pushed to renderer but NOT persisted to DB */
  ephemeral?: boolean;
  /** Identifies the streaming source — renderer uses this to accumulate deltas */
  streamId?: string;
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
 * Subagent lifecycle event emitted when a subagent is invoked or completes
 */
export interface WorkRunSubagentEvent {
  type: "subagent";
  /** The lifecycle phase of the subagent */
  phase: "invoked" | "running" | "completed" | "failed";
  /** The name/type of the subagent (e.g., "code-reviewer", "general-purpose") */
  agentType: string;
  /** Unique identifier for this subagent invocation */
  agentId?: string;
  /** The tool_use_id that spawned this subagent (correlates with parent agent) */
  parentToolUseId?: string;
  /** The prompt/task given to the subagent */
  prompt?: string;
  /** Result from the subagent (when phase is "completed") */
  result?: string;
  /** Error message (when phase is "failed") */
  error?: string;
  /** Timestamp */
  ts?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Prompt suggestion event emitted after a turn completes
 */
export interface WorkRunPromptSuggestionEvent {
  type: "prompt_suggestion";
  suggestion: string;
  ts?: number;
}

/**
 * Union of all possible events emitted during a work run
 */
export type WorkRunEvent =
  | WorkRunLogEvent
  | WorkRunToolCallEvent
  | WorkRunArtifactEvent
  | WorkRunStatusEvent
  | WorkRunSubagentEvent
  | WorkRunPromptSuggestionEvent;

/**
 * Artifact summary in the result
 */
export interface WorkRunArtifactSummary {
  id?: number;
  kind: string;
  path?: string;
}

/**
 * Stop reason indicating why the model stopped generating.
 * Maps to Claude Agent SDK's ResultMessage.stop_reason field.
 */
export type StopReason = string | null;

/**
 * Per-model token/cost breakdown from SDK modelUsage
 */
export interface ModelUsageEntry {
  costUSD: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests?: number;
  contextWindow?: number;
  maxOutputTokens?: number;
}

/**
 * Usage data captured from a completed work run
 */
export interface WorkRunUsage {
  totalCostUsd?: number;
  durationMs?: number;
  numTurns?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  model?: string;
  modelUsage?: Record<string, ModelUsageEntry>;
}

/**
 * Result returned when a work run completes
 */
export interface WorkRunResult {
  status: "succeeded" | "failed" | "canceled";
  summary?: string;
  stopReason?: StopReason;
  artifacts?: WorkRunArtifactSummary[];
  usage?: WorkRunUsage;
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
  /** Model to use for this continuation (overrides provider default) */
  model?: string | null;
  /** Additional context to add */
  context?: WorkRunContextItem[];
  /** File attachments (images/documents) to include in the prompt */
  attachments?: FileAttachment[];
  /** Structured context issues to inject into this follow-up */
  contextIssues?: Array<{ provider: string; number?: number | null; title: string; body?: string | null }>;
  /** Structured context signals (error reports) to inject into this follow-up */
  contextSignals?: Array<{ source: string; level: string; category: string; title: string; body?: string | null; stackTrace?: string | null; eventCount?: number }>;
  /** Structured context files to inject into this follow-up */
  contextFiles?: Array<{ path: string }>;
  /**
   * Per-run hooks configuration for this continuation.
   * Useful for dynamic hook configuration based on the continuation context.
   */
  hooks?: HooksConfig;
  /**
   * Per-run subagents configuration for this continuation.
   * Allows adding or overriding subagents for specific continuation tasks.
   */
  agents?: AgentsConfig;
}

/**
 * Request to fork an existing run's session into a new run.
 * Creates a new session branched from the source run's session state.
 */
export interface WorkRunForkRequest {
  /** The new run ID for the forked session */
  runId: string;
  /** The source run whose session will be forked */
  sourceRunId: string;
  accountId: string;
  workspace: {
    id: string;
    rootPath: string;
  };
  /** The message/goal for the forked session */
  message: string;
  /** Model to use for this fork (overrides provider default) */
  model?: string | null;
  /** Additional context to add */
  context?: WorkRunContextItem[];
  /** File attachments (images/documents) to include in the prompt */
  attachments?: FileAttachment[];
  /** Per-run hooks configuration */
  hooks?: HooksConfig;
  /** Per-run subagents configuration */
  agents?: AgentsConfig;
}

/**
 * Target scope for a native code review
 */
export interface WorkRunReviewTarget {
  type: "uncommittedChanges" | "baseBranch" | "commit" | "custom";
  /** Branch name for baseBranch target */
  branch?: string;
  /** Commit SHA for commit target */
  sha?: string;
  /** Commit title for commit target */
  title?: string;
  /** Free-form instructions for custom target */
  instructions?: string;
}

/**
 * Request to start a native code review run
 */
export interface WorkRunReviewRequest {
  runId: string;
  accountId: string;
  workspace: {
    id: string;
    rootPath: string;
  };
  target: WorkRunReviewTarget;
  /** inline = review on same thread (default), detached = fork new review thread */
  delivery?: "inline" | "detached";
  model?: string | null;
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
   * Fork an existing run's session into a new run.
   * Creates a new session branched from the source run's session state,
   * leaving the original session unchanged.
   * @param request - The fork request with sourceRunId, new runId, and message
   * @param onEvent - Callback invoked for each event during the run
   * @returns Promise resolving to the final result when the forked run completes
   */
  forkRun?(request: WorkRunForkRequest, onEvent: WorkRunEventHandler): Promise<WorkRunResult>;

  /**
   * Start a native code review run using the provider's built-in review mode.
   * Falls back to startRun with a review goal if not implemented.
   * @param request - The review configuration with target scope
   * @param onEvent - Callback invoked for each event during the review
   * @returns Promise resolving to the final result when the review completes
   */
  reviewRun?(request: WorkRunReviewRequest, onEvent: WorkRunEventHandler): Promise<WorkRunResult>;

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

  /**
   * List available models with their metadata.
   * @returns Promise resolving to array of ModelInfo
   * @throws Error if not authenticated or client not connected
   */
  listModels?(): Promise<ModelInfo[]>;

  /**
   * List available slash commands.
   * @returns Promise resolving to array of CommandInfo
   */
  listCommands?(): Promise<CommandInfo[]>;

  /**
   * List available skills.
   * Skills are SKILL.md files that extend Claude's capabilities.
   * @param workspacePath - Optional workspace path for discovering project skills
   * @returns Promise resolving to array of SkillInfo
   */
  listSkills?(workspacePath?: string): Promise<SkillInfo[]>;

  /**
   * Generate a short title for a run based on its goal and context.
   * Used to produce a human-readable tab title instead of truncated goal text.
   * @param goal - The user's goal/prompt for the run
   * @param context - Optional context items provided to the run
   * @returns Promise resolving to a short title string (3-6 words)
   */
  generateTitle?(goal: string, context?: WorkRunContextItem[]): Promise<string>;

  /**
   * Get current rate limit information from the provider.
   * @returns Promise resolving to rate limit data, or null if not supported
   */
  getRateLimits?(): Promise<RateLimitInfo | null>;

  /**
   * Read account info from the provider.
   */
  getAccountInfo?(): Promise<CodexAccountInfo>;

  /**
   * List available plugins from the provider's marketplace.
   * @returns Promise resolving to plugin marketplace data
   */
  listPlugins?(): Promise<PluginListResponse>;

  /**
   * Read detailed plugin info including skills, apps, and MCP servers.
   */
  readPlugin?(pluginName: string, marketplacePath: string): Promise<PluginDetail>;

  /**
   * Install a plugin by ID.
   * @param pluginId - The plugin ID to install
   */
  installPlugin?(pluginId: string): Promise<void>;

  /**
   * Uninstall a plugin by ID.
   * @param pluginId - The plugin ID to uninstall
   */
  uninstallPlugin?(pluginId: string): Promise<void>;
}

/**
 * Rate limit information from a provider
 */
export interface RateLimitInfo {
  planType?: string;
  primary?: RateLimitWindow;
  secondary?: RateLimitWindow;
  credits?: { hasCredits: boolean; balance?: string; unlimited: boolean };
}

export interface RateLimitWindow {
  /** Percentage used (0-100) */
  usedPercent: number;
  /** Window duration in minutes */
  windowDurationMins?: number;
  /** Unix timestamp when the window resets */
  resetsAt?: number;
}

/**
 * Configuration for OpenAI Codex adapter
 */
export interface CodexAdapterConfig {
  /** Path to codex CLI binary (defaults to "codex" from PATH) */
  binary?: string;
  /** Optional API key. If omitted, the Codex CLI uses cached auth from ~/.codex/auth.json (via `codex` login or `codex login --device-auth`), or OPENAI_API_KEY / CODEX_API_KEY env vars */
  apiKey?: string;
  /** Default model to use (e.g., "gpt-5.4", "gpt-5.4-mini") */
  defaultModel?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Permission mode for tool access */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
  /** Approval policy passed to Codex CLI (no interactive hooks — CLI handles internally) */
  approvalMode?: "untrusted" | "on-request" | "on-failure" | "never";
  /** Sandbox mode for file/network isolation */
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
  /** Model reasoning effort level */
  modelReasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  /** Enable network access within sandbox_workspace_write mode */
  networkAccessEnabled?: boolean;
  /** Web search mode */
  webSearchMode?: "disabled" | "cached" | "live";
  /** Skip git repo check for non-git directories */
  skipGitRepoCheck?: boolean;
  /** Thread personality — controls the agent's conversational style */
  personality?: "friendly" | "pragmatic" | "none";
  /** Additional directories the agent can access */
  additionalDirectories?: string[];
  /** Base URL override for OpenAI API */
  baseUrl?: string;
  /** Additional Codex CLI config overrides (passed as --config key=value) */
  config?: Record<string, unknown>;
}

/**
 * Configuration for Copilot adapter stored in providers.config
 */
export interface CopilotAdapterConfig {
  /** Path to copilot CLI binary (defaults to "copilot" from PATH) */
  binary?: string;
  /** Transport method: "stdio" (default) or "tcp" */
  useStdio?: boolean;
  /** TCP port if transport is "tcp" */
  port?: number;
  /** URL of existing CLI server to connect to */
  cliUrl?: string;
  /** Log level for the SDK */
  logLevel?: "debug" | "info" | "warning" | "error" | "none" | "all";
  /** Default model to use */
  defaultModel?: string;
  /** Timeout in milliseconds for operations */
  timeout?: number;
  /** Whether to start the CLI process automatically */
  autoStart?: boolean;
  /** GitHub token for authentication — takes priority over other auth methods */
  githubToken?: string;
  /** Whether to use stored OAuth tokens or gh CLI auth (default: true) */
  useLoggedInUser?: boolean;
  /** Permission mode for tool access */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
}

/**
 * Configuration for Claude Code adapter
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
  /** Permission mode for tool access */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk" | "auto";
  /**
   * Setting sources for loading skills and other filesystem settings.
   * - "user": Load from ~/.claude/skills/
   * - "project": Load from .claude/skills/ in the working directory
   */
  settingSources?: Array<"user" | "project">;
  /**
   * Hooks configuration for intercepting agent behavior.
   * Hooks let you validate, log, block, or transform agent actions at key execution points.
   *
   * @example
   * ```ts
   * hooks: {
   *   PreToolUse: [{
   *     matcher: 'Write|Edit',
   *     hooks: [async (input, toolUseId, { signal }) => {
   *       if (input.tool_input?.file_path?.endsWith('.env')) {
   *         return {
   *           hookSpecificOutput: {
   *             hookEventName: 'PreToolUse',
   *             permissionDecision: 'deny',
   *             permissionDecisionReason: 'Cannot modify .env files'
   *           }
   *         };
   *       }
   *       return {};
   *     }]
   *   }],
   *   PostToolUse: [{
   *     hooks: [async (input) => {
   *       console.log(`Tool ${input.tool_name} completed`);
   *       return {};
   *     }]
   *   }]
   * }
   * ```
   */
  hooks?: HooksConfig;
  /**
   * Subagents configuration for delegating specialized tasks.
   * Subagents maintain separate context and can have restricted tool access.
   *
   * @example
   * ```ts
   * agents: {
   *   'code-reviewer': {
   *     description: 'Expert code reviewer for quality and security reviews.',
   *     prompt: 'You are a code review specialist...',
   *     tools: ['Read', 'Grep', 'Glob'],
   *     model: 'sonnet'
   *   },
   *   'test-runner': {
   *     description: 'Runs and analyzes test suites.',
   *     prompt: 'You are a test execution specialist...',
   *     tools: ['Bash', 'Read', 'Grep']
   *   }
   * }
   * ```
   */
  agents?: AgentsConfig;
  /** Saved JSON Schema definitions for structured output */
  structuredOutputs?: Record<string, StructuredOutputEntry>;
  /** ID of the currently selected structured output schema (null = disabled) */
  structuredOutputsSelectedId?: string | null;
  /** When true, enables adaptive thinking (extended reasoning) */
  thinkingMode?: boolean;
  /** When true, enables fast mode (faster output, same model) */
  fastMode?: boolean;
  /** Effort level for thinking depth (requires thinkingMode) */
  effortLevel?: "low" | "medium" | "high" | "max";
}

/**
 * Configuration for Cursor adapter (ACP protocol)
 */
export interface CursorAdapterConfig {
  /** Path to cursor CLI binary (defaults to "cursor" from PATH) */
  binary?: string;
  /** Optional API key. If omitted, uses cached auth from `cursor login` or CURSOR_API_KEY env var */
  apiKey?: string;
  /** Default model to use (e.g., "gpt-5.2", "claude-4-sonnet-thinking") */
  defaultModel?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Agent mode: "agent" (default), "plan", or "ask" */
  mode?: "agent" | "plan" | "ask";
  /** Enable sandbox for file/network isolation */
  sandboxEnabled?: boolean;
  /** Enable cloud execution */
  cloudEnabled?: boolean;
}

/**
 * A persisted JSON Schema entry for structured output
 */
export interface StructuredOutputEntry {
  id: string;
  name: string;
  schema: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/**
 * Model information returned by adapters
 */
export interface ModelInfo {
  /** Model identifier (e.g., "gpt-4o", "claude-3-5-sonnet") */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Model version or variant */
  version?: string;
  /** Whether this is the default model for the provider */
  isDefault?: boolean;
  /** Model capabilities */
  capabilities?: {
    streaming?: boolean;
    vision?: boolean;
    functionCalling?: boolean;
    reasoning?: boolean;
  };
  /** Context window size in tokens */
  contextWindow?: number;
  /** Whether this model supports fast mode */
  supportsFastMode?: boolean;
  /** Whether this model supports effort levels */
  supportsEffort?: boolean;
  /** Available effort levels for this model */
  supportedEffortLevels?: ('minimal' | 'low' | 'medium' | 'high' | 'max' | 'xhigh')[];
  /** Model description */
  description?: string;
  // TODO: expose in UI — model supports auto mode selection
  supportsAutoMode?: boolean;
  // TODO: expose in UI — model supports adaptive thinking (Claude decides when to think)
  supportsAdaptiveThinking?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Command/slash command information returned by adapters
 */
export interface CommandInfo {
  /** Command name (e.g., "help", "clear", "compact") */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Hint for command arguments */
  argumentHint?: string;
  /** Whether the command is user-invokable */
  userFacing?: boolean;
}

/**
 * Skill information returned by adapters
 * Skills are Claude Agent SDK capabilities defined as SKILL.md files
 */
export interface SkillInfo {
  /** Skill name (e.g., "explain-code", "deploy") */
  name: string;
  /** Human-readable description of what the skill does */
  description?: string;
  /** Hint for skill arguments (from argument-hint frontmatter) */
  argumentHint?: string;
  /** Whether the skill is user-invokable (can be triggered with /name). Default: true */
  userInvokable?: boolean;
  /** Whether Claude can automatically invoke this skill. Default: true (false if disable-model-invocation is set) */
  modelInvocable?: boolean;
  /** Source location: "user" (~/.claude/skills/) or "project" (.claude/skills/) */
  source?: "user" | "project";
  /** Model to use when skill is active */
  model?: string;
  /** Whether skill runs in forked subagent context (context: fork) */
  forked?: boolean;
  /** Agent type for forked context */
  agent?: string;
  /** Full path to the SKILL.md file */
  path?: string;
}

// ─────────────────────────────────────────────────────────────
// Claude Agent SDK Subagents Types
// ─────────────────────────────────────────────────────────────

/**
 * Model options for subagents
 * - "sonnet": Use Claude Sonnet model
 * - "opus": Use Claude Opus model (most capable)
 * - "haiku": Use Claude Haiku model (fastest)
 * - "inherit": Use the same model as the parent agent
 */
export type AgentModelOption = "sonnet" | "opus" | "haiku" | "inherit";

/**
 * Definition for a subagent that can be spawned by the main agent.
 * Subagents maintain separate context and can have specialized instructions and tool restrictions.
 *
 * @example
 * ```ts
 * const codeReviewer: AgentDefinition = {
 *   description: 'Expert code reviewer for quality and security reviews.',
 *   prompt: `You are a code review specialist with expertise in security and best practices.
 *
 * When reviewing code:
 * - Identify security vulnerabilities
 * - Check for performance issues
 * - Suggest specific improvements`,
 *   tools: ['Read', 'Grep', 'Glob'],
 *   model: 'sonnet'
 * };
 * ```
 */
export interface AgentDefinition {
  /**
   * Natural language description of when to use this agent.
   * Claude uses this to decide whether to delegate tasks to this subagent.
   * Write clear descriptions that explain the agent's specialty.
   *
   * @example "Expert code reviewer for quality and security reviews"
   * @example "Test execution specialist for running and analyzing test suites"
   */
  description: string;

  /**
   * The agent's system prompt defining its role, behavior, and expertise.
   * This is the instruction set the subagent follows when executing tasks.
   *
   * @example
   * ```
   * You are a code review specialist with expertise in security, performance, and best practices.
   *
   * When reviewing code:
   * - Identify security vulnerabilities
   * - Check for performance issues
   * - Verify adherence to coding standards
   * - Suggest specific improvements
   *
   * Be thorough but concise in your feedback.
   * ```
   */
  prompt: string;

  /**
   * Array of tool names the subagent is allowed to use.
   * If omitted, the agent inherits all tools from the parent.
   *
   * Common tool combinations:
   * - Read-only analysis: ['Read', 'Grep', 'Glob']
   * - Test execution: ['Bash', 'Read', 'Grep']
   * - Code modification: ['Read', 'Edit', 'Write', 'Grep', 'Glob']
   *
   * Note: Do NOT include 'Task' in a subagent's tools - subagents cannot spawn their own subagents.
   */
  tools?: string[];

  /** Array of tool names to explicitly disallow for this agent */
  disallowedTools?: string[];

  /**
   * Model to use for this subagent.
   * If omitted, uses the same model as the parent agent.
   */
  model?: AgentModelOption;

  /** MCP server configurations specific to this subagent */
  mcpServers?: (string | Record<string, unknown>)[];

  /** Array of skill names to preload into the agent context */
  skills?: string[];

  /** Auto-submitted as the first user turn when this agent starts. Slash commands are processed. */
  initialPrompt?: string;

  /** Maximum number of agentic turns (API round-trips) before stopping */
  maxTurns?: number;

  /** Experimental: Critical reminder added to system prompt */
  criticalSystemReminder_EXPERIMENTAL?: string;
}

/**
 * Configuration object mapping agent names to their definitions.
 * Agent names should be kebab-case identifiers.
 *
 * @example
 * ```ts
 * const agents: AgentsConfig = {
 *   'code-reviewer': {
 *     description: 'Expert code reviewer',
 *     prompt: 'You are a code review specialist...',
 *     tools: ['Read', 'Grep', 'Glob']
 *   },
 *   'test-runner': {
 *     description: 'Test execution specialist',
 *     prompt: 'You are a test execution specialist...',
 *     tools: ['Bash', 'Read', 'Grep']
 *   }
 * };
 * ```
 */
export type AgentsConfig = Record<string, AgentDefinition>;

// ─────────────────────────────────────────────────────────────
// Claude Agent SDK Hooks Types
// ─────────────────────────────────────────────────────────────

/**
 * Hook event names supported by the Claude Agent SDK
 * TODO:
 */
export type HookEventName =
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "UserPromptSubmit"
  | "Stop"
  | "StopFailure"
  | "SubagentStart"
  | "SubagentStop"
  | "PreCompact"
  | "PostCompact"
  | "PermissionRequest"
  | "SessionStart"
  | "SessionEnd"
  | "Notification"
  | "Setup"
  | "TeammateIdle"
  | "TaskCreated"
  | "TaskCompleted"
  | "Elicitation"
  | "ElicitationResult"
  | "ConfigChange"
  | "WorktreeCreate"
  | "WorktreeRemove"
  | "InstructionsLoaded"
  | "CwdChanged"
  | "FileChanged";

/**
 * Base input fields common to all hook callbacks
 */
export interface HookInputBase {
  /** The hook event type that triggered this callback */
  hook_event_name: HookEventName;
  /** Current session identifier */
  session_id: string;
  /** Path to the conversation transcript */
  transcript_path: string;
  /** Current working directory */
  cwd: string;
}

/**
 * Input data for PreToolUse hook
 */
export interface PreToolUseHookInput extends HookInputBase {
  hook_event_name: "PreToolUse";
  /** Name of the tool being called */
  tool_name: string;
  /** Arguments passed to the tool */
  tool_input: Record<string, unknown>;
}

/**
 * Input data for PostToolUse hook
 */
export interface PostToolUseHookInput extends HookInputBase {
  hook_event_name: "PostToolUse";
  /** Name of the tool that was called */
  tool_name: string;
  /** Arguments that were passed to the tool */
  tool_input: Record<string, unknown>;
  /** Result returned from tool execution */
  tool_response: unknown;
}

/**
 * Input data for PostToolUseFailure hook
 */
export interface PostToolUseFailureHookInput extends HookInputBase {
  hook_event_name: "PostToolUseFailure";
  /** Name of the tool that failed */
  tool_name: string;
  /** Arguments that were passed to the tool */
  tool_input: Record<string, unknown>;
  /** Error message from tool execution failure */
  error: string;
  /** Whether the failure was caused by an interrupt */
  is_interrupt: boolean;
}

/**
 * Input data for UserPromptSubmit hook
 */
export interface UserPromptSubmitHookInput extends HookInputBase {
  hook_event_name: "UserPromptSubmit";
  /** The user's prompt text */
  prompt: string;
}

/**
 * Input data for Stop hook
 */
export interface StopHookInput extends HookInputBase {
  hook_event_name: "Stop";
  /** Whether a stop hook is currently processing */
  stop_hook_active: boolean;
}

/**
 * Input data for SubagentStart hook
 */
export interface SubagentStartHookInput extends HookInputBase {
  hook_event_name: "SubagentStart";
  /** Unique identifier for the subagent */
  agent_id: string;
  /** Type/role of the subagent */
  agent_type: string;
}

/**
 * Input data for SubagentStop hook
 */
export interface SubagentStopHookInput extends HookInputBase {
  hook_event_name: "SubagentStop";
  /** Unique identifier for the subagent */
  agent_id: string;
  /** Path to the subagent's conversation transcript */
  agent_transcript_path: string;
  /** Whether a stop hook is currently processing */
  stop_hook_active: boolean;
}

/**
 * Input data for PreCompact hook
 */
export interface PreCompactHookInput extends HookInputBase {
  hook_event_name: "PreCompact";
  /** What triggered compaction: "manual" or "auto" */
  trigger: "manual" | "auto";
  /** Custom instructions provided for compaction */
  custom_instructions?: string;
}

/**
 * Input data for PermissionRequest hook
 */
export interface PermissionRequestHookInput extends HookInputBase {
  hook_event_name: "PermissionRequest";
  /** Name of the tool requesting permission */
  tool_name: string;
  /** Arguments passed to the tool */
  tool_input: Record<string, unknown>;
  /** Suggested permission updates for the tool */
  permission_suggestions?: unknown[];
}

/**
 * Input data for SessionStart hook
 */
export interface SessionStartHookInput extends HookInputBase {
  hook_event_name: "SessionStart";
  /** How the session started: "startup", "resume", "clear", or "compact" */
  source: "startup" | "resume" | "clear" | "compact";
}

/**
 * Input data for SessionEnd hook
 */
export interface SessionEndHookInput extends HookInputBase {
  hook_event_name: "SessionEnd";
  /** Why the session ended */
  reason:
    | "clear"
    | "logout"
    | "prompt_input_exit"
    | "bypass_permissions_disabled"
    | "other";
}

/**
 * Input data for Notification hook
 */
export interface NotificationHookInput extends HookInputBase {
  hook_event_name: "Notification";
  /** Status message from the agent */
  message: string;
  /** Type of notification */
  notification_type:
    | "permission_prompt"
    | "idle_prompt"
    | "auth_success"
    | "elicitation_dialog";
  /** Optional title set by the agent */
  title?: string;
}

/**
 * Union of all possible hook input types
 */
export type HookInput =
  | PreToolUseHookInput
  | PostToolUseHookInput
  | PostToolUseFailureHookInput
  | UserPromptSubmitHookInput
  | StopHookInput
  | SubagentStartHookInput
  | SubagentStopHookInput
  | PreCompactHookInput
  | PermissionRequestHookInput
  | SessionStartHookInput
  | SessionEndHookInput
  | NotificationHookInput;

/**
 * Context passed to hook callbacks
 */
export interface HookContext {
  /** AbortSignal for cancellation - pass to async operations like fetch() */
  signal: AbortSignal;
}

/**
 * Hook-specific output for PreToolUse hooks
 */
export interface PreToolUseHookSpecificOutput {
  hookEventName: "PreToolUse";
  /** Permission decision: "allow" (auto-approve), "deny" (block), or "ask" (prompt) */
  permissionDecision?: "allow" | "deny" | "ask";
  /** Explanation for the permission decision */
  permissionDecisionReason?: string;
  /** Modified tool input (requires permissionDecision: "allow") */
  updatedInput?: Record<string, unknown>;
  /** Additional context to add to the conversation */
  additionalContext?: string;
}

/**
 * Hook-specific output for PostToolUse hooks
 */
export interface PostToolUseHookSpecificOutput {
  hookEventName: "PostToolUse";
  /** Additional context to add to the conversation */
  additionalContext?: string;
}

/**
 * Hook-specific output for UserPromptSubmit hooks
 */
export interface UserPromptSubmitHookSpecificOutput {
  hookEventName: "UserPromptSubmit";
  /** Additional context to add to the conversation */
  additionalContext?: string;
}

/**
 * Hook-specific output for SessionStart hooks
 */
export interface SessionStartHookSpecificOutput {
  hookEventName: "SessionStart";
  /** Additional context to add to the conversation */
  additionalContext?: string;
}

/**
 * Hook-specific output for SubagentStart hooks
 */
export interface SubagentStartHookSpecificOutput {
  hookEventName: "SubagentStart";
  /** Additional context to add to the conversation */
  additionalContext?: string;
}

/**
 * Generic hook-specific output for other hook types
 */
export interface GenericHookSpecificOutput {
  hookEventName: HookEventName;
  [key: string]: unknown;
}

/**
 * Union of all hook-specific output types
 */
export type HookSpecificOutput =
  | PreToolUseHookSpecificOutput
  | PostToolUseHookSpecificOutput
  | UserPromptSubmitHookSpecificOutput
  | SessionStartHookSpecificOutput
  | SubagentStartHookSpecificOutput
  | GenericHookSpecificOutput;

/**
 * Output returned from hook callbacks
 */
export interface HookOutput {
  /** Whether the agent should continue after this hook (default: true) */
  continue?: boolean;
  /** Message shown when continue is false */
  stopReason?: string;
  /** Hide stdout from the transcript (default: false) */
  suppressOutput?: boolean;
  /** Message injected into the conversation for Claude to see */
  systemMessage?: string;
  /** Hook-specific output for controlling tool execution */
  hookSpecificOutput?: HookSpecificOutput;
}

/**
 * Hook callback function signature
 * @param input - Event-specific input data
 * @param toolUseId - Correlates PreToolUse and PostToolUse events
 * @param context - Contains AbortSignal for cancellation
 * @returns Promise resolving to hook output, or empty object to allow operation
 */
export type HookCallback = (
  input: HookInput,
  toolUseId: string | null,
  context: HookContext,
) => Promise<HookOutput>;

/**
 * Hook matcher configuration
 * Defines which tools trigger the callbacks and how they're processed
 */
export interface HookMatcher {
  /**
   * Regex pattern to match tool names.
   * Built-in tools: Bash, Read, Write, Edit, Glob, Grep, WebFetch, Task, etc.
   * MCP tools: mcp__<server>__<action>
   * Omit to match all tools.
   */
  matcher?: string;
  /** Array of callback functions to execute when the pattern matches */
  hooks: HookCallback[];
  /** Timeout in seconds (default: 60). Increase for hooks that make external API calls */
  timeout?: number;
}

/**
 * Hooks configuration object
 * Keys are hook event names, values are arrays of matchers
 */
export type HooksConfig = {
  [K in HookEventName]?: HookMatcher[];
};

// ── Account Types ──

export interface CodexAccountInfo {
  account: {
    type: "apiKey";
  } | {
    type: "chatgpt";
    email: string;
    planType: string;
  } | null;
  requiresOpenaiAuth: boolean;
}

// ── Plugin Marketplace Types ──

export interface PluginInterface {
  displayName?: string;
  shortDescription?: string;
  longDescription?: string;
  developerName?: string;
  category?: string;
  capabilities: string[];
  websiteUrl?: string;
  defaultPrompt?: string[];
  brandColor?: string;
  composerIcon?: string;
  logo?: string;
  screenshots: string[];
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  source: { type: string; path: string };
  installed: boolean;
  enabled: boolean;
  installPolicy: "NOT_AVAILABLE" | "AVAILABLE" | "INSTALLED_BY_DEFAULT";
  authPolicy: "ON_INSTALL" | "ON_USE";
  interface: PluginInterface | null;
}

export interface MarketplaceInfo {
  name: string;
  path: string;
  interface: { displayName?: string } | null;
  plugins: PluginInfo[];
}

export interface PluginListResponse {
  marketplaces: MarketplaceInfo[];
  marketplaceLoadErrors: Array<{ marketplacePath: string; message: string }>;
  remoteSyncError: string | null;
  featuredPluginIds: string[];
}

export interface PluginSkillSummary {
  name: string;
  displayName?: string;
  path?: string;
  description?: string;
  shortDescription?: string;
  enabled: boolean;
}

export interface PluginAppSummary {
  id: string;
  name: string;
  needsAuth: boolean;
  description?: string;
  installUrl?: string;
  isAccessible?: boolean;
  isEnabled?: boolean;
}

export interface PluginDetail {
  marketplaceName: string;
  marketplacePath: string;
  summary: PluginInfo;
  description: string | null;
  skills: PluginSkillSummary[];
  apps: PluginAppSummary[];
  mcpServers: string[];
}
