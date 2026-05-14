import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type {
  WorkRunAdapter,
  WorkRunRequest,
  WorkRunContinueRequest,
  WorkRunForkRequest,
  WorkRunResult,
  WorkRunEventHandler,
  WorkRunEvent,
  WorkRunUsage,
  ClaudeCodeAdapterConfig,
  ModelInfo,
  CommandInfo,
  SkillInfo,
  HooksConfig,
  HookMatcher,
  AgentsConfig,
} from "../../../../shared/adapter.types";
import { findClaudeBinary, resolveCandidate } from "../providers.utils";
import {
  requestToolApproval,
  cancelPendingRequests,
  clearAllPendingRequests,
} from "../../runs/user-input-broker";
import type { ToolApprovalRequest } from "../../runs/runs.dto";
import { runsRepo } from "../../runs/runs.repo";
import { z } from "zod";
import {
  createLogger,
  ALLOWED_TOOLS_SET,
  safeJson,
  extractArtifactsFromToolOutput,
  formatContextSection,
  appendPromptSections,
  emitUserPromptArtifact,
} from "./adapter.shared";
import type { MainsToolContext } from "./mains-tools.core";
import {
  TOOL_DESCRIPTIONS,
  handleGetWorkspaceDiff,
  handleSaveReview,
  handleSaveFinding,
  handleSaveFindings,
  handleCommitChanges,
  handleCreatePR,
} from "./mains-tools.core";
import { guardsService } from "../../guards/guards.service";

/**
 * NOTE: This adapter uses @anthropic-ai/claude-agent-sdk package.
 * The SDK spawns the Claude Code CLI as a subprocess.
 */

/**
 * Tools that are pre-approved and skip the interactive approval dialog.
 * Imported from adapter.shared.ts — ALLOWED_TOOLS_SET used for auto-approval.
 */
//TODO: In the future, we may want to dynamically load this from the user's Claude Code config directory (~/.claude/permissions.json) to reflect their actual allowed tools, but for now we'll hardcode a default set of commonly used tools.

/**
 * SDK hook matcher format (matches SDK's expected structure)
 */
interface SDKHookMatcher {
  matcher?: string;
  hooks: Array<
    (
      input: Record<string, unknown>,
      toolUseId: string | null,
      context: { signal: AbortSignal },
    ) => Promise<Record<string, unknown>>
  >;
  timeout?: number;
}

/**
 * SDK hooks configuration format
 */
type SDKHooksConfig = {
  [key: string]: SDKHookMatcher[];
};

/**
 * SDK agent definition format (matches SDK's expected structure)
 */
interface SDKAgentDefinition {
  description: string;
  prompt: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: string;
  mcpServers?: (string | Record<string, unknown>)[];
  skills?: string[];
  initialPrompt?: string;
  maxTurns?: number;
  criticalSystemReminder_EXPERIMENTAL?: string;
}

/**
 * SDK agents configuration format
 */
type SDKAgentsConfig = Record<string, SDKAgentDefinition>;

/**
 * MCP server configuration types matching SDK's expected format
 */
interface McpStdioServerConfig {
  type?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpHttpServerConfig {
  type: "http";
  url: string;
  headers?: Record<string, string>;
}

interface McpSSEServerConfig {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
}

type McpServerConfig =
  | McpStdioServerConfig
  | McpHttpServerConfig
  | McpSSEServerConfig
  | Record<string, unknown>; // In-process SDK MCP server (McpSdkServerConfigWithInstance)

interface SDKOptions {
  outputFormat?: {
    type: "json_schema";
    schema: Record<string, unknown>;
  };
  model?: string;
  continue?: boolean;
  pathToClaudeCodeExecutable?: string;
  executable?: "node" | "bun" | "deno";
  executableArgs?: string[];
  env?: Record<string, string | undefined>;
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk" | "auto";
  cwd?: string;
  resume?: string;
  forkSession?: boolean;
  abortController?: AbortController;
  additionalDirectories?: string[];
  /**
   * Subagents configuration for delegating specialized tasks.
   * Keys are agent names, values are agent definitions.
   */
  agents?: SDKAgentsConfig;
  maxTurns?: number;
  systemPrompt?:
    | string
    | { type: "preset"; preset: "claude_code"; append?: string };
  /**
   * Setting sources for loading filesystem-based settings.
   * - "user": Load from ~/.claude/settings.json
   * - "project": Load from .claude/settings.json in cwd
   * - "local": Load from .claude/settings.local.json in cwd
   */
  settingSources?: Array<"user" | "project" | "local">;
  /**
   * Hooks configuration for intercepting agent behavior.
   * Run custom code at key points in the agent lifecycle.
   */
  hooks?: SDKHooksConfig;
  /**
   * MCP (Model Context Protocol) server configurations.
   * Keys are server names, values are server configurations.
   */
  mcpServers?: Record<string, McpServerConfig>;
  /**
   * Thinking mode configuration for extended reasoning.
   * - { type: "adaptive" }: Model decides when to use extended thinking
   * - { type: "disabled" }: No extended thinking
   */
  thinking?: { type: "adaptive" } | { type: "disabled" };
  effort?: "low" | "medium" | "high" | "max";
  settings?: Record<string, unknown>;
  promptSuggestions?: boolean;
  /**
   * Emit incremental `stream_event` messages with raw Anthropic content-block
   * deltas (text_delta, thinking_delta, …) for token-by-token streaming.
   */
  includePartialMessages?: boolean;
}

interface SDKMessageContent {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  id?: string;
}

interface SDKAssistantMessage {
  type: "assistant";
  uuid: string;
  session_id: string;
  message: {
    role: "assistant";
    content: SDKMessageContent[];
  };
  parent_tool_use_id: string | null;
}

interface SDKUserMessage {
  type: "user";
  uuid?: string;
  session_id: string;
  message: {
    role: "user";
    content: string | Array<{ type: string; text?: string }>;
  };
  parent_tool_use_id: string | null;
}

interface SDKModelUsage {
  costUSD: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  contextWindow: number;
  maxOutputTokens: number;
}

interface SDKPermissionDenial {
  tool_name: string;
  tool_use_id: string;
  tool_input: Record<string, unknown>;
}

type FastModeState = "off" | "cooldown" | "on";

interface SDKResultBase {
  type: "result";
  uuid: string;
  session_id: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  total_cost_usd: number;
  stop_reason: string | null;
  modelUsage: Record<string, SDKModelUsage>;
  permission_denials: SDKPermissionDenial[];
  fast_mode_state?: FastModeState;
}

interface SDKResultSuccess extends SDKResultBase {
  subtype: "success";
  result: string;
  structured_output?: unknown;
}

interface SDKResultError extends SDKResultBase {
  subtype:
    | "error_during_execution"
    | "error_max_turns"
    | "error_max_budget_usd"
    | "error_max_structured_output_retries";
  errors: string[];
}

type SDKResultMessage = SDKResultSuccess | SDKResultError;

interface SDKSystemMessage {
  type: "system";
  subtype: "init" | "compact_boundary";
  uuid: string;
  session_id: string;
  model?: string;
  cwd?: string;
  tools?: string[];
  permissionMode?: string;
  // TODO: expose in UI — session metadata from init message
  agents?: string[];
  apiKeySource?: string;
  betas?: string[];
  claude_code_version?: string;
  mcp_servers?: { name: string; status: string }[];
  slash_commands?: string[];
  output_style?: string;
  skills?: string[];
}

interface SDKRawStreamEvent {
  type: string;
  index?: number;
  content_block?: { type: string; [key: string]: unknown };
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
    partial_json?: string;
    [key: string]: unknown;
  };
  message?: { id?: string; [key: string]: unknown };
  [key: string]: unknown;
}

interface SDKPartialAssistantMessage {
  type: "stream_event";
  event: SDKRawStreamEvent;
  parent_tool_use_id: string | null;
  uuid: string;
  session_id: string;
}

type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKResultMessage
  | SDKSystemMessage
  | SDKPartialAssistantMessage
  | {
      type: string;
      session_id?: string;
      [key: string]: unknown;
    };

interface SDKModelInfo {
  value: string;
  displayName: string;
  description: string;
  supportsFastMode?: boolean;
  supportsEffort?: boolean;
  supportedEffortLevels?: ('low' | 'medium' | 'high' | 'max')[];
  // TODO: expose in UI — model supports auto mode selection
  supportsAutoMode?: boolean;
  // TODO: expose in UI — model supports adaptive thinking (Claude decides when to think)
  supportsAdaptiveThinking?: boolean;
}

interface SDKSlashCommand {
  name: string;
  description: string;
  argumentHint: string;
  /** Skill slash aliases — same shape as `@anthropic-ai/claude-agent-sdk` SlashCommand */
  aliases?: string[];
}

interface SDKInitializationResult {
  commands: SDKSlashCommand[];
  output_style: string;
  available_output_styles: string[];
  models: SDKModelInfo[];
  account: { email?: string; organization?: string };
}

interface SDKQuery extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  rewindFiles(userMessageUuid: string): Promise<void>;
  setPermissionMode(mode: string): Promise<void>;
  setModel(model?: string): Promise<void>;
  setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
  initializationResult(): Promise<SDKInitializationResult>;
  supportedCommands(): Promise<SDKSlashCommand[]>;
  supportedModels(): Promise<SDKModelInfo[]>;
  mcpServerStatus(): Promise<unknown[]>;
  accountInfo(): Promise<{ email?: string; organization?: string }>;
}

// Active run tracking for abort support
const activeRuns = new Map<
  string,
  {
    abortController: AbortController;
    aborted: boolean;
    sessionId?: string;
    query?: SDKQuery;
  }
>();

// Session ID tracking for resume capability
const sessionIdMap = new Map<string, string>();

// Cached models list (with TTL)
let cachedModels: ModelInfo[] | null = null;
let cachedModelsTimestamp = 0;
const MODELS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cached commands list (keyed by workspace path for disk-skill filtering, with TTL)
const commandsCache = new Map<
  string,
  { commands: CommandInfo[]; timestamp: number }
>();
const COMMANDS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cached skills list (keyed by workspacePath, with TTL)
const skillsCache = new Map<string, { skills: SkillInfo[]; timestamp: number }>();
const SKILLS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (skills may change more often during development)

const { info: logInfo, warn: logWarn, error: logError } = createLogger("[ClaudeAdapter]");

/**
 * Creates a Claude Agent SDK adapter instance
 */
