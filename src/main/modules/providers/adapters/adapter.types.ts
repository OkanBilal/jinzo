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
  kind: "patch" | "file" | "log" | "report" | "command_result" | "user-prompt" | string;
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
 * Union of all possible events emitted during a work run
 */
export type WorkRunEvent =
  | WorkRunLogEvent
  | WorkRunToolCallEvent
  | WorkRunCommandEvent
  | WorkRunArtifactEvent
  | WorkRunStatusEvent
  | WorkRunSubagentEvent;

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
export type StopReason = "end_turn" | "max_tokens" | "stop_sequence" | "refusal" | "tool_use" | null;

/**
 * Result returned when a work run completes
 */
export interface WorkRunResult {
  status: "succeeded" | "failed" | "canceled";
  summary?: string;
  stopReason?: StopReason;
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
  /** Whether to auto-restart on crash */
  autoRestart?: boolean;
  /** Default model to use */
  defaultModel?: string;
  /** Timeout in milliseconds for operations */
  timeout?: number;
  /** Whether to start the CLI process automatically */
  autoStart?: boolean;
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
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan";
  /** When true, overrides permissionMode to "plan" for the next run */
  planMode?: boolean;
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
  /** Whether the command is user-invocable */
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
  /** Whether the skill is user-invocable (can be triggered with /name). Default: true */
  userInvocable?: boolean;
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

  /**
   * Model to use for this subagent.
   * If omitted, uses the same model as the parent agent.
   *
   * - "sonnet": Good balance of capability and speed
   * - "opus": Most capable, use for complex analysis
   * - "haiku": Fastest, use for simple tasks
   * - "inherit": Use parent's model (same as omitting)
   */
  model?: AgentModelOption;
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
 */
export type HookEventName =
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "UserPromptSubmit"
  | "Stop"
  | "SubagentStart"
  | "SubagentStop"
  | "PreCompact"
  | "PermissionRequest"
  | "SessionStart"
  | "SessionEnd"
  | "Notification";

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
