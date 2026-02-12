import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type {
  WorkRunAdapter,
  WorkRunRequest,
  WorkRunContinueRequest,
  WorkRunResult,
  WorkRunEventHandler,
  WorkRunEvent,
  ClaudeCodeAdapterConfig,
  ModelInfo,
  CommandInfo,
  SkillInfo,
  HooksConfig,
  HookMatcher,
  AgentsConfig,
  AgentDefinition,
} from "./adapter.types";
import { findClaudeBinary, resolveCandidate } from "../providers.utils";
import {
  requestToolApproval,
  cancelPendingRequests,
  clearAllPendingRequests,
} from "../../runs/user-input-broker";
import type { ToolApprovalRequest } from "../../runs/runs.dto";

/**
 * NOTE: This adapter uses @anthropic-ai/claude-agent-sdk package.
 * The SDK spawns the Claude Code CLI as a subprocess.
 */

/**
 * Tools that are pre-approved and skip the interactive approval dialog.
 * Matches the standard permissions.allow list from Claude Code settings.
 */
//TODO: In the future, we may want to dynamically load this from the user's Claude Code config directory (~/.claude/permissions.json) to reflect their actual allowed tools, but for now we'll hardcode a default set of commonly used tools.
const DEFAULT_ALLOWED_TOOLS = [
  "Bash", "Read", "Glob", "Grep", "LSP",
  "Task", "TaskCreate", "TaskList", "TaskGet", "TaskUpdate",
  "WebFetch", "WebSearch", "NotebookEdit",
];
const ALLOWED_TOOLS_SET = new Set(DEFAULT_ALLOWED_TOOLS);

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
  model?: "sonnet" | "opus" | "haiku" | "inherit";
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

type McpServerConfig = McpStdioServerConfig | McpHttpServerConfig | McpSSEServerConfig;

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
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan";
  cwd?: string;
  resume?: string;
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

interface SDKResultMessage {
  type: "result";
  subtype:
    | "success"
    | "error_during_execution"
    | "error_max_turns"
    | "error_max_budget_usd"
    | "error_max_structured_output_retries";
  uuid: string;
  session_id: string;
  duration_ms: number;
  is_error: boolean;
  num_turns: number;
  result?: string;
  total_cost_usd: number;
  errors?: string[];
  stop_reason?: "end_turn" | "max_tokens" | "stop_sequence" | "refusal" | "tool_use" | null;
}

interface SDKSystemMessage {
  type: "system";
  subtype: "init" | "compact_boundary";
  uuid: string;
  session_id: string;
  model?: string;
  cwd?: string;
  tools?: string[];
  permissionMode?: string;
}

type SDKMessage =
  | SDKAssistantMessage
  | SDKUserMessage
  | SDKResultMessage
  | SDKSystemMessage
  | {
      type: string;
      session_id?: string;
      [key: string]: unknown;
    };

interface SDKModelInfo {
  value: string;
  displayName: string;
  description: string;
}

interface SDKSlashCommand {
  name: string;
  description: string;
  argumentHint: string;
}

interface SDKQuery extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  rewindFiles(userMessageUuid: string): Promise<void>;
  setPermissionMode(mode: string): Promise<void>;
  setModel(model?: string): Promise<void>;
  setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
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

// Cached commands list (with TTL)
let cachedCommands: CommandInfo[] | null = null;
let cachedCommandsTimestamp = 0;
const COMMANDS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Cached skills list (with TTL)
let cachedSkills: SkillInfo[] | null = null;
let cachedSkillsTimestamp = 0;
const SKILLS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (skills may change more often during development)

// ─────────────────────────────────────────────────────────────
// Logging
// ─────────────────────────────────────────────────────────────
function logInfo(...args: unknown[]): void {
  console.log("[ClaudeAdapter]", ...args);
}

function logWarn(...args: unknown[]): void {
  console.warn("[ClaudeAdapter]", ...args);
}