export function createClaudeAdapter(
  config: ClaudeCodeAdapterConfig,
): WorkRunAdapter {
  let sdkLoaded = false;
  let loadError: Error | null = null;

  // SDK query function (lazy loaded)
  let queryFn:
    | ((options: { prompt: string; options?: SDKOptions }) => SDKQuery)
    | null = null;

  // SDK MCP server helpers (lazy loaded)
  let createSdkMcpServerFn: ((...args: any[]) => any) | null = null;
  let toolFn: ((...args: any[]) => any) | null = null;

  // Correlate tool events when toolName/input is missing in completion events
  const toolCallIndex = new Map<
    string,
    { toolName: string; input?: unknown; startedAt?: number }
  >();

  // Accumulated text per (runId, content_block_index) for streaming UI.
  // Replaced (not appended) by the renderer each emit, so we send full text.
  const partialTextBuffers = new Map<string, string>();
  const partialThinkingBuffers = new Map<string, string>();

  async function ensureSDK(): Promise<void> {
    if (loadError) {
      throw loadError;
    }

    if (sdkLoaded) {
      return;
    }

    try {
      // Dynamic import to avoid compile-time dependency
      const ClaudeSDK = await import("@anthropic-ai/claude-agent-sdk").catch(
        () => null,
      );

      if (!ClaudeSDK) {
        throw new Error(
          "Claude Agent SDK (@anthropic-ai/claude-agent-sdk) is not installed. " +
            "Please install it to use the Claude provider: npm install @anthropic-ai/claude-agent-sdk",
        );
      }

      // Stable API uses query() function
      const query = (ClaudeSDK as any).query;

      if (!query) {
        throw new Error(
          "Could not find query() in @anthropic-ai/claude-agent-sdk. " +
            "Make sure you have the latest version installed.",
        );
      }

      queryFn = query;

      // Capture in-process MCP server helpers
      createSdkMcpServerFn = (ClaudeSDK as any).createSdkMcpServer ?? null;
      toolFn = (ClaudeSDK as any).tool ?? null;

      sdkLoaded = true;
      logInfo("SDK loaded successfully (stable API)");
    } catch (error) {
      loadError = error instanceof Error ? error : new Error(String(error));
      logError("Failed to load SDK:", loadError.message);
      throw loadError;
    }
  }

  function getModel(requestModel?: string | null): string {
    return requestModel || config.defaultModel || "claude-opus-4-6";
  }

  /**
   * Build SDK options with proper executable path
   * When using CLI (subscription mode), we strip ANTHROPIC_API_KEY from env
   * to avoid unexpected API billing when user has CLI login session.
   */
  async function buildOptions(
    model: string,
    workspacePath?: string,
    abortController?: AbortController,
    resumeSessionId?: string,
    runHooks?: HooksConfig,
    runAgents?: AgentsConfig,
    runId?: string,
    workspaceId?: string,
    forkSession?: boolean,
    onEvent?: WorkRunEventHandler,
  ): Promise<SDKOptions> {
    // Find the Claude CLI binary
    let binaryPath: string | null = null;

    // If config.binary is set, validate it's an actual executable file
    if (config.binary) {
      const resolved = resolveCandidate(config.binary);
      if (resolved) {
        binaryPath = resolved;
        logInfo("Using configured Claude CLI at:", binaryPath);
      } else {
        logWarn(
          `Configured binary path "${config.binary}" is not a valid executable, falling back to discovery`,
        );
      }
    }

    // Fall back to auto-discovery if no valid config.binary
    if (!binaryPath) {
      binaryPath = findClaudeBinary();
    }

    if (!binaryPath) {
      throw new Error(
        "Claude CLI not found. Please install Claude Code and run `claude login` to authenticate, " +
          "or ensure the CLI is in your PATH. You can also set config.binary to the full path of the claude executable.",
      );
    }

    // Final validation: ensure the path (or its symlink target) is not a directory
    try {
      // Use stat (not lstat) to follow symlinks
      const realPath = fs.realpathSync(binaryPath);
      const stat = fs.statSync(realPath);
      if (stat.isDirectory()) {
        throw new Error(
          `Claude CLI path "${binaryPath}" resolves to a directory (${realPath}), not an executable file. ` +
            "The Claude Code installation may be corrupted. Please reinstall Claude Code.",
        );
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Claude CLI not found at path: ${binaryPath}`);
      }
      // Re-throw validation errors
      if (e instanceof Error && e.message.includes("directory")) {
        throw e;
      }
    }

    logInfo("Using Claude CLI at:", binaryPath);

    // Build environment: strip API key/auth token when using CLI (subscription mode)
    // This ensures the subprocess uses CLI login session rather than API billing
    const cleanEnv: Record<string, string | undefined> = { ...process.env };
    delete cleanEnv.ANTHROPIC_API_KEY;
    delete cleanEnv.ANTHROPIC_AUTH_TOKEN;

    const permissionMode = config.permissionMode || "default";

    // Setting sources for settings: default to both user and project if not specified
    const settingSources = config.settingSources ?? ["user", "project", "local"];

    // Load MCP servers from settings files and pass them explicitly to the SDK
    // This ensures MCP servers from ~/.claude/settings.json and project settings are used
    const mcpServers = readMcpServersFromSettings(
      settingSources,
      workspacePath,
    );

    // Inject the mains MCP server as an in-process SDK server
    // Uses Drizzle ORM repos directly — no subprocess or sqlite3 CLI needed
    if (!mcpServers["mains"] && createSdkMcpServerFn && toolFn) {
      mcpServers["mains"] = buildMainsMcpServer(workspaceId ?? null, workspacePath ?? null, runId ?? null);
      logInfo("Injected mains MCP server (in-process)");
    }

    const options: SDKOptions = {
      model,
      permissionMode,
      abortController,
      pathToClaudeCodeExecutable: binaryPath,
      env: cleanEnv,
      settingSources,
      // NOTE: We don't pass allowedTools here because it restricts which tools are available.
      // MCP tools (like mcp__linear__*) would be blocked if we passed a whitelist.
      // Instead, we use the PreToolUse hook with ALLOWED_TOOLS_SET for auto-approval only.
    };

    // Add MCP servers if any were found
    if (Object.keys(mcpServers).length > 0) {
      options.mcpServers = mcpServers;
      //logInfo(`Loaded ${Object.keys(mcpServers).length} MCP server(s):`, Object.keys(mcpServers).join(", "));
    }

    if (workspacePath) {
      options.cwd = workspacePath;
    }

    if (resumeSessionId) {
      options.resume = resumeSessionId;
      if (forkSession) {
        options.forkSession = true;
      }
    }

    // Add agents if configured (merge config-level and run-level agents)
    const mergedAgents = mergeAgentsConfig(config.agents, runAgents);
    if (mergedAgents && Object.keys(mergedAgents).length > 0) {
      options.agents = convertAgentsConfig(mergedAgents);
    }

    // Add hooks if configured (merge config-level and run-level hooks)
    const mergedHooks = mergeHooksConfig(config.hooks, runHooks);
    if (mergedHooks && Object.keys(mergedHooks).length > 0) {
      options.hooks = convertHooksConfig(mergedHooks);
    }

    // Wire structured output if a schema is selected
    if (config.structuredOutputsSelectedId && config.structuredOutputs) {
      const entry =
        config.structuredOutputs[config.structuredOutputsSelectedId];
      if (entry?.schema) {
        options.outputFormat = { type: "json_schema", schema: entry.schema };
      }
    }

    // Configure thinking mode: adaptive (enabled) or disabled
    options.thinking = config.thinkingMode
      ? { type: "adaptive" }
      : { type: "disabled" };

    // Configure effort level (only effective with thinking enabled)
    if (config.thinkingMode && config.effortLevel) {
      options.effort = config.effortLevel;
    }

    // Configure fast mode via settings overlay
    if (config.fastMode) {
      options.settings = { ...((options.settings as Record<string, unknown>) || {}), fastMode: true };
    }

    // Enable prompt suggestions
    options.promptSuggestions = true;

    // Stream raw content-block deltas (text + thinking) for token-by-token UI
    options.includePartialMessages = true;

    // Inject interactive tool approval via PreToolUse hook
    // Only inject when NOT in bypassPermissions mode and we have a runId
    if (permissionMode !== "bypassPermissions" && runId) {
      const approvalHook = buildToolApprovalHook(runId, ALLOWED_TOOLS_SET);
      if (!options.hooks) {
        options.hooks = {};
      }
      if (!options.hooks.PreToolUse) {
        options.hooks.PreToolUse = [];
      }
      options.hooks.PreToolUse.push(approvalHook);
    }

    // Inject dependency guard hook (checks packages before install)
    {
      const guardHook = await guardsService.buildClaudeGuardHook();
      if (guardHook) {
        if (!options.hooks) {
          options.hooks = {};
        }
        if (!options.hooks.PreToolUse) {
          options.hooks.PreToolUse = [];
        }
        options.hooks.PreToolUse.push(guardHook);
      }
    }

    // Inject PostToolUse hook to capture tool output
    // Always inject (even in bypass mode) since this is for data capture, not approval
    if (runId && onEvent) {
      if (!options.hooks) {
        options.hooks = {};
      }
      if (!options.hooks.PostToolUse) {
        options.hooks.PostToolUse = [];
      }
      options.hooks.PostToolUse.push(buildPostToolUseHook(onEvent));
    }

    // Instruct the agent to always use the CommitChanges MCP tool
    // instead of running git add/commit via Bash
    //TODO:
    options.systemPrompt = {
      type: "preset",
      preset: "claude_code",
      append: "IMPORTANT: Never commit changes using Bash (git add, git commit). If the user asks you to commit, always use the CommitChanges tool from the mains MCP server to stage and commit changes. Similarly, never create pull requests using Bash (gh pr create). Always use the CreatePR tool from the mains MCP server instead.",
    };

    return options;
  }

  /**
   * Build an in-process MCP server for mains tools using createSdkMcpServer.
   * Handlers are shared from mains-tools.core.ts — only the SDK wrapper lives here.
   */
  function buildMainsMcpServer(workspaceId: string | null, rootPath: string | null, runId: string | null): any {
    const ctx: MainsToolContext = { workspaceId, rootPath, runId };

    return createSdkMcpServerFn!({
      name: "mains",
      version: "1.0.0",
      tools: [
        toolFn!(
          "GetWorkspaceDiff",
          TOOL_DESCRIPTIONS.GetWorkspaceDiff,
          { runId: z.string().optional().describe("Run ID to get diff for a specific run") },
          (args: { runId?: string }) => handleGetWorkspaceDiff(args, ctx),
        ),
        toolFn!(
          "SaveReview",
          TOOL_DESCRIPTIONS.SaveReview,
          {
            title: z.string().describe("Review title"),
            summary: z.string().optional().describe("Review summary"),
            status: z.enum(["open", "in_review", "approved", "rejected"]).optional().default("open").describe("Review status"),
            metadata: z.record(z.string(), z.unknown()).optional().describe("Additional metadata as JSON"),
          },
          (args: { title: string; summary?: string; status?: string; metadata?: Record<string, unknown> }) =>
            handleSaveReview(args, ctx),
        ),
        toolFn!(
          "SaveFinding",
          TOOL_DESCRIPTIONS.SaveFinding,
          {
            reviewId: z.string().describe("ID of the parent review"),
            severity: z.enum(["critical", "warning", "info"]).describe("Finding severity level"),
            file: z.string().describe("File path where the finding was detected"),
            lineStart: z.number().optional().describe("Start line number"),
            lineEnd: z.number().optional().describe("End line number"),
            message: z.string().describe("Description of the finding"),
            reason: z.string().describe("Why this was flagged (e.g. bug, security, claude_md_violation)"),
            suggestion: z.string().optional().describe("Suggested fix"),
            metadata: z.record(z.string(), z.unknown()).optional().describe("Additional metadata as JSON"),
          },
          (args: {
            reviewId: string; severity: string; file: string;
            lineStart?: number; lineEnd?: number; message: string;
            reason: string; suggestion?: string; metadata?: Record<string, unknown>;
          }) => handleSaveFinding(args, ctx),
        ),
        toolFn!(
          "SaveFindings",
          TOOL_DESCRIPTIONS.SaveFindings,
          {
            reviewId: z.string().describe("ID of the parent review"),
            findings: z.array(z.object({
              severity: z.enum(["critical", "warning", "info"]),
              file: z.string(),
              lineStart: z.number().optional(),
              lineEnd: z.number().optional(),
              message: z.string(),
              reason: z.string(),
              suggestion: z.string().optional(),
              metadata: z.record(z.string(), z.unknown()).optional(),
            })).describe("Array of findings to save"),
          },
          (args: {
            reviewId: string;
            findings: Array<{
              severity: string; file: string; lineStart?: number; lineEnd?: number;
              message: string; reason: string; suggestion?: string; metadata?: Record<string, unknown>;
            }>;
          }) => handleSaveFindings(args, ctx),
        ),
        toolFn!(
          "CommitChanges",
          TOOL_DESCRIPTIONS.CommitChanges,
          {
            message: z.string().optional().describe("The commit message. Omit on first call to retrieve commitInstructions if configured."),
            files: z.array(z.string()).optional().describe("Specific files to stage. If omitted, stages all changes (git add -A)"),
          },
          (args: { message?: string; files?: string[] }) => handleCommitChanges(args, ctx),
        ),
        toolFn!(
          "CreatePR",
          TOOL_DESCRIPTIONS.CreatePR,
          {
            title: z.string().describe("The pull request title"),
            body: z.string().optional().describe("The pull request body/description"),
            base: z.string().optional().describe("The base branch to merge into (defaults to the repo default branch)"),
            draft: z.boolean().optional().describe("Create as a draft pull request"),
            labels: z.array(z.string()).optional().describe("Labels to add to the pull request"),
          },
          (args: { title: string; body?: string; base?: string; draft?: boolean; labels?: string[] }) => handleCreatePR(args, ctx),
        ),
      ],
    });
  }

  /**
   * Merge config-level agents with run-level agents
   * Run-level agents override config-level agents with the same name
   */
  function mergeAgentsConfig(
    configAgents?: AgentsConfig,
    runAgents?: AgentsConfig,
  ): AgentsConfig | undefined {
    if (!configAgents && !runAgents) {
      return undefined;
    }

    if (!configAgents) {
      return runAgents;
    }

    if (!runAgents) {
      return configAgents;
    }

    // Merge both configs (run-level overrides config-level for same agent name)
    return {
      ...configAgents,
      ...runAgents,
    };
  }

  /**
   * Convert our AgentsConfig to the SDK's expected format
   */
  function convertAgentsConfig(agents: AgentsConfig): SDKAgentsConfig {
    const sdkAgents: SDKAgentsConfig = {};

    for (const [agentName, agentDef] of Object.entries(agents)) {
      sdkAgents[agentName] = {
        description: agentDef.description,
        prompt: agentDef.prompt,
        tools: agentDef.tools,
        disallowedTools: agentDef.disallowedTools,
        model: agentDef.model,
        mcpServers: agentDef.mcpServers,
        skills: agentDef.skills,
        initialPrompt: agentDef.initialPrompt,
        maxTurns: agentDef.maxTurns,
        criticalSystemReminder_EXPERIMENTAL: agentDef.criticalSystemReminder_EXPERIMENTAL,
      };
    }

    return sdkAgents;
  }

  /**
   * Merge config-level hooks with run-level hooks
   * Run-level hooks are appended to config-level hooks for each event
   */
  function mergeHooksConfig(
    configHooks?: HooksConfig,
    runHooks?: HooksConfig,
  ): HooksConfig | undefined {
    if (!configHooks && !runHooks) {
      return undefined;
    }

    if (!configHooks) {
      return runHooks;
    }

    if (!runHooks) {
      return configHooks;
    }

    // Merge both configs
    const merged: HooksConfig = { ...configHooks };

    for (const [eventName, matchers] of Object.entries(runHooks)) {
      const key = eventName as keyof HooksConfig;
      if (merged[key]) {
        // Append run-level matchers to config-level matchers
        merged[key] = [...merged[key]!, ...(matchers || [])];
      } else {
        merged[key] = matchers;
      }
    }

    return merged;
  }

  /**
   * Convert our HooksConfig to the SDK's expected format
   */
  function convertHooksConfig(hooks: HooksConfig): SDKHooksConfig {
    const sdkHooks: SDKHooksConfig = {};

    for (const [eventName, matchers] of Object.entries(hooks)) {
      if (!matchers || matchers.length === 0) continue;

      sdkHooks[eventName] = matchers.map((matcher: HookMatcher) => ({
        matcher: matcher.matcher,
        hooks: matcher.hooks.map(
          (hookFn) =>
            async (
              input: Record<string, unknown>,
              toolUseId: string | null,
              context: { signal: AbortSignal },
            ) => {
              try {
                // Call the hook function with the input cast to HookInput
                const result = await hookFn(input as any, toolUseId, context);
                return result as Record<string, unknown>;
              } catch (error) {
                logError(`Hook error in ${eventName}:`, error);
                // Return empty object on error to not block the operation
                return {};
              }
            },
        ),
        timeout: matcher.timeout,
      }));
    }

    return sdkHooks;
  }

  /**
   * Build a PostToolUse SDK hook that captures tool output and emits
   * a "complete" tool_call event so the output gets persisted to the DB.
   */
  function buildPostToolUseHook(onEvent: WorkRunEventHandler): SDKHookMatcher {
    return {
      hooks: [
        async (
          input: Record<string, unknown>,
          toolUseId: string | null,
        ): Promise<Record<string, unknown>> => {
          const toolName = (input.tool_name as string) || "unknown";
          const toolResponse = input.tool_response;

          if (toolResponse !== undefined) {
            await onEvent({
              type: "tool_call",
              toolName,
              output: toolResponse,
              endedAt: Date.now(),
              metadata: {
                phase: "complete",
                toolCallId: toolUseId || undefined,
              },
            });
          }

          return {};
        },
      ],
    };
  }

  /**
   * Build a PreToolUse SDK hook matcher that requests interactive approval
   * from the renderer before allowing a tool call to proceed.
   */
  function buildToolApprovalHook(
    runId: string,
    allowedTools: Set<string>,
  ): SDKHookMatcher {
    return {
      // No matcher → fires for every tool
      hooks: [
        async (
          input: Record<string, unknown>,
          _toolUseId: string | null,
          context: { signal: AbortSignal },
        ): Promise<Record<string, unknown>> => {
          const toolName = (input.tool_name as string) || "unknown";
          const toolInput = (input.tool_input as Record<string, unknown>) || {};

          // Auto-approve tools that the user has pre-allowed in settings.json
          if (allowedTools.has(toolName)) {
            return {
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "allow",
              },
            };
          }

          // Auto-approve MCP tools (user has explicitly configured MCP servers)
          // MCP tools are named like: mcp__servername__toolname
          if (toolName.startsWith("mcp__")) {
            return {
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "allow",
              },
            };
          }

          // Detect AskUserQuestion tool
          const isAskUser = toolName === "AskUserQuestion";

          const requestId = `${runId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const req: ToolApprovalRequest = {
            requestId,
            runId,
            toolName,
            toolInput,
            kind: isAskUser ? "ask_user" : "tool_approval",
            timestamp: Date.now(),
          };

          // For AskUserQuestion, extract structured question data
          if (isAskUser) {
            const questions = toolInput.questions as
              | Array<{
                  question?: string;
                  options?: Array<{ label: string; description?: string }>;
                  multiSelect?: boolean;
                }>
              | undefined;

            if (questions && questions.length > 0) {
              const first = questions[0];
              req.question = first.question;
              req.options = first.options;
              req.multiSelect = first.multiSelect;
            }
          }

          // If already aborted, deny immediately
          if (context.signal.aborted) {
            return {
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: "Request aborted",
              },
            };
          }

          // Race the approval against the abort signal
          const response = await Promise.race([
            requestToolApproval(req),
            new Promise<null>((resolve) => {
              context.signal.addEventListener("abort", () => resolve(null), {
                once: true,
              });
            }),
          ]);

          if (!response || !response.approved) {
            return {
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: "User denied permission",
              },
            };
          }

          // For AskUserQuestion, inject the user's answer into the tool input.
          // Per Anthropic docs (code.claude.com/docs/en/agent-sdk/user-input):
          //   - `questions` MUST be passed through unchanged (required for tool processing)
          //   - `answers` keys MUST be the question text (NOT an index)
          //   - Multi-select values are joined with ", " (UI already does this)
          if (isAskUser && response.answer !== undefined) {
            const askedQuestions = (toolInput.questions ?? []) as Array<{ question?: string }>;
            const answersMap: Record<string, string> = {};
            // Primary: first question takes the user's actual selection from the dialog.
            const primaryText = askedQuestions[0]?.question;
            if (primaryText) {
              answersMap[primaryText] = response.answer;
            }
            // Best-effort fallback for multi-question tool calls — Claude
            // usually sends a single question, but if it bundles multiple,
            // the tool rejects the call when any question key is missing.
            // Mirroring is a stopgap until the dialog can render N questions.
            for (let i = 1; i < askedQuestions.length; i++) {
              const text = askedQuestions[i]?.question;
              if (text) answersMap[text] = response.answer;
            }
            return {
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "allow",
                updatedInput: {
                  questions: askedQuestions,
                  answers: answersMap,
                },
              },
            };
          }

          return {
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: "allow",
            },
          };
        },
      ],
    };
  }

  function mapSDKMessage(msg: SDKMessage, _runId: string, context?: { hasAssistantContent?: boolean }): WorkRunEvent[] {
    const events: WorkRunEvent[] = [];
    const ts = Date.now();

    switch (msg.type) {
      case "assistant": {
        const assistantMsg = msg as SDKAssistantMessage;

        // Check if this message is from within a subagent context
        const isFromSubagent = !!assistantMsg.parent_tool_use_id;

        if (assistantMsg.message?.content) {
          for (const block of assistantMsg.message.content) {
            // Handle text blocks (assistant thinking/commentary)
            if (block.type === "text" && block.text) {
              events.push({
                type: "artifact",
                kind: "report",
                content: block.text,
                metadata: {
                  source: "assistant.message",
                  isFromSubagent,
                  parentToolUseId: assistantMsg.parent_tool_use_id || undefined,
                },
              });
            }

            if (block.type === "tool_use" && block.name) {
              const toolCallId = block.id || `${block.name}-${ts}`;
              toolCallIndex.set(toolCallId, {
                toolName: block.name,
                input: block.input,
                startedAt: ts,
              });
              events.push({
                type: "tool_call",
                toolName: block.name,
                input: block.input as Record<string, unknown> | undefined,
                startedAt: ts,
                metadata: {
                  phase: "start",
                  toolCallId,
                  rawType: msg.type,
                  // Track if this tool call is from within a subagent
                  parentToolUseId: assistantMsg.parent_tool_use_id || undefined,
                  isFromSubagent,
                },
              });

              // Detect subagent invocation (Task tool calls)
              if (block.name === "Task") {
                const taskInput = block.input as
                  | Record<string, unknown>
                  | undefined;
                const subagentType =
                  (taskInput?.subagent_type as string) || "general-purpose";
                const subagentPrompt = taskInput?.prompt as string | undefined;

                events.push({
                  type: "subagent",
                  phase: "invoked",
                  agentType: subagentType,
                  parentToolUseId: toolCallId,
                  prompt: subagentPrompt,
                  ts,
                  metadata: {
                    toolCallId,
                    description: taskInput?.description as string | undefined,
                    model: taskInput?.model as string | undefined,
                    runInBackground: taskInput?.run_in_background as
                      | boolean
                      | undefined,
                  },
                });
              }
            }
          }
        }
        break;
      }

      case "user": {
        // User messages from SDK are the processed/echoed versions
        const userMsg = msg as SDKUserMessage;
        const content = userMsg.message?.content;

        // Handle both string and array content formats
        let userContent: string | undefined;
        if (typeof content === "string") {
          userContent = content;
        } else if (Array.isArray(content)) {
          userContent = content
            .map((c) => c.text || "")
            .filter(Boolean)
            .join("\n");
        }

        if (userContent && userContent.trim().length > 0) {
          //TODO:
          // Continuation summaries (from /compact) should be visible as artifacts
          const isContinuationSummary = userContent.includes("continued from a previous conversation");
          if (isContinuationSummary) {
            events.push({
              type: "artifact",
              kind: "report",
              content: userContent,
              metadata: { source: "continuation-summary" },
            });
          } else {
            events.push({
              type: "log",
              message: userContent,
              level: "sdk-user",
              ts,
            });
          }
        }
        break;
      }

      case "system": {
        const systemMsg = msg as SDKSystemMessage;
        if (systemMsg.subtype === "init") {
          events.push({
            type: "log",
            message: `[system] Session initialized with model: ${systemMsg.model || "unknown"}`,
            level: "start",
            ts,
          });
        }
        break;
      }

      case "result": {
        const resultMsg = msg as SDKResultMessage;

        // Emit result content only when no assistant message was streamed
        // (e.g. slash command output like /cost, /compact)
        if (resultMsg.subtype === "success" && resultMsg.result && !context?.hasAssistantContent) {
          events.push({
            type: "artifact",
            kind: "report",
            content: resultMsg.result,
            metadata: {
              source: "result.message",
            },
          });
        }

        // Emit stop reason log when notable
        if (resultMsg.stop_reason && resultMsg.stop_reason !== "end_turn") {
          events.push({
            type: "log",
            message: `[stop_reason] ${resultMsg.stop_reason}`,
            level: resultMsg.stop_reason === "refusal" ? "error" : "info",
            ts,
          });
        }

        // Only emit errors here, not the content (to avoid duplication)
        if (resultMsg.subtype !== "success" && resultMsg.is_error) {
          events.push({
            type: "log",
            message: `[error] ${resultMsg.errors.join(", ")}`,
            level: "error",
            ts,
          });
        }
        break;
      }

      case "prompt_suggestion": {
        const suggestionMsg = msg as { type: "prompt_suggestion"; suggestion: string };
        if (suggestionMsg.suggestion) {
          events.push({
            type: "prompt_suggestion",
            suggestion: suggestionMsg.suggestion,
            ts,
          });
        }
        break;
      }

      case "stream_event": {
        const partialMsg = msg as SDKPartialAssistantMessage;
        const event = partialMsg.event;
        if (!event) break;

        // Skip subagent streams — they would pollute the parent timeline
        if (partialMsg.parent_tool_use_id) break;

        const blockIndex = typeof event.index === "number" ? event.index : -1;

        if (event.type === "content_block_delta" && event.delta && blockIndex >= 0) {
          const bufferKey = `${_runId}-${blockIndex}`;

          if (event.delta.type === "text_delta" && event.delta.text) {
            const next = (partialTextBuffers.get(bufferKey) ?? "") + event.delta.text;
            partialTextBuffers.set(bufferKey, next);
            events.push({
              type: "artifact",
              kind: "report",
              content: next,
              metadata: { source: "agent_message_streaming" },
              ephemeral: true,
              streamId: `claude-msg-${_runId}-${blockIndex}`,
            });
          } else if (event.delta.type === "thinking_delta" && event.delta.thinking) {
            const next = (partialThinkingBuffers.get(bufferKey) ?? "") + event.delta.thinking;
            partialThinkingBuffers.set(bufferKey, next);
            events.push({
              type: "artifact",
              kind: "report",
              content: next,
              metadata: { source: "agent_thinking_streaming" },
              ephemeral: true,
              streamId: `claude-think-${_runId}-${blockIndex}`,
            });
          }
        } else if (event.type === "content_block_stop" && blockIndex >= 0) {
          const key = `${_runId}-${blockIndex}`;
          // Thinking lane has no DB-persisted counterpart, so the content-match
          // filter in the renderer won't auto-clear it. Push an empty update.
          if (partialThinkingBuffers.has(key)) {
            events.push({
              type: "artifact",
              kind: "report",
              content: "",
              metadata: { source: "agent_thinking_streaming" },
              ephemeral: true,
              streamId: `claude-think-${_runId}-${blockIndex}`,
            });
          }
          partialTextBuffers.delete(key);
          partialThinkingBuffers.delete(key);
        } else if (event.type === "message_stop") {
          // Safety net: clear any leftover buffers for this run
          for (const key of partialTextBuffers.keys()) {
            if (key.startsWith(`${_runId}-`)) partialTextBuffers.delete(key);
          }
          for (const key of partialThinkingBuffers.keys()) {
            if (key.startsWith(`${_runId}-`)) partialThinkingBuffers.delete(key);
          }
        }
        break;
      }

      default: {
        // Handle tool results that might come as different message types
        const anyMsg = msg as any;
        if (anyMsg.tool_use_id || anyMsg.type === "tool_result") {
          const toolUseId = anyMsg.tool_use_id || "";
          const prev = toolUseId ? toolCallIndex.get(toolUseId) : undefined;

          const toolName = prev?.toolName || "unknown";
          const input = prev?.input;
          const output = anyMsg.content || anyMsg.result;
          const error = anyMsg.is_error ? String(output) : undefined;

          if (toolUseId) {
            toolCallIndex.delete(toolUseId);
          }

          events.push({
            type: "tool_call",
            toolName,
            input: input as Record<string, unknown> | undefined,
            output,
            error,
            endedAt: ts,
            metadata: {
              phase: "complete",
              toolCallId: toolUseId || undefined,
              rawType: msg.type,
            },
          });

          // Detect subagent completion (Task tool result)
          if (toolName === "Task") {
            const taskInput = input as Record<string, unknown> | undefined;
            const subagentType =
              (taskInput?.subagent_type as string) || "general-purpose";

            // Extract agent ID from the result if available
            let agentId: string | undefined;
            if (typeof output === "string") {
              const agentIdMatch = output.match(/agentId:\s*([a-f0-9-]+)/i);
              if (agentIdMatch) {
                agentId = agentIdMatch[1];
              }
            }
            events.push({
              type: "subagent",
              phase: error ? "failed" : "completed",
              agentType: subagentType,
              agentId,
              parentToolUseId: toolUseId || undefined,
              result: typeof output === "string" ? output : safeJson(output),
              error,
              ts,
              metadata: {
                toolCallId: toolUseId || undefined,
              },
            });
          }
        } else {
          // Log other event types for debugging
          events.push({
            type: "log",
            message: `[event] ${msg.type}: ${safeJson(msg)}`,
            level: "info",
            ts,
          });
        }
      }
    }

    return events;
  }

  // extractArtifactsFromToolOutput imported from adapter.shared

  // saveAttachments, buildAttachmentPrompt are internal to adapter.shared

  /** User-pinned skill names ($) — filesystem metadata is enough; prompt only echoes names for transparency. */
  function prependPinnedSkillsToPrompt(
    prompt: string,
    skills: WorkRunRequest["skills"],
  ): string {
    if (!skills?.length) return prompt;
    const tokens = skills.map((s) => `${s.name}`).join(" ");
    return `${tokens}\n\n${prompt}`;
  }

  function buildPrompt(request: WorkRunRequest): string {
    let prompt = request.goal;

    if (request.context && request.context.length > 0) {
      const contextParts = formatContextSection(request.context);
      prompt = `Context:\n${contextParts}\n\n---\n\nGoal: ${request.goal}`;
    }

    prompt = appendPromptSections(prompt, {
      contextIssues: request.contextIssues,
      contextSignals: request.contextSignals,
      contextFiles: request.contextFiles,
      attachments: request.attachments,
      runId: request.runId,
    });

    return prependPinnedSkillsToPrompt(prompt, request.skills);
  }

  /** Same discovery as listSkills — shared so listCommands can exclude disk skills from the / menu. */
  async function fetchDiskSkills(workspacePath?: string): Promise<SkillInfo[]> {
    const cacheKey = workspacePath ?? "__global__";
    const now = Date.now();
    const cached = skillsCache.get(cacheKey);
    if (cached && now - cached.timestamp < SKILLS_CACHE_TTL_MS) {
      return cached.skills;
    }

    try {
      const settingSources = config.settingSources ?? ["user", "project", "local"];
      const skills: SkillInfo[] = [];

      if (settingSources.includes("user")) {
        const userSkillsDir = path.join(os.homedir(), ".claude", "skills", );
        const userSkills = await discoverSkillsFromDirectory(
          userSkillsDir,
          "user",
        );
        skills.push(...userSkills);
      }

      if (settingSources.includes("project") && workspacePath) {
        const projectSkillsDir = path.join(workspacePath, ".claude", "skills");
        const projectSkills = await discoverSkillsFromDirectory(
          projectSkillsDir,
          "project",
        );
        skills.push(...projectSkills);
      }

      skillsCache.set(cacheKey, { skills, timestamp: now });
      return skills;
    } catch (error) {
      logError("Failed to discover skills:", error);
      return [];
    }
  }

  return {
    async startRun(
      request: WorkRunRequest,
      onEvent: WorkRunEventHandler,
    ): Promise<WorkRunResult> {
      const { runId, model } = request;
      const timeout = config.timeout ?? 6000000;

      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];
      const abortController = new AbortController();
      let lastStopReason: string | null | undefined;
      let lastUsage: WorkRunUsage | undefined;

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });
        await onEvent({
          type: "log",
          message: `Starting Claude run in workspace: ${request.workspace.rootPath}`,
          level: "start",
          ts: Date.now(),
        });

        await ensureSDK();

        if (!queryFn) {
          throw new Error("Claude SDK not properly initialized");
        }

        const options = await buildOptions(
          getModel(model),
          request.workspace.rootPath,
          abortController,
          undefined, // resumeSessionId
          request.hooks, // run-level hooks
          request.agents, // run-level agents
          runId, // for interactive tool approval
          request.workspace.id, // workspace ID for MCP server
          undefined, // forkSession
          onEvent, // for PostToolUse output capture
        );

        // Per-run override (e.g. Pulse forces permissionMode="auto")
        const overridePermissionMode = (request.configSnapshot as Record<string, unknown> | null | undefined)
          ?.permissionMode;
        if (typeof overridePermissionMode === "string") {
          (options as { permissionMode?: string }).permissionMode = overridePermissionMode;
        }

        await onEvent({
          type: "log",
          message: `Creating Claude query with model: ${options.model}`,
          level: "start",
          ts: Date.now(),
        });

        const prompt = buildPrompt(request);

        // Emit user's original goal as artifact for UI display
        await emitUserPromptArtifact(onEvent, request.goal, {
          attachments: request.attachments,
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
          contextSkills: request.skills,
        });

        await onEvent({
          type: "log",
          message: `Sending prompt to Claude (${prompt.length} chars)`,
          level: "start",
          ts: Date.now(),
        });

        // Create the query
        const query = queryFn({ prompt, options });

        // Store query in activeRuns for abort/interrupt support
        activeRuns.set(runId, { abortController, aborted: false, query });

        // // Log MCP server status for debugging
        // try {
        //   const mcpStatus = await query.mcpServerStatus();
        //   if (mcpStatus && mcpStatus.length > 0) {
        //     await onEvent({
        //       type: "log",
        //       message: `MCP servers available: ${mcpStatus.map((s: any) => s.name || s).join(", ")}`,
        //       level: "info",
        //       ts: Date.now(),
        //     });
        //   } else if (options.mcpServers && Object.keys(options.mcpServers).length > 0) {
        //     // We passed servers but none are reported - might be connecting
        //     await onEvent({
        //       type: "log",
        //       message: `MCP servers configured: ${Object.keys(options.mcpServers).join(", ")} (connecting...)`,
        //       level: "info",
        //       ts: Date.now(),
        //     });
        //   }
        // } catch (mcpErr) {
        //   logWarn("Could not fetch MCP server status:", mcpErr);
        // }

        // Stream the response
        let sessionId: string | undefined;
        let timeoutId: NodeJS.Timeout | undefined;
        let timedOut = false;

        // Set up timeout
        const timeoutPromise = new Promise<void>((_, reject) => {
          timeoutId = setTimeout(() => {
            timedOut = true;
            abortController.abort();
            reject(new Error(`Request timed out after ${timeout}ms`));
          }, timeout);
        });

        try {
          const streamPromise = (async () => {
            let hasAssistantContent = false;
            for await (const msg of query) {
              const runState = activeRuns.get(runId);
              if (runState?.aborted || timedOut) {
                break;
              }

              // Track whether any assistant text content has been streamed
              if (msg.type === "assistant") {
                const aMsg = msg as SDKAssistantMessage;
                if (aMsg.message?.content?.some((b: any) => b.type === "text" && b.text)) {
                  hasAssistantContent = true;
                }
              }

              // Capture session ID for resume capability
              if (msg.session_id && !sessionId) {
                sessionId = msg.session_id;
                sessionIdMap.set(runId, sessionId);
                runsRepo
                  .updateRun(runId, { sessionId })
                  .catch((err) =>
                    logError("Failed to persist session ID:", err),
                  );
                const state = activeRuns.get(runId);
                if (state) {
                  activeRuns.set(runId, { ...state, sessionId, query });
                }
              }

              // Capture stop reason and usage from result messages
              if (msg.type === "result") {
                const resultMsg = msg as SDKResultMessage;
                if (resultMsg.stop_reason !== undefined) {
                  lastStopReason = resultMsg.stop_reason;
                }

                // Aggregate token counts across all models
                let inputTokens = 0, outputTokens = 0, cacheRead = 0, cacheWrite = 0;
                let primaryModel: string | undefined;
                if (resultMsg.modelUsage) {
                  for (const [modelName, usage] of Object.entries(resultMsg.modelUsage)) {
                    inputTokens += usage.inputTokens;
                    outputTokens += usage.outputTokens;
                    cacheRead += usage.cacheReadInputTokens;
                    cacheWrite += usage.cacheCreationInputTokens;
                    if (!primaryModel) primaryModel = modelName;
                  }
                }

                lastUsage = {
                  totalCostUsd: resultMsg.total_cost_usd,
                  durationMs: resultMsg.duration_ms,
                  numTurns: resultMsg.num_turns,
                  inputTokens: inputTokens || undefined,
                  outputTokens: outputTokens || undefined,
                  cacheReadTokens: cacheRead || undefined,
                  cacheWriteTokens: cacheWrite || undefined,
                  model: primaryModel,
                  modelUsage: resultMsg.modelUsage,
                };
              }

              // Map and emit events
              const events = mapSDKMessage(msg, runId, { hasAssistantContent });
              for (const event of events) {
                await onEvent(event);

                // Track artifacts
                if (event.type === "artifact") {
                  collectedArtifacts.push({
                    kind: event.kind,
                    path: event.path,
                  });
                }

                // Extract artifacts from tool completions
                if (
                  event.type === "tool_call" &&
                  event.metadata?.phase === "complete" &&
                  event.output
                ) {
                  const artifactEvents = extractArtifactsFromToolOutput(
                    event.toolName,
                    event.output,
                  );
                  for (const artEvent of artifactEvents) {
                    await onEvent(artEvent);
                    if (artEvent.type === "artifact") {
                      collectedArtifacts.push({
                        kind: artEvent.kind,
                        path: artEvent.path,
                      });
                    }
                  }
                }
              }
            }
          })();

          await Promise.race([streamPromise, timeoutPromise]);
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }

        const runState = activeRuns.get(runId);
        if (runState?.aborted) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });

          return {
            status: "canceled",
            summary: "Run was aborted by user",
            stopReason: lastStopReason ?? null,
            artifacts: collectedArtifacts,
            usage: lastUsage,
          };
        }

        // Handle refusal stop reason
        if (lastStopReason === "refusal") {
          await onEvent({ type: "status", status: "failed", ts: Date.now() });

          return {
            status: "failed",
            summary: "The model declined to fulfill this request.",
            stopReason: lastStopReason,
            artifacts: collectedArtifacts,
            usage: lastUsage,
          };
        }

        await onEvent({ type: "status", status: "succeeded", ts: Date.now() });

        return {
          status: "succeeded",
          summary: "Completed successfully",
          stopReason: lastStopReason ?? null,
          artifacts: collectedArtifacts,
          usage: lastUsage,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Emit interrupted events for any pending tool calls
        const ts = Date.now();
        for (const [toolCallId, toolInfo] of toolCallIndex) {
          await onEvent({
            type: "tool_call",
            toolName: toolInfo.toolName,
            input: toolInfo.input as Record<string, unknown> | undefined,
            error: "Interrupted",
            endedAt: ts,
            metadata: {
              phase: "complete",
              toolCallId,
              interrupted: true,
            },
          });
        }
        toolCallIndex.clear();

        // Check for timeout
        if (errorMessage.includes("timed out")) {
          await onEvent({
            type: "log",
            message: errorMessage,
            level: "error",
            ts: Date.now(),
          });

          await onEvent({
            type: "status",
            status: "failed",
            error: "Request timed out",
            ts: Date.now(),
          });

          return {
            status: "failed",
            summary: `Request timed out after ${timeout / 1000} seconds.`,
            stopReason: lastStopReason ?? null,
            artifacts: collectedArtifacts,
            usage: lastUsage,
          };
        }

        // Check for abort
        if (
          errorMessage.includes("aborted") ||
          abortController.signal.aborted
        ) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });

          return {
            status: "canceled",
            summary: "Run was aborted",
            stopReason: lastStopReason ?? null,
            artifacts: collectedArtifacts,
            usage: lastUsage,
          };
        }

        await onEvent({
          type: "log",
          message: `Run failed: ${errorMessage}`,
          level: "error",
          ts: Date.now(),
        });

        await onEvent({
          type: "status",
          status: "failed",
          error: errorMessage,
          ts: Date.now(),
        });

        return {
          status: "failed",
          summary: errorMessage,
          stopReason: lastStopReason ?? null,
          artifacts: collectedArtifacts,
          usage: lastUsage,
        };
      } finally {
        activeRuns.delete(runId);
      }
    },

    async continueRun(
      request: WorkRunContinueRequest,
      onEvent: WorkRunEventHandler,
    ): Promise<WorkRunResult> {
      const { runId, message } = request;
      const timeout = config.timeout ?? 6000000;

      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];
      const abortController = new AbortController();
      let lastStopReason: string | null | undefined;
      let lastUsage: WorkRunUsage | undefined;

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });
        await onEvent({
          type: "log",
          message: `Resuming Claude session for run: ${runId}`,
          level: "resume",
          ts: Date.now(),
        });

        await ensureSDK();

        if (!queryFn) {
          throw new Error("Claude SDK not properly initialized");
        }

        // Get the session ID from our tracking (in-memory cache, then DB fallback)
        let sessionId = sessionIdMap.get(runId);
        if (!sessionId) {
          const run = await runsRepo.findRunById(runId);
          if (run?.sessionId) {
            sessionId = run.sessionId;
            sessionIdMap.set(runId, sessionId);
          }
        }
        if (!sessionId) {
          throw new Error(
            `Session not found for run ${runId}. The session may have expired or was never created.`,
          );
        }

        const options = await buildOptions(
          getModel(request.model ?? config.defaultModel),
          request.workspace.rootPath,
          abortController,
          sessionId, // Resume with session ID
          request.hooks, // run-level hooks
          request.agents, // run-level agents
          runId, // for interactive tool approval
          request.workspace.id, // workspace ID for MCP server
          undefined, // forkSession
          onEvent, // for PostToolUse output capture
        );

        // Build prompt with any additional context
        let prompt = message;
        if (request.context && request.context.length > 0) {
          const contextParts = formatContextSection(request.context);
          prompt = `Context:\n${contextParts}\n\n---\n\n${message}`;
        }

        prompt = appendPromptSections(prompt, {
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
          attachments: request.attachments,
          runId,
          includeIssueBody: false,
        });

        prompt = prependPinnedSkillsToPrompt(prompt, request.skills);

        // Emit user's follow-up message as artifact for UI display
        await emitUserPromptArtifact(onEvent, message, {
          attachments: request.attachments,
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
          contextSkills: request.skills,
        });

        await onEvent({
          type: "log",
          message: `Sending follow-up message (${prompt.length} chars)`,
          level: "resume",
          ts: Date.now(),
        });

        // Create the query with resume
        const query = queryFn({ prompt, options });

        // Store query in activeRuns for abort/interrupt support
        activeRuns.set(runId, {
          abortController,
          aborted: false,
          sessionId,
          query,
        });

        // Stream the response
        let timeoutId: NodeJS.Timeout | undefined;
        let timedOut = false;

        const timeoutPromise = new Promise<void>((_, reject) => {
          timeoutId = setTimeout(() => {
            timedOut = true;
            abortController.abort();
            reject(new Error(`Request timed out after ${timeout}ms`));
          }, timeout);
        });

        try {
          const streamPromise = (async () => {
            let hasAssistantContent = false;
            for await (const msg of query) {
              const runState = activeRuns.get(runId);
              if (runState?.aborted || timedOut) {
                break;
              }

              // Track whether any assistant text content has been streamed
              if (msg.type === "assistant") {
                const aMsg = msg as SDKAssistantMessage;
                if (aMsg.message?.content?.some((b: any) => b.type === "text" && b.text)) {
                  hasAssistantContent = true;
                }
              }

              // Capture stop reason and usage from result messages
              if (msg.type === "result") {
                const resultMsg = msg as SDKResultMessage;
                if (resultMsg.stop_reason !== undefined) {
                  lastStopReason = resultMsg.stop_reason;
                }

                // Aggregate token counts across all models
                let inputTokens = 0, outputTokens = 0, cacheRead = 0, cacheWrite = 0;
                let primaryModel: string | undefined;
                if (resultMsg.modelUsage) {
                  for (const [modelName, usage] of Object.entries(resultMsg.modelUsage)) {
                    inputTokens += usage.inputTokens;
                    outputTokens += usage.outputTokens;
                    cacheRead += usage.cacheReadInputTokens;
                    cacheWrite += usage.cacheCreationInputTokens;
                    if (!primaryModel) primaryModel = modelName;
                  }
                }

                lastUsage = {
                  totalCostUsd: resultMsg.total_cost_usd,
                  durationMs: resultMsg.duration_ms,
                  numTurns: resultMsg.num_turns,
                  inputTokens: inputTokens || undefined,
                  outputTokens: outputTokens || undefined,
                  cacheReadTokens: cacheRead || undefined,
                  cacheWriteTokens: cacheWrite || undefined,
                  model: primaryModel,
                  modelUsage: resultMsg.modelUsage,
                };
              }

              const events = mapSDKMessage(msg, runId, { hasAssistantContent });
              for (const event of events) {
                await onEvent(event);

                if (event.type === "artifact") {
                  collectedArtifacts.push({
                    kind: event.kind,
                    path: event.path,
                  });
                }

                if (
                  event.type === "tool_call" &&
                  event.metadata?.phase === "complete" &&
                  event.output
                ) {
                  const artifactEvents = extractArtifactsFromToolOutput(
                    event.toolName,
                    event.output,
                  );
                  for (const artEvent of artifactEvents) {
                    await onEvent(artEvent);
                    if (artEvent.type === "artifact") {
                      collectedArtifacts.push({
                        kind: artEvent.kind,
                        path: artEvent.path,
                      });
                    }
                  }
                }
              }
            }
          })();

          await Promise.race([streamPromise, timeoutPromise]);
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        }

        const runState = activeRuns.get(runId);
        if (runState?.aborted) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });

          return {
            status: "canceled",
            summary: "Run was aborted by user",
            stopReason: lastStopReason ?? null,
            artifacts: collectedArtifacts,
            usage: lastUsage,
          };
        }

        // Handle refusal stop reason
        if (lastStopReason === "refusal") {
          await onEvent({ type: "status", status: "failed", ts: Date.now() });

          return {
            status: "failed",
            summary: "The model declined to fulfill this request.",
            stopReason: lastStopReason,
            artifacts: collectedArtifacts,
            usage: lastUsage,
          };
        }

        await onEvent({ type: "status", status: "succeeded", ts: Date.now() });

        return {
          status: "succeeded",
          summary: "Completed successfully",
          stopReason: lastStopReason ?? null,
          artifacts: collectedArtifacts,
          usage: lastUsage,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Emit interrupted events for any pending tool calls
        const ts = Date.now();
        for (const [toolCallId, toolInfo] of toolCallIndex) {
          await onEvent({
            type: "tool_call",
            toolName: toolInfo.toolName,
            input: toolInfo.input as Record<string, unknown> | undefined,
            error: "Interrupted",
            endedAt: ts,
            metadata: {
              phase: "complete",
              toolCallId,
              interrupted: true,
            },
          });
        }
        toolCallIndex.clear();

        if (errorMessage.includes("timed out")) {
          await onEvent({
            type: "log",
            message: errorMessage,
            level: "error",
            ts: Date.now(),
          });

          await onEvent({
            type: "status",
            status: "failed",
            error: "Request timed out",
            ts: Date.now(),
          });

          return {
            status: "failed",
            summary: `Request timed out after ${timeout / 1000} seconds.`,
            stopReason: lastStopReason ?? null,
            artifacts: collectedArtifacts,
            usage: lastUsage,
          };
        }

        // Check for abort
        if (
          errorMessage.includes("aborted") ||
          abortController.signal.aborted
        ) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });

          return {
            status: "canceled",
            summary: "Run was aborted",
            stopReason: lastStopReason ?? null,
            artifacts: collectedArtifacts,
            usage: lastUsage,
          };
        }

        await onEvent({
          type: "log",
          message: `Continue run failed: ${errorMessage}`,
          level: "error",
          ts: Date.now(),
        });

        await onEvent({
          type: "status",
          status: "failed",
          error: errorMessage,
          ts: Date.now(),
        });

        return {
          status: "failed",
          summary: errorMessage,
          stopReason: lastStopReason ?? null,
          artifacts: collectedArtifacts,
          usage: lastUsage,
        };
      } finally {
        activeRuns.delete(runId);
      }
    },

    async forkRun(
      request: WorkRunForkRequest,
      onEvent: WorkRunEventHandler,
    ): Promise<WorkRunResult> {
      const { runId, sourceRunId, message } = request;
      const timeout = config.timeout ?? 6000000;

      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];
      const abortController = new AbortController();
      let lastStopReason: string | null | undefined;
      let lastUsage: WorkRunUsage | undefined;

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });
        await onEvent({
          type: "log",
          message: `Forking session from run ${sourceRunId} into new run ${runId}`,
          level: "start",
          ts: Date.now(),
        });

        await ensureSDK();

        if (!queryFn) {
          throw new Error("Claude SDK not properly initialized");
        }

        // Get the session ID from the SOURCE run
        let sourceSessionId = sessionIdMap.get(sourceRunId);
        if (!sourceSessionId) {
          const sourceRun = await runsRepo.findRunById(sourceRunId);
          if (sourceRun?.sessionId) {
            sourceSessionId = sourceRun.sessionId;
          }
        }
        if (!sourceSessionId) {
          throw new Error(
            `Session not found for source run ${sourceRunId}. Cannot fork.`,
          );
        }

        const options = await buildOptions(
          getModel(request.model ?? config.defaultModel),
          request.workspace.rootPath,
          abortController,
          sourceSessionId,
          request.hooks,
          request.agents,
          runId,
          request.workspace.id,
          true, // forkSession: true
          onEvent, // for PostToolUse output capture
        );

        // Build prompt with any additional context
        let prompt = message;
        if (request.context && request.context.length > 0) {
          const contextParts = formatContextSection(request.context);
          prompt = `Context:\n${contextParts}\n\n---\n\n${message}`;
        }

        prompt = appendPromptSections(prompt, {
          attachments: request.attachments,
          runId,
        });

        // Emit user's message as artifact for UI display
        await emitUserPromptArtifact(onEvent, message, {
          attachments: request.attachments,
        });

        await onEvent({
          type: "log",
          message: `Sending forked session message (${prompt.length} chars)`,
          level: "start",
          ts: Date.now(),
        });

        // Create the query with fork
        const query = queryFn({ prompt, options });

        // Store query in activeRuns for abort/interrupt support
        activeRuns.set(runId, {
          abortController,
          aborted: false,
          query,
        });

        // Stream the response
        let timeoutId: NodeJS.Timeout | undefined;
        let timedOut = false;

        const timeoutPromise = new Promise<void>((_, reject) => {
          timeoutId = setTimeout(() => {
            timedOut = true;
            abortController.abort();
            reject(new Error(`Request timed out after ${timeout}ms`));
          }, timeout);
        });

        try {
          const streamPromise = (async () => {
            let hasAssistantContent = false;
            for await (const msg of query) {
              const runState = activeRuns.get(runId);
              if (runState?.aborted || timedOut) {
                break;
              }

              // Track whether any assistant text content has been streamed
              if (msg.type === "assistant") {
                const aMsg = msg as SDKAssistantMessage;
                if (aMsg.message?.content?.some((b: any) => b.type === "text" && b.text)) {
                  hasAssistantContent = true;
                }
              }

              // Capture the NEW session ID from the forked session
              if (msg.session_id) {
                const newSessionId = msg.session_id;
                sessionIdMap.set(runId, newSessionId);
                const state = activeRuns.get(runId);
                if (state) {
                  activeRuns.set(runId, { ...state, sessionId: newSessionId, query });
                }
                runsRepo
                  .updateRun(runId, { sessionId: newSessionId })
                  .catch((err: unknown) =>
                    logError("Failed to persist forked session ID:", err),
                  );
              }

              // Capture stop reason and usage from result messages
              if (msg.type === "result") {
                const resultMsg = msg as SDKResultMessage;
                if (resultMsg.stop_reason !== undefined) {
                  lastStopReason = resultMsg.stop_reason;
                }

                // Aggregate token counts across all models
                let inputTokens = 0, outputTokens = 0, cacheRead = 0, cacheWrite = 0;
                let primaryModel: string | undefined;
                if (resultMsg.modelUsage) {
                  for (const [modelName, usage] of Object.entries(resultMsg.modelUsage)) {
                    inputTokens += usage.inputTokens;
                    outputTokens += usage.outputTokens;
                    cacheRead += usage.cacheReadInputTokens;
                    cacheWrite += usage.cacheCreationInputTokens;
                    if (!primaryModel) primaryModel = modelName;
                  }
                }

                lastUsage = {
                  totalCostUsd: resultMsg.total_cost_usd,
                  durationMs: resultMsg.duration_ms,
                  numTurns: resultMsg.num_turns,
                  inputTokens: inputTokens || undefined,
                  outputTokens: outputTokens || undefined,
                  cacheReadTokens: cacheRead || undefined,
                  cacheWriteTokens: cacheWrite || undefined,
                  model: primaryModel,
                  modelUsage: resultMsg.modelUsage,
                };
              }

              // Map and emit events
              const events = mapSDKMessage(msg, runId, { hasAssistantContent });
              for (const event of events) {
                await onEvent(event);

                if (event.type === "artifact") {
                  collectedArtifacts.push({
                    kind: event.kind,
                    path: event.path,
                  });
                }

                if (
                  event.type === "tool_call" &&
                  event.metadata?.phase === "complete" &&
                  event.output
                ) {
                  const artifactEvents = extractArtifactsFromToolOutput(
                    event.toolName,
                    event.output,
                  );
                  for (const artEvent of artifactEvents) {
                    await onEvent(artEvent);
                    if (artEvent.type === "artifact") {
                      collectedArtifacts.push({
                        kind: artEvent.kind,
                        path: artEvent.path,
                      });
                    }
                  }
                }
              }
            }
          })();

          await Promise.race([streamPromise, timeoutPromise]);
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }

        const runState = activeRuns.get(runId);
        const wasAborted = runState?.aborted || abortController.signal.aborted;

        if (timedOut) {
          await onEvent({
            type: "status",
            status: "failed",
            error: "Request timed out",
            ts: Date.now(),
          });
          return {
            status: "failed",
            summary: "Request timed out",
            stopReason: lastStopReason ?? null,
            artifacts: collectedArtifacts,
            usage: lastUsage,
          };
        }

        if (wasAborted) {
          await onEvent({
            type: "status",
            status: "canceled",
            ts: Date.now(),
          });
          return {
            status: "canceled",
            summary: "Forked run was canceled",
            stopReason: lastStopReason ?? null,
            artifacts: collectedArtifacts,
            usage: lastUsage,
          };
        }

        await onEvent({
          type: "status",
          status: "succeeded",
          ts: Date.now(),
        });

        return {
          status: "succeeded",
          stopReason: lastStopReason ?? null,
          artifacts: collectedArtifacts,
          usage: lastUsage,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logError("Fork run failed:", errorMessage);

        if (
          abortController.signal.aborted ||
          activeRuns.get(runId)?.aborted
        ) {
          await onEvent({
            type: "status",
            status: "canceled",
            ts: Date.now(),
          });
          return {
            status: "canceled",
            summary: "Forked run was canceled",
            stopReason: lastStopReason ?? null,
            artifacts: collectedArtifacts,
            usage: lastUsage,
          };
        }

        await onEvent({
          type: "log",
          message: `Fork run failed: ${errorMessage}`,
          level: "error",
          ts: Date.now(),
        });

        await onEvent({
          type: "status",
          status: "failed",
          error: errorMessage,
          ts: Date.now(),
        });

        return {
          status: "failed",
          summary: errorMessage,
          stopReason: lastStopReason ?? null,
          artifacts: collectedArtifacts,
          usage: lastUsage,
        };
      } finally {
        activeRuns.delete(runId);
      }
    },

    //TODO improve canresume logic - https://platform.claude.com/docs/en/agent-sdk/sessions#resuming-sessions
    async canResumeSession(runId: string): Promise<boolean> {
      // Check if we have a session ID stored for this run (in-memory, then DB)
      let sessionId = sessionIdMap.get(runId);
      if (!sessionId) {
        try {
          const run = await runsRepo.findRunById(runId);
          if (run?.sessionId) {
            sessionId = run.sessionId;
            sessionIdMap.set(runId, sessionId);
          }
        } catch {
          return false;
        }
      }
      if (!sessionId) {
        return false;
      }

      // Check if SDK is available
      try {
        await ensureSDK();
        return queryFn !== null;
      } catch {
        return false;
      }
    },

    async deleteSession(runId: string): Promise<void> {
      // Remove from our tracking
      sessionIdMap.delete(runId);
      runsRepo
        .updateRun(runId, { sessionId: null })
        .catch((err) => logError("Failed to clear session ID in DB:", err));

      // If there's an active run, abort it
      const runState = activeRuns.get(runId);
      if (runState) {
        try {
          runState.abortController.abort();
        } catch (err) {
          logError("Error aborting run:", err);
        }
        // Call query.interrupt() if available
        if (runState.query?.interrupt) {
          try {
            await runState.query.interrupt();
          } catch {
            // Ignore interrupt errors
          }
        }
        activeRuns.delete(runId);
      }
    },

    async abortRun(runId: string): Promise<void> {
      // Cancel any pending tool-approval dialogs for this run
      cancelPendingRequests(runId);

      const runState = activeRuns.get(runId);
      if (runState) {
        runState.aborted = true;
        try {
          runState.abortController.abort();
        } catch (err) {
          logError("Error aborting controller:", err);
        }
        // Call query.interrupt() if available
        if (runState.query?.interrupt) {
          try {
            await runState.query.interrupt();
          } catch {
            // Ignore interrupt errors
          }
        }
      }
    },

    async shutdown(): Promise<void> {
      // Cancel all pending tool-approval dialogs
      clearAllPendingRequests();

      // Mark all runs as aborted and interrupt queries
      const interruptPromises: Promise<void>[] = [];

      for (const [, state] of activeRuns) {
        state.aborted = true;
        try {
          state.abortController.abort();
        } catch {
          // Ignore abort errors
        }
        // Collect interrupt promises
        if (state.query?.interrupt) {
          interruptPromises.push(
            state.query.interrupt().catch(() => {
              // Ignore shutdown interrupt errors
            }),
          );
        }
      }

      // Wait for all interrupts with a timeout
      if (interruptPromises.length > 0) {
        await Promise.race([
          Promise.all(interruptPromises),
          new Promise((resolve) => setTimeout(resolve, 2000)), // 2s timeout
        ]);
      }

      // Small delay to let pending operations complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      activeRuns.clear();
      sessionIdMap.clear();
      toolCallIndex.clear();

      // Reset SDK state
      sdkLoaded = false;
      loadError = null;
      queryFn = null;

      // Clear models cache
      cachedModels = null;
      cachedModelsTimestamp = 0;

      // Clear commands cache
      commandsCache.clear();

      // Clear skills cache
      skillsCache.clear();

      logInfo("Shutdown complete");
    },

    async listModels(): Promise<ModelInfo[]> {
      // Check cache first
      const now = Date.now();
      if (cachedModels && now - cachedModelsTimestamp < MODELS_CACHE_TTL_MS) {
        return cachedModels;
      }

      try {
        await ensureSDK();

        if (!queryFn) {
          logWarn("SDK not available, returning fallback models");
          return getDefaultModels(config.defaultModel);
        }

        // Find CLI binary using same logic as buildOptions
        let binaryPath: string | null = null;
        if (config.binary) {
          const resolved = resolveCandidate(config.binary);
          if (resolved) {
            binaryPath = resolved;
          }
        }
        if (!binaryPath) {
          binaryPath = findClaudeBinary();
        }

        if (!binaryPath) {
          logWarn("CLI not found, returning fallback models");
          return getDefaultModels(config.defaultModel);
        }

        // Create a temporary query to fetch supported models
        const tempQuery = queryFn({
          prompt: "", // Empty prompt - we just need the query object
          options: {
            pathToClaudeCodeExecutable: binaryPath,
          },
        });

        // Fetch supported models from SDK
        const sdkModels = await tempQuery.supportedModels();

        if (!sdkModels || sdkModels.length === 0) {
          logWarn("SDK returned no models, using fallback");
          return getDefaultModels(config.defaultModel);
        }

        // Map SDK models to our ModelInfo format
        const models: ModelInfo[] = sdkModels.map((sdkModel, index) => {
          // SDK's .d.ts declares supportsFastMode but the runtime payload
          // doesn't include it (verified via the actual sdkModels response:
          // only value/displayName/description/supportsEffort/supportedEffortLevels/
          // supportsAdaptiveThinking/supportsAutoMode are populated). Fast mode
          // is currently only meaningful on Opus 4.6; opus 4.7 / sonnet 4.6 /
          // haiku do NOT use it. Match the historical literal ids so when the
          // SDK starts returning supportsFastMode (or surfaces an opus-4-6
          // entry again) it lights up automatically.
          //TO-DO: add supportsFastMode to the sdkModels response 
          const id = sdkModel.value;
          const fallbackFastMode = id === "claude-opus-4-6" || id === "opus-4-6";
          return {
            id,
            displayName: sdkModel.displayName,
            description: sdkModel.description,
            isDefault:
              sdkModel.value === config.defaultModel ||
              (!config.defaultModel && index === 0),
            capabilities: {
              streaming: true,
              vision: true,
              functionCalling: true,
              // Mark opus models as having reasoning capability
              reasoning: sdkModel.value.includes("opus"),
            },
            // Estimate context window based on model name
            contextWindow: sdkModel.value.includes("haiku") ? 128000 : 200000,
            supportsFastMode: sdkModel.supportsFastMode ?? fallbackFastMode,
            supportsEffort: sdkModel.supportsEffort,
            supportedEffortLevels: sdkModel.supportedEffortLevels,
          };
        });

        // Cache the result
        cachedModels = models;
        cachedModelsTimestamp = now;

        return models;
      } catch (error) {
        logError("Failed to fetch models from SDK:", error);
        return getDefaultModels(config.defaultModel);
      }
    },

    async listCommands(workspacePath?: string): Promise<CommandInfo[]> {
      const now = Date.now();
      const cacheKey = workspacePath ?? "__global__";
      const cachedEntry = commandsCache.get(cacheKey);
      if (cachedEntry && now - cachedEntry.timestamp < COMMANDS_CACHE_TTL_MS) {
        return cachedEntry.commands;
      }

      try {
        await ensureSDK();

        if (!queryFn) {
          logWarn("SDK not available, returning empty commands list");
          return [];
        }

        // Find CLI binary using same logic as buildOptions
        let binaryPath: string | null = null;
        if (config.binary) {
          const resolved = resolveCandidate(config.binary);
          if (resolved) {
            binaryPath = resolved;
          }
        }
        if (!binaryPath) {
          binaryPath = findClaudeBinary();
        }

        if (!binaryPath) {
          logWarn("CLI not found, returning empty commands list");
          return [];
        }

        const tempQuery = queryFn({
          prompt: "",
          options: {
            pathToClaudeCodeExecutable: binaryPath,
          },
        });

        const initResult = await tempQuery.initializationResult();

        if (!initResult?.commands || initResult.commands.length === 0) {
          logWarn("SDK returned no commands");
          return [];
        }

        // initializationResult().commands mixes built-in /commands with disk-backed skills.
        // supportedCommands() currently mirrors the full list (cannot use it to split). Exclude only
        // skills we discover the same way as the $ menu (SKILL.md trees under ~/.claude/skills and project .claude/skills).
        const diskSkills = await fetchDiskSkills(workspacePath);
        const diskSkillNames = new Set(diskSkills.map((s) => s.name));

        const commands: CommandInfo[] = initResult.commands
          .filter((cmd) => !diskSkillNames.has(cmd.name))
          .map((cmd) => ({
            name: cmd.name,
            description: cmd.description,
            argumentHint: cmd.argumentHint,
            userFacing: true,
          }));

        commandsCache.set(cacheKey, { commands, timestamp: now });

        return commands;
      } catch (error) {
        logError("Failed to fetch commands from SDK:", error);
        return [];
      }
    },

    async generateTitle(goal: string, context?: import("../../../../shared/adapter.types").WorkRunContextItem[]): Promise<string> {
      await ensureSDK();

      if (!queryFn) {
        throw new Error("Claude SDK not properly initialized");
      }

      // Build context snippet if available
      let contextSnippet = "";
      if (context && context.length > 0) {
        contextSnippet = context
          .map((ctx) => {
            const header = ctx.ref ? `[${ctx.kind}: ${ctx.ref}]` : `[${ctx.kind}]`;
            return `${header} ${(ctx.content || "").substring(0, 200)}`;
          })
          .join("\n")
          .substring(0, 500);
      }

      // Embed the title instruction directly in the prompt so it can't be overridden
      const titlePrompt = [
        "Generate a concise title (2-5 words) that summarizes what the user wants.",
        "Rules:",
        "- Reply with ONLY the title text, nothing else",
        "- Use title case: capitalize the first letter of each word (e.g. \"Fix Login Redirect\", \"Add Dark Mode\", \"Greeting Message\")",
        "- Do NOT use generic descriptions of the request type (e.g. NOT \"Greeting Title Generation\")",
        "- Instead, describe the actual topic or intent (e.g. \"Hello Greeting\" for a hello message)",
        "- No quotes, no punctuation at the end, no prefixes",
        "",
        `User message: ${goal}`,
        contextSnippet ? `\nContext:\n${contextSnippet}` : "",
      ].filter(Boolean).join("\n");

      const options = await buildOptions(
        "claude-haiku-4-5-20251001", // Use haiku for fast, cheap title generation
        undefined, // no workspace path needed
        undefined, // no abort controller
        undefined, // no resume session
        undefined, // no hooks
        undefined, // no agents
        undefined, // no runId (skip tool approval hook)
      );

      // Override for title generation: minimal config, no tools
      options.maxTurns = 1;
      options.allowedTools = [];
      options.disallowedTools = ["*"];
      options.systemPrompt =
        "You generate short titles. Output ONLY the title (2-5 words, title case). Describe the topic, not the action of generating a title.";

      const query = queryFn({
        prompt: titlePrompt,
        options,
      });

      let titleText = "";
      for await (const msg of query) {
        if (msg.type === "assistant") {
          const assistantMsg = msg as { message?: { content?: Array<{ type: string; text?: string }> } };
          if (assistantMsg.message?.content) {
            for (const block of assistantMsg.message.content) {
              if (block.type === "text" && block.text) {
                titleText += block.text;
              }
            }
          }
        }
      }

      // Clean up: remove quotes, "Title:" prefix, markdown, and take only first line
      const title = titleText
        .trim()
        .split("\n")[0]
        .trim()
        .replace(/^(title:\s*)/i, "")
        .replace(/^["'`]|["'`]$/g, "")
        .replace(/[.!?]$/, "")
        .trim();

      if (!title) {
        throw new Error("Empty title generated");
      }

      return title.slice(0, 50);
    },

    async listSkills(workspacePath?: string): Promise<SkillInfo[]> {
      return fetchDiskSkills(workspacePath);
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Discover skills from a directory containing skill subdirectories
 */
async function discoverSkillsFromDirectory(
  skillsDir: string,
  source: "user" | "project",
): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];

  try {
    // Check if directory exists
    if (!fs.existsSync(skillsDir)) {
      return skills;
    }

    const stat = fs.statSync(skillsDir);
    if (!stat.isDirectory()) {
      return skills;
    }

    // Read all subdirectories
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillDir = path.join(skillsDir, entry.name);
      const skillMdPath = path.join(skillDir, "SKILL.md");

      // Check if SKILL.md exists
      if (!fs.existsSync(skillMdPath)) {
        continue;
      }

      try {
        const skill = parseSkillFile(skillMdPath, entry.name, source);
        if (skill) {
          skills.push(skill);
        }
      } catch (err) {
        console.warn(
          `[ClaudeAdapter] Failed to parse skill ${entry.name}:`,
          err,
        );
      }
    }
  } catch (err) {
    console.warn(
      `[ClaudeAdapter] Failed to read skills directory ${skillsDir}:`,
      err,
    );
  }

  return skills;
}

/**
 * Parse a SKILL.md file and extract skill information
 */
function parseSkillFile(
  filePath: string,
  dirName: string,
  source: "user" | "project",
): SkillInfo | null {
  const content = fs.readFileSync(filePath, "utf-8");

  // Parse YAML frontmatter
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    // No frontmatter, use directory name as skill name
    // and first paragraph as description
    const firstParagraph = content.trim().split("\n\n")[0]?.trim();
    return {
      name: dirName,
      description: firstParagraph?.substring(0, 200),
      source,
      path: filePath,
      userInvokable: true,
      modelInvocable: true,
    };
  }

  const frontmatter = frontmatterMatch[1];
  const parsed = parseSimpleYaml(frontmatter);

  // Extract skill info from frontmatter
  const skill: SkillInfo = {
    name: (parsed.name as string) || dirName,
    description: parsed.description as string | undefined,
    argumentHint: parsed["argument-hint"] as string | undefined,
    userInvokable: parsed["user-invokable"] !== false,
    modelInvocable: parsed["disable-model-invocation"] !== true,
    source,
    model: parsed.model as string | undefined,
    forked: parsed.context === "fork",
    agent: parsed.agent as string | undefined,
    path: filePath,
  };

  // If no description in frontmatter, use first paragraph of content
  if (!skill.description) {
    const bodyContent = content.slice(frontmatterMatch[0].length).trim();
    const firstParagraph = bodyContent.split("\n\n")[0]?.trim();
    if (firstParagraph && !firstParagraph.startsWith("#")) {
      skill.description = firstParagraph.substring(0, 200);
    }
  }

  return skill;
}