function logError(...args: unknown[]): void {
  console.error("[ClaudeAdapter]", ...args);
}

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

  // Correlate tool events when toolName/input is missing in completion events
  const toolCallIndex = new Map<
    string,
    { toolName: string; input?: unknown; startedAt?: number }
  >();

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

      sdkLoaded = true;
      logInfo("SDK loaded successfully (stable API)");
    } catch (error) {
      loadError = error instanceof Error ? error : new Error(String(error));
      logError("Failed to load SDK:", loadError.message);
      throw loadError;
    }
  }

  function getModel(requestModel?: string | null): string {
    return requestModel || config.defaultModel || "claude-opus-4-5-20251101";
  }

  /**
   * Build SDK options with proper executable path
   * When using CLI (subscription mode), we strip ANTHROPIC_API_KEY from env
   * to avoid unexpected API billing when user has CLI login session.
   */
  //TODO: Think about usecases of hooks https://platform.claude.com/docs/en/agent-sdk/hooks
  //TODO: Implement fork session https://platform.claude.com/docs/en/agent-sdk/sessions#forking-sessions
  function buildOptions(
    model: string,
    workspacePath?: string,
    abortController?: AbortController,
    resumeSessionId?: string,
    runHooks?: HooksConfig,
    runAgents?: AgentsConfig,
    runId?: string,
  ): SDKOptions {
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

    // Determine permission mode: planMode overrides permissionMode when enabled
    // Options: "default" | "acceptEdits" | "bypassPermissions" | "plan"
    const permissionMode = config.planMode
      ? "plan"
      : config.permissionMode || "default";

    // Setting sources for settings: default to both user and project if not specified
    const settingSources = config.settingSources ?? ["user", "project"];

    // Load MCP servers from settings files and pass them explicitly to the SDK
    // This ensures MCP servers from ~/.claude/settings.json and project settings are used
    const mcpServers = readMcpServersFromSettings(settingSources, workspacePath);

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
      logInfo(`Loaded ${Object.keys(mcpServers).length} MCP server(s):`, Object.keys(mcpServers).join(", "));
    }

    if (workspacePath) {
      options.cwd = workspacePath;
    }

    if (resumeSessionId) {
      options.resume = resumeSessionId;
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
      const entry = config.structuredOutputs[config.structuredOutputsSelectedId];
      if (entry?.schema) {
        options.outputFormat = { type: "json_schema", schema: entry.schema };
      }
    }

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

    return options;
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
        model: agentDef.model,
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
   * Build a PreToolUse SDK hook matcher that requests interactive approval
   * from the renderer before allowing a tool call to proceed.
   */
  function buildToolApprovalHook(runId: string, allowedTools: Set<string>): SDKHookMatcher {
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
            const questions = toolInput.questions as Array<{
              question?: string;
              options?: Array<{ label: string; description?: string }>;
              multiSelect?: boolean;
            }> | undefined;

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

          // For AskUserQuestion, inject the user's answer into the tool input
          if (isAskUser && response.answer !== undefined) {
            return {
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "allow",
                updatedInput: {
                  ...toolInput,
                  answers: { "0": response.answer },
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

  function mapSDKMessage(msg: SDKMessage, runId: string): WorkRunEvent[] {
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
          events.push({
            type: "log",
            message: userContent,
            level: "sdk-user",
            ts,
          });
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
        // Final result message - content is already streamed via assistant.message
        const resultMsg = msg as SDKResultMessage;

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
        if (resultMsg.is_error && resultMsg.errors) {
          events.push({
            type: "log",
            message: `[error] ${resultMsg.errors.join(", ")}`,
            level: "error",
            ts,
          });
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

  function extractArtifactsFromToolOutput(
    toolName: string,
    output: unknown,
  ): WorkRunEvent[] {
    const artifacts: WorkRunEvent[] = [];

    if (
      toolName === "Write" ||
      toolName === "Edit" ||
      toolName === "write_file" ||
      toolName === "edit_file" ||
      toolName === "create_file" ||
      toolName === "str_replace_editor"
    ) {
      const out = output as Record<string, unknown> | undefined;
      if (out?.path && typeof out.path === "string") {
        artifacts.push({
          type: "artifact",
          kind: "file",
          path: out.path,
          content: typeof out.content === "string" ? out.content : undefined,
          metadata: { toolName },
        });
      } else if (out?.file_path && typeof out.file_path === "string") {
        artifacts.push({
          type: "artifact",
          kind: "file",
          path: out.file_path,
          content: typeof out.content === "string" ? out.content : undefined,
          metadata: { toolName },
        });
      }
    }

    // Handle patch/diff tools
    if (
      toolName === "apply_patch" ||
      toolName === "apply_diff" ||
      toolName === "patch"
    ) {
      const out = output as Record<string, unknown> | undefined;
      const patch = (out as any)?.patch ?? (out as any)?.diff;
      if (patch) {
        artifacts.push({
          type: "artifact",
          kind: "patch",
          path:
            typeof (out as any)?.path === "string"
              ? String((out as any).path)
              : undefined,
          content: typeof patch === "string" ? patch : safeJson(patch),
          metadata: { toolName },
        });
      }
    }

    // Handle shell/command tools
    if (
      toolName === "Bash" ||
      toolName === "bash" ||
      toolName === "shell" ||
      toolName === "terminal" ||
      toolName === "run_command" ||
      toolName === "execute_shell" ||
      toolName === "command_result"
    ) {
      const out = output as any;

      const text =
        typeof out?.stdout === "string"
          ? out.stdout
          : typeof out?.output === "string"
            ? out.output
            : typeof out?.content === "string"
              ? out.content
              : typeof out === "string"
                ? out
                : undefined;

      const exitCode =
        typeof out?.exit_code === "number"
          ? out.exit_code
          : typeof out?.exitCode === "number"
            ? out.exitCode
            : undefined;

      artifacts.push({
        type: "command",
        command: typeof out?.command === "string" ? out.command : "unknown",
        cwd: typeof out?.cwd === "string" ? out.cwd : undefined,
        stdout: text,
        stderr: typeof out?.stderr === "string" ? out.stderr : undefined,
        exitCode,
        endedAt: Date.now(),
        metadata: { toolName },
      });
    }

    return artifacts;
  }

  /**
   * Build the prompt with context
   */
  function buildPrompt(request: WorkRunRequest): string {
    let prompt = request.goal;

    if (request.context && request.context.length > 0) {
      const contextParts = request.context
        .map((ctx) => {
          const header = ctx.ref
            ? `[${ctx.kind}: ${ctx.ref}]`
            : `[${ctx.kind}]`;
          return `${header}\n${ctx.content || "(no content)"}`;
        })
        .join("\n\n---\n\n");

      prompt = `Context:\n${contextParts}\n\n---\n\nGoal: ${request.goal}`;
    }

    return prompt;
  }

  return {
    async startRun(
      request: WorkRunRequest,
      onEvent: WorkRunEventHandler,
    ): Promise<WorkRunResult> {
      const { runId, model } = request;
      const timeout = config.timeout ?? 600000; // 10 minutes default

      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];
      const abortController = new AbortController();
      let lastStopReason: "end_turn" | "max_tokens" | "stop_sequence" | "refusal" | "tool_use" | null | undefined;

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

        const options = buildOptions(
          getModel(model),
          request.workspace.rootPath,
          abortController,
          undefined, // resumeSessionId
          request.hooks, // run-level hooks
          request.agents, // run-level agents
          runId, // for interactive tool approval
        );

        await onEvent({
          type: "log",
          message: `Creating Claude query with model: ${options.model}`,
          level: "start",
          ts: Date.now(),
        });

        const prompt = buildPrompt(request);

        // Emit user's original goal as artifact for UI display
        await onEvent({
          type: "artifact",
          kind: "user-prompt",
          content: request.goal,
          metadata: {
            source: "user",
          },
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
            for await (const msg of query) {
              const runState = activeRuns.get(runId);
              if (runState?.aborted || timedOut) {
                break;
              }

              // Capture session ID for resume capability
              if (msg.session_id && !sessionId) {
                sessionId = msg.session_id;
                sessionIdMap.set(runId, sessionId);
                const state = activeRuns.get(runId);
                if (state) {
                  activeRuns.set(runId, { ...state, sessionId, query });
                }
              }

              // Capture stop reason from result messages
              if (msg.type === "result") {
                const resultMsg = msg as SDKResultMessage;
                if (resultMsg.stop_reason !== undefined) {
                  lastStopReason = resultMsg.stop_reason;
                }
              }

              // Map and emit events
              const events = mapSDKMessage(msg, runId);
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
                    if (artEvent.type === "command") {
                      collectedArtifacts.push({ kind: "command_result" });
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
          };
        }

        await onEvent({ type: "status", status: "succeeded", ts: Date.now() });

        return {
          status: "succeeded",
          summary: "Completed successfully",
          stopReason: lastStopReason ?? null,
          artifacts: collectedArtifacts,
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
      const timeout = config.timeout ?? 600000;

      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];
      const abortController = new AbortController();
      let lastStopReason: "end_turn" | "max_tokens" | "stop_sequence" | "refusal" | "tool_use" | null | undefined;

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

        // Get the session ID from our tracking
        const sessionId = sessionIdMap.get(runId);
        if (!sessionId) {
          throw new Error(
            `Session not found for run ${runId}. The session may have expired or was never created.`,
          );
        }

        const options = buildOptions(
          getModel(config.defaultModel),
          request.workspace.rootPath,
          abortController,
          sessionId, // Resume with session ID
          request.hooks, // run-level hooks
          request.agents, // run-level agents
          runId, // for interactive tool approval
        );

        // Build prompt with any additional context
        let prompt = message;
        if (request.context && request.context.length > 0) {
          const contextParts = request.context
            .map((ctx) => {
              const header = ctx.ref
                ? `[${ctx.kind}: ${ctx.ref}]`
                : `[${ctx.kind}]`;
              return `${header}\n${ctx.content || "(no content)"}`;
            })
            .join("\n\n---\n\n");

          prompt = `Context:\n${contextParts}\n\n---\n\n${message}`;
        }

        // Emit user's follow-up message as artifact for UI display
        await onEvent({
          type: "artifact",
          kind: "user-prompt",
          content: message,
          metadata: {
            source: "user",
          },
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
            for await (const msg of query) {
              const runState = activeRuns.get(runId);
              if (runState?.aborted || timedOut) {
                break;
              }

              // Capture stop reason from result messages
              if (msg.type === "result") {
                const resultMsg = msg as SDKResultMessage;
                if (resultMsg.stop_reason !== undefined) {
                  lastStopReason = resultMsg.stop_reason;
                }
              }

              const events = mapSDKMessage(msg, runId);
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
                    if (artEvent.type === "command") {
                      collectedArtifacts.push({ kind: "command_result" });
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
          };
        }

        await onEvent({ type: "status", status: "succeeded", ts: Date.now() });

        return {
          status: "succeeded",
          summary: "Completed successfully",
          stopReason: lastStopReason ?? null,
          artifacts: collectedArtifacts,
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
        };
      } finally {
        activeRuns.delete(runId);
      }
    },
      //TODO improve canresume logic - https://platform.claude.com/docs/en/agent-sdk/sessions#resuming-sessions
    async canResumeSession(runId: string): Promise<boolean> {
      // Check if we have a session ID stored for this run
      const sessionId = sessionIdMap.get(runId);
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
      cachedCommands = null;
      cachedCommandsTimestamp = 0;

      // Clear skills cache
      cachedSkills = null;
      cachedSkillsTimestamp = 0;

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
        const models: ModelInfo[] = sdkModels.map((sdkModel, index) => ({
          id: sdkModel.value,
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
        }));

        // Cache the result
        cachedModels = models;
        cachedModelsTimestamp = now;

        return models;
      } catch (error) {
        logError("Failed to fetch models from SDK:", error);
        return getDefaultModels(config.defaultModel);
      }
    },

    async listCommands(): Promise<CommandInfo[]> {
      // Check cache first
      const now = Date.now();
      if (
        cachedCommands &&
        now - cachedCommandsTimestamp < COMMANDS_CACHE_TTL_MS
      ) {
        return cachedCommands;
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

        // Create a temporary query to fetch supported commands
        const tempQuery = queryFn({
          prompt: "", // Empty prompt - we just need the query object
          options: {
            pathToClaudeCodeExecutable: binaryPath,
          },
        });

        // Fetch supported commands from SDK
        const sdkCommands = await tempQuery.supportedCommands();

        if (!sdkCommands || sdkCommands.length === 0) {
          logWarn("SDK returned no commands");
          return [];
        }

        // Map SDK commands to our CommandInfo format
        const commands: CommandInfo[] = sdkCommands.map((cmd) => ({
          name: cmd.name,
          description: cmd.description,
          argumentHint: cmd.argumentHint,
          userFacing: true,
        }));

        // Cache the result
        cachedCommands = commands;
        cachedCommandsTimestamp = now;

        return commands;
      } catch (error) {
        logError("Failed to fetch commands from SDK:", error);
        return [];
      }
    },

    async listSkills(workspacePath?: string): Promise<SkillInfo[]> {
      // Check cache first
      const now = Date.now();
      if (cachedSkills && now - cachedSkillsTimestamp < SKILLS_CACHE_TTL_MS) {
        return cachedSkills;
      }

      try {
        const settingSources = config.settingSources ?? ["user", "project"];
        const skills: SkillInfo[] = [];

        // Discover skills from user directory (~/.claude/skills/)
        if (settingSources.includes("user")) {
          const userSkillsDir = path.join(os.homedir(), ".claude", "skills");
          const userSkills = await discoverSkillsFromDirectory(
            userSkillsDir,
            "user",
          );
          skills.push(...userSkills);
        }

        // Discover skills from project directory (.claude/skills/)
        if (settingSources.includes("project") && workspacePath) {
          const projectSkillsDir = path.join(
            workspacePath,
            ".claude",
            "skills",
          );
          const projectSkills = await discoverSkillsFromDirectory(
            projectSkillsDir,
            "project",
          );
          skills.push(...projectSkills);
        }

        // Cache the result
        cachedSkills = skills;
        cachedSkillsTimestamp = now;

        if (skills.length > 0) {
          //logInfo(`Discovered ${skills.length} skill(s)`);
        }
        return skills;
      } catch (error) {
        logError("Failed to discover skills:", error);
        return [];
      }
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
      userInvocable: true,
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
    userInvocable: parsed["user-invocable"] !== false,
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

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
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
    const userSettingsPath = path.join(os.homedir(), ".claude", "settings.json");
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
    const projectSettingsPath = path.join(workspacePath, ".claude", "settings.json");
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
    const localSettingsPath = path.join(workspacePath, ".claude", "settings.local.json");
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
function readMcpServersFromFile(filePath: string): Record<string, McpServerConfig> | null {
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
      logInfo(`Loaded ${Object.keys(validServers).length} MCP server(s) from ${filePath}`);
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
      id: "claude-sonnet-4-5-20250929",
      displayName: "Claude Sonnet 4.5",
      isDefault: defaultModel === "claude-sonnet-4-5-20250929" || !defaultModel,
      capabilities: {
        streaming: true,
        vision: true,
        functionCalling: true,
      },
      contextWindow: 200000,
    },
    {
      id: "claude-opus-4-5-20251101",
      displayName: "Claude Opus 4.5",
      isDefault: defaultModel === "claude-opus-4-5-20251101",
      capabilities: {
        streaming: true,
        vision: true,
        functionCalling: true,
        reasoning: true,
      },
      contextWindow: 200000,
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
    },
  ];

  return models;
}