/**
 * Simple YAML parser for skill frontmatter
 * Handles basic key: value pairs and booleans
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    let value: unknown = trimmed.slice(colonIndex + 1).trim();

    // Handle quoted strings
    if (
      ((value as string).startsWith('"') && (value as string).endsWith('"')) ||
      ((value as string).startsWith("'") && (value as string).endsWith("'"))
    ) {
      value = (value as string).slice(1, -1);
    }
    // Handle booleans
    else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    }
    // Handle empty values
    else if (value === "") {
      value = undefined;
    }

    result[key] = value;
  }

  return result;
}

// safeJson imported from adapter.shared

/**
 * TODO: CHECK
 * Read MCP servers from Claude settings files.
 * Merges servers from user (~/.claude/settings.json) and project (.claude/settings.json) configs.
 * Project-level servers override user-level servers with the same name.
 */
function readMcpServersFromSettings(
  settingSources: Array<"user" | "project" | "local">,
  workspacePath?: string,
): Record<string, McpServerConfig> {
  const mergedServers: Record<string, McpServerConfig> = {};

  // Read user settings from multiple locations Claude CLI uses
  if (settingSources.includes("user")) {
    // Primary: ~/.claude/settings.json (newer format)
    const userSettingsPath = path.join(
      os.homedir(),
      ".claude",
      "settings.json",
    );
    const userServers = readMcpServersFromFile(userSettingsPath);
    if (userServers) {
      Object.assign(mergedServers, userServers);
    }

    // Also check ~/.claude.json (Claude CLI stores config here too)
    const claudeJsonPath = path.join(os.homedir(), ".claude.json");
    const claudeJsonServers = readMcpServersFromFile(claudeJsonPath);
    if (claudeJsonServers) {
      Object.assign(mergedServers, claudeJsonServers);
    }
  }

  // Read project settings (if workspace path is provided)
  if (settingSources.includes("project") && workspacePath) {
    const projectSettingsPath = path.join(
      workspacePath,
      ".claude",
      "settings.json",
    );
    const projectServers = readMcpServersFromFile(projectSettingsPath);
    if (projectServers) {
      Object.assign(mergedServers, projectServers);
    }

    // Also check for .mcp.json in project root (common convention)
    const mcpJsonPath = path.join(workspacePath, ".mcp.json");
    const mcpJsonServers = readMcpServersFromFile(mcpJsonPath);
    if (mcpJsonServers) {
      Object.assign(mergedServers, mcpJsonServers);
    }
  }

  // Read local settings (if workspace path is provided)
  if (settingSources.includes("local") && workspacePath) {
    const localSettingsPath = path.join(
      workspacePath,
      ".claude",
      "settings.local.json",
    );
    const localServers = readMcpServersFromFile(localSettingsPath);
    if (localServers) {
      Object.assign(mergedServers, localServers);
    }
  }

  return mergedServers;
}

/**
 * Read MCP servers from a single settings file.
 * Returns null if file doesn't exist or is invalid.
 */
function readMcpServersFromFile(
  filePath: string,
): Record<string, McpServerConfig> | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const settings = JSON.parse(content);

    // Handle both settings.json format (mcpServers) and .mcp.json format (root level servers)
    const servers = settings.mcpServers || settings;

    if (!servers || typeof servers !== "object") {
      return null;
    }

    // Validate and filter valid MCP server configs
    const validServers: Record<string, McpServerConfig> = {};
    for (const [name, config] of Object.entries(servers)) {
      if (isValidMcpServerConfig(config)) {
        validServers[name] = config as McpServerConfig;
      }
    }

    if (Object.keys(validServers).length > 0) {
      //logInfo(`Loaded ${Object.keys(validServers).length} MCP server(s) from ${filePath}`);
    }

    return Object.keys(validServers).length > 0 ? validServers : null;
  } catch (err) {
    logWarn(`Failed to read MCP servers from ${filePath}:`, err);
    return null;
  }
}

/**
 * Validate that a config object is a valid MCP server config.
 */
function isValidMcpServerConfig(config: unknown): boolean {
  if (!config || typeof config !== "object") {
    return false;
  }

  const c = config as Record<string, unknown>;

  // stdio transport: requires command
  if (c.type === undefined || c.type === "stdio") {
    return typeof c.command === "string" && c.command.length > 0;
  }

  // http transport: requires url
  if (c.type === "http") {
    return typeof c.url === "string" && c.url.length > 0;
  }

  // sse transport: requires url
  if (c.type === "sse") {
    return typeof c.url === "string" && c.url.length > 0;
  }

  return false;
}

/**
 * Get default models for Claude
 */
function getDefaultModels(defaultModel?: string): ModelInfo[] {
  const models: ModelInfo[] = [
    {
      id: "claude-sonnet-4-6",
      displayName: "Claude Sonnet 4.6",
      isDefault: defaultModel === "claude-sonnet-4-6" || !defaultModel,
      capabilities: {
        streaming: true,
        vision: true,
        functionCalling: true,
      },
      contextWindow: 200000,
      supportsFastMode: true,
      supportsEffort: true,
      supportedEffortLevels: ["low", "medium", "high"],
    },
    {
      id: "claude-opus-4-6",
      displayName: "Claude Opus 4.6",
      isDefault: defaultModel === "claude-opus-4-6",
      capabilities: {
        streaming: true,
        vision: true,
        functionCalling: true,
        reasoning: true,
      },
      contextWindow: 200000,
      supportsFastMode: true,
      supportsEffort: true,
      supportedEffortLevels: ["low", "medium", "high", "max"],
    },
    {
      id: "claude-haiku-4-5",
      displayName: "Claude Haiku 4.5",
      isDefault: defaultModel === "claude-haiku-4-5" || !defaultModel,
      capabilities: {
        streaming: true,
        vision: true,
        functionCalling: true,
      },
      contextWindow: 128000,
      supportsFastMode: false,
      supportsEffort: true,
      supportedEffortLevels: ["low", "medium", "high"],
    },
  ];

  return models;
}
