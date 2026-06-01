// ─────────────────────────────────────────────────────────────
// Claude ProviderDriver
//
// SDK-specific seam for Anthropic's @anthropic-ai/claude-agent-sdk. The SDK
// spawns the Claude Code CLI subprocess and exposes an AsyncGenerator
// (SDKQuery) that streams messages.
//
// Differences from cursor/copilot drivers (worth noting because they shape
// the Driver interface usage):
//
//   - SessionId arrives DURING streaming (`msg.session_id`), not from the
//     acquisition method. Driver persists inline via runsRepo; AcquiredSession
//     omits sessionId so Core skips persistence.
//   - SDK has both AbortController and `query.interrupt()`. Driver wires the
//     incoming AbortSignal to fire both.
//   - Per-run streaming buffers (text + thinking deltas, tool-call correlation
//     index) live on the Session object for cleanup safety. The old adapter
//     held them in factory closure scope which leaked across concurrent runs.
//
// Long-lived caches (models / commands / skills, the SDK loader itself) stay
// in the factory closure as cross-run state.
// ─────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import type {
  AcquiredSession,
  AgentsConfig,
  CliUpdateResult,
  ClaudeCodeAdapterConfig,
  AccountInfo,
  CommandInfo,
  DriverOutcome,
  HookMatcher,
  HooksConfig,
  ModelInfo,
  ProviderDriver,
  SkillInfo,
  WorkRunContextItem,
  WorkRunContinueRequest,
  WorkRunEvent,
  WorkRunEventHandler,
  WorkRunForkRequest,
  WorkRunRequest,
  WorkRunUsage,
} from "../../../../shared/adapter.types";
import { findClaudeBinary, resolveCandidate } from "../providers.utils";
import { requestToolApproval } from "../../runs/user-input-broker";
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

// ─────────────────────────────────────────────────────────────
// SDK type sketches (the SDK is loaded via dynamic import to keep the
// driver compilable without the package installed)
// ─────────────────────────────────────────────────────────────

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

type SDKHooksConfig = {
  [key: string]: SDKHookMatcher[];
};

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

type SDKAgentsConfig = Record<string, SDKAgentDefinition>;

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
  | Record<string, unknown>;

interface SDKOptions {
  outputFormat?: { type: "json_schema"; schema: Record<string, unknown> };
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
  agents?: SDKAgentsConfig;
  maxTurns?: number;
  systemPrompt?: string | { type: "preset"; preset: "claude_code"; append?: string };
  settingSources?: Array<"user" | "project" | "local">;
  hooks?: SDKHooksConfig;
  mcpServers?: Record<string, McpServerConfig>;
  thinking?:
    | { type: "adaptive" }
    | { type: "enabled"; budgetTokens?: number }
    | { type: "disabled" };
  effort?: ("low" | "medium" | "high" | "xhigh" | "max") | number;
  settings?: Record<string, unknown>;
  promptSuggestions?: boolean;
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
  message: { role: "assistant"; content: SDKMessageContent[] };
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
  subtype: "init" | "compact_boundary" | "api_retry" | "status";
  uuid: string;
  session_id: string;
  model?: string;
  cwd?: string;
  tools?: string[];
  permissionMode?: string;
  agents?: string[];
  apiKeySource?: string;
  betas?: string[];
  claude_code_version?: string;
  mcp_servers?: { name: string; status: string }[];
  slash_commands?: string[];
  output_style?: string;
  skills?: string[];
  // subtype: "compact_boundary"
  compact_metadata?: {
    trigger: "manual" | "auto";
    pre_tokens: number;
    post_tokens?: number;
    duration_ms?: number;
  };
  // subtype: "api_retry"
  attempt?: number;
  max_retries?: number;
  retry_delay_ms?: number;
  error_status?: number | null;
}

interface SDKRateLimitInfo {
  status: "allowed" | "allowed_warning" | "rejected";
  resetsAt?: number;
  rateLimitType?: "five_hour" | "seven_day" | "seven_day_opus" | "seven_day_sonnet" | "overage";
  utilization?: number;
}

interface SDKRateLimitEvent {
  type: "rate_limit_event";
  rate_limit_info: SDKRateLimitInfo;
  uuid: string;
  session_id: string;
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
  | SDKRateLimitEvent
  | SDKPartialAssistantMessage
  | { type: string; session_id?: string; [key: string]: unknown };

interface SDKModelInfo {
  value: string;
  displayName: string;
  description: string;
  supportsFastMode?: boolean;
  supportsEffort?: boolean;
  supportedEffortLevels?: ("low" | "medium" | "high" | "xhigh" | "max")[];
  supportsAutoMode?: boolean;
  supportsAdaptiveThinking?: boolean;
}

interface SDKSlashCommand {
  name: string;
  description: string;
  argumentHint: string;
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
  rewindFiles(userMessageUuid: string, options?: { dryRun?: boolean }): Promise<unknown>;
  setPermissionMode(mode: string): Promise<void>;
  setModel(model?: string): Promise<void>;
  setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
  initializationResult(): Promise<SDKInitializationResult>;
  supportedCommands(): Promise<SDKSlashCommand[]>;
  supportedModels(): Promise<SDKModelInfo[]>;
  mcpServerStatus(): Promise<unknown[]>;
  accountInfo(): Promise<{
    email?: string;
    organization?: string;
    subscriptionType?: string;
    apiKeySource?: string;
    tokenSource?: string;
  }>;
}

// ─────────────────────────────────────────────────────────────
// Per-run session state (handed back to Core as opaque `session`)
// ─────────────────────────────────────────────────────────────

interface ClaudeSession {
  runId: string;
  options: SDKOptions;
  abortController: AbortController;
  /** Mutable: set during streaming. */
  state: {
    sessionId?: string;
    lastStopReason?: string | null;
    lastUsage?: WorkRunUsage;
    hasAssistantContent: boolean;
  };
  /** Per-run tool-call correlation index (toolCallId → toolName/input). */
  toolCallIndex: Map<string, { toolName: string; input?: unknown; startedAt?: number }>;
  /** Per-(runId, blockIndex) streaming text buffers. */
  partialTextBuffers: Map<string, string>;
  /** Per-(runId, blockIndex) streaming thinking buffers. */
  partialThinkingBuffers: Map<string, string>;
  /** SDK query — created lazily in executePrompt because the prompt is supplied there. */
  query?: SDKQuery;
}

const { info: logInfo, warn: logWarn, error: logError } = createLogger("[ClaudeDriver]");

// ─────────────────────────────────────────────────────────────
// Driver factory
// ─────────────────────────────────────────────────────────────

export function createClaudeDriver(config: ClaudeCodeAdapterConfig): ProviderDriver {
  // SDK loader state
  let sdkLoaded = false;
  let loadError: Error | null = null;
  let queryFn: ((options: { prompt: string; options?: SDKOptions }) => SDKQuery) | null = null;
  let createSdkMcpServerFn: ((...args: any[]) => any) | null = null;
  let toolFn: ((...args: any[]) => any) | null = null;

  // Cross-run TTL caches
  let cachedModels: ModelInfo[] | null = null;
  let cachedModelsTimestamp = 0;
  const MODELS_CACHE_TTL_MS = 5 * 60 * 1000;

  const commandsCache = new Map<
    string,
    { commands: CommandInfo[]; timestamp: number }
  >();
  const COMMANDS_CACHE_TTL_MS = 10 * 60 * 1000;

  const skillsCache = new Map<string, { skills: SkillInfo[]; timestamp: number }>();
  const SKILLS_CACHE_TTL_MS = 5 * 60 * 1000;

  // Cross-run sessionId memo (resume lookup avoids hitting the DB every time)
  const sessionIdMemo = new Map<string, string>();

  // ─────────────────────────────────────────────────────────────
  // SDK loader
  // ─────────────────────────────────────────────────────────────

  async function ensureSDK(): Promise<void> {
    if (loadError) throw loadError;
    if (sdkLoaded) return;

    try {
      const ClaudeSDK = await import("@anthropic-ai/claude-agent-sdk").catch(() => null);

      if (!ClaudeSDK) {
        throw new Error(
          "Claude Agent SDK (@anthropic-ai/claude-agent-sdk) is not installed. " +
            "Please install it to use the Claude provider: npm install @anthropic-ai/claude-agent-sdk",
        );
      }

      const query = (ClaudeSDK as any).query;
      if (!query) {
        throw new Error(
          "Could not find query() in @anthropic-ai/claude-agent-sdk. " +
            "Make sure you have the latest version installed.",
        );
      }

      queryFn = query;
      createSdkMcpServerFn = (ClaudeSDK as any).createSdkMcpServer ?? null;
      toolFn = (ClaudeSDK as any).tool ?? null;
      sdkLoaded = true;
      logInfo("SDK loaded successfully");
    } catch (error) {
      loadError = error instanceof Error ? error : new Error(String(error));
      logError("Failed to load SDK:", loadError.message);
      throw loadError;
    }
  }

  function getModel(requestModel?: string | null): string {
    return requestModel || config.defaultModel || "claude-opus-4-6";
  }

  // ─────────────────────────────────────────────────────────────
  // Hook builders
  // ─────────────────────────────────────────────────────────────

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

  function buildToolApprovalHook(runId: string, allowedTools: Set<string>): SDKHookMatcher {
    return {
      hooks: [
        async (
          input: Record<string, unknown>,
          _toolUseId: string | null,
          context: { signal: AbortSignal },
        ): Promise<Record<string, unknown>> => {
          const toolName = (input.tool_name as string) || "unknown";
          const toolInput = (input.tool_input as Record<string, unknown>) || {};

          if (allowedTools.has(toolName)) {
            return {
              hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" },
            };
          }

          if (toolName.startsWith("mcp__")) {
            return {
              hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" },
            };
          }

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

          if (context.signal.aborted) {
            return {
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "deny",
                permissionDecisionReason: "Request aborted",
              },
            };
          }

          const response = await Promise.race([
            requestToolApproval(req),
            new Promise<null>((resolve) => {
              context.signal.addEventListener("abort", () => resolve(null), { once: true });
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
          // Per Anthropic docs: `questions` MUST pass through unchanged; `answers` keys MUST
          // be the question text (not an index). Multi-select values join with ", ".
          if (isAskUser && response.answer !== undefined) {
            const askedQuestions = (toolInput.questions ?? []) as Array<{ question?: string }>;
            const answersMap: Record<string, string> = {};
            const primaryText = askedQuestions[0]?.question;
            if (primaryText) answersMap[primaryText] = response.answer;
            // Best-effort fallback: mirror the answer to all questions (the dialog only
            // renders one at a time; multi-question Claude tool calls are rare).
            for (let i = 1; i < askedQuestions.length; i++) {
              const text = askedQuestions[i]?.question;
              if (text) answersMap[text] = response.answer;
            }
            return {
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                permissionDecision: "allow",
                updatedInput: { questions: askedQuestions, answers: answersMap },
              },
            };
          }

          return {
            hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" },
          };
        },
      ],
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Hooks / agents config merging + SDK conversion
  // ─────────────────────────────────────────────────────────────

  function mergeAgentsConfig(
    configAgents?: AgentsConfig,
    runAgents?: AgentsConfig,
  ): AgentsConfig | undefined {
    if (!configAgents && !runAgents) return undefined;
    if (!configAgents) return runAgents;
    if (!runAgents) return configAgents;
    return { ...configAgents, ...runAgents };
  }

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

  function mergeHooksConfig(
    configHooks?: HooksConfig,
    runHooks?: HooksConfig,
  ): HooksConfig | undefined {
    if (!configHooks && !runHooks) return undefined;
    if (!configHooks) return runHooks;
    if (!runHooks) return configHooks;

    const merged: HooksConfig = { ...configHooks };
    for (const [eventName, matchers] of Object.entries(runHooks)) {
      const key = eventName as keyof HooksConfig;
      if (merged[key]) {
        merged[key] = [...merged[key]!, ...(matchers || [])];
      } else {
        merged[key] = matchers;
      }
    }
    return merged;
  }

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
                const result = await hookFn(input as any, toolUseId, context);
                return result as Record<string, unknown>;
              } catch (error) {
                logError(`Hook error in ${eventName}:`, error);
                return {};
              }
            },
        ),
        timeout: matcher.timeout,
      }));
    }
    return sdkHooks;
  }

  // ─────────────────────────────────────────────────────────────
  // Mains MCP server (in-process)
  // ─────────────────────────────────────────────────────────────

  function buildMainsMcpServer(
    workspaceId: string | null,
    rootPath: string | null,
    runId: string | null,
  ): any {
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
            status: z
              .enum(["open", "in_review", "approved", "rejected"])
              .optional()
              .default("open")
              .describe("Review status"),
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
            reason: z.string().describe("Why this was flagged"),
            suggestion: z.string().optional().describe("Suggested fix"),
            metadata: z.record(z.string(), z.unknown()).optional().describe("Additional metadata as JSON"),
          },
          (args: {
            reviewId: string;
            severity: string;
            file: string;
            lineStart?: number;
            lineEnd?: number;
            message: string;
            reason: string;
            suggestion?: string;
            metadata?: Record<string, unknown>;
          }) => handleSaveFinding(args, ctx),
        ),
        toolFn!(
          "SaveFindings",
          TOOL_DESCRIPTIONS.SaveFindings,
          {
            reviewId: z.string().describe("ID of the parent review"),
            findings: z
              .array(
                z.object({
                  severity: z.enum(["critical", "warning", "info"]),
                  file: z.string(),
                  lineStart: z.number().optional(),
                  lineEnd: z.number().optional(),
                  message: z.string(),
                  reason: z.string(),
                  suggestion: z.string().optional(),
                  metadata: z.record(z.string(), z.unknown()).optional(),
                }),
              )
              .describe("Array of findings to save"),
          },
          (args: {
            reviewId: string;
            findings: Array<{
              severity: string;
              file: string;
              lineStart?: number;
              lineEnd?: number;
              message: string;
              reason: string;
              suggestion?: string;
              metadata?: Record<string, unknown>;
            }>;
          }) => handleSaveFindings(args, ctx),
        ),
        toolFn!(
          "CommitChanges",
          TOOL_DESCRIPTIONS.CommitChanges,
          {
            message: z.string().optional().describe("The commit message"),
            files: z.array(z.string()).optional().describe("Specific files to stage"),
          },
          (args: { message?: string; files?: string[] }) => handleCommitChanges(args, ctx),
        ),
        toolFn!(
          "CreatePR",
          TOOL_DESCRIPTIONS.CreatePR,
          {
            title: z.string().describe("The pull request title"),
            body: z.string().optional().describe("The pull request body"),
            base: z.string().optional().describe("The base branch"),
            draft: z.boolean().optional().describe("Create as a draft"),
            labels: z.array(z.string()).optional().describe("Labels to add"),
          },
          (args: { title: string; body?: string; base?: string; draft?: boolean; labels?: string[] }) =>
            handleCreatePR(args, ctx),
        ),
      ],
    });
  }

  // ─────────────────────────────────────────────────────────────
  // SDK options builder
  // ─────────────────────────────────────────────────────────────

  async function buildOptions(args: {
    model: string;
    workspacePath?: string;
    abortController?: AbortController;
    resumeSessionId?: string;
    runHooks?: HooksConfig;
    runAgents?: AgentsConfig;
    runId?: string;
    workspaceId?: string;
    forkSession?: boolean;
    onEvent?: WorkRunEventHandler;
  }): Promise<SDKOptions> {
    const {
      model,
      workspacePath,
      abortController,
      resumeSessionId,
      runHooks,
      runAgents,
      runId,
      workspaceId,
      forkSession,
      onEvent,
    } = args;

    let binaryPath: string | null = null;
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

    if (!binaryPath) {
      binaryPath = findClaudeBinary();
    }

    if (!binaryPath) {
      throw new Error(
        "Claude CLI not found. Please install Claude Code and run `claude login` to authenticate, " +
          "or ensure the CLI is in your PATH. You can also set config.binary to the full path of the claude executable.",
      );
    }

    try {
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
      if (e instanceof Error && e.message.includes("directory")) {
        throw e;
      }
    }

    logInfo("Using Claude CLI at:", binaryPath);

    // Strip API key/auth token when using CLI (subscription mode) so the subprocess
    // uses CLI login session rather than API billing.
    const cleanEnv: Record<string, string | undefined> = { ...process.env };
    delete cleanEnv.ANTHROPIC_API_KEY;
    delete cleanEnv.ANTHROPIC_AUTH_TOKEN;

    const permissionMode = config.permissionMode || "default";
    const settingSources = config.settingSources ?? ["user", "project", "local"];

    const mcpServers = readMcpServersFromSettings(settingSources, workspacePath);
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
    };

    if (Object.keys(mcpServers).length > 0) {
      options.mcpServers = mcpServers;
    }

    if (workspacePath) options.cwd = workspacePath;

    if (resumeSessionId) {
      options.resume = resumeSessionId;
      if (forkSession) options.forkSession = true;
    }

    const mergedAgents = mergeAgentsConfig(config.agents, runAgents);
    if (mergedAgents && Object.keys(mergedAgents).length > 0) {
      options.agents = convertAgentsConfig(mergedAgents);
    }

    const mergedHooks = mergeHooksConfig(config.hooks, runHooks);
    if (mergedHooks && Object.keys(mergedHooks).length > 0) {
      options.hooks = convertHooksConfig(mergedHooks);
    }

    if (config.structuredOutputsSelectedId && config.structuredOutputs) {
      const entry = config.structuredOutputs[config.structuredOutputsSelectedId];
      if (entry?.schema) {
        options.outputFormat = { type: "json_schema", schema: entry.schema };
      }
    }

    if (config.thinkingMode) {
      // A fixed token budget takes precedence over adaptive thinking. Useful on
      // models without adaptive support, or to cap cost/latency.
      options.thinking =
        typeof config.thinkingBudgetTokens === "number" && config.thinkingBudgetTokens > 0
          ? { type: "enabled", budgetTokens: config.thinkingBudgetTokens }
          : { type: "adaptive" };
    } else {
      options.thinking = { type: "disabled" };
    }
    if (config.thinkingMode && config.effortLevel) {
      options.effort = config.effortLevel;
    }

    if (config.fastMode) {
      options.settings = {
        ...((options.settings as Record<string, unknown>) || {}),
        fastMode: true,
      };
    }

    options.promptSuggestions = true;
    options.includePartialMessages = true;

    if (permissionMode !== "bypassPermissions" && runId) {
      const approvalHook = buildToolApprovalHook(runId, ALLOWED_TOOLS_SET);
      if (!options.hooks) options.hooks = {};
      if (!options.hooks.PreToolUse) options.hooks.PreToolUse = [];
      options.hooks.PreToolUse.push(approvalHook);
    }

    {
      const guardHook = await guardsService.buildClaudeGuardHook();
      if (guardHook) {
        if (!options.hooks) options.hooks = {};
        if (!options.hooks.PreToolUse) options.hooks.PreToolUse = [];
        options.hooks.PreToolUse.push(guardHook);
      }
    }

    if (runId && onEvent) {
      if (!options.hooks) options.hooks = {};
      if (!options.hooks.PostToolUse) options.hooks.PostToolUse = [];
      options.hooks.PostToolUse.push(buildPostToolUseHook(onEvent));
    }

    options.systemPrompt = {
      type: "preset",
      preset: "claude_code",
      append:
        "IMPORTANT: Never commit changes using Bash (git add, git commit). If the user asks you to commit, always use the CommitChanges tool from the mains MCP server to stage and commit changes. Similarly, never create pull requests using Bash (gh pr create). Always use the CreatePR tool from the mains MCP server instead.",
    };

    return options;
  }

  // ─────────────────────────────────────────────────────────────
  // Event mapping: SDKMessage → WorkRunEvent[]
  // ─────────────────────────────────────────────────────────────

  function mapSDKMessage(
    msg: SDKMessage,
    cs: ClaudeSession,
  ): WorkRunEvent[] {
    const events: WorkRunEvent[] = [];
    const ts = Date.now();

    switch (msg.type) {
      case "assistant": {
        const assistantMsg = msg as SDKAssistantMessage;
        const isFromSubagent = !!assistantMsg.parent_tool_use_id;

        if (assistantMsg.message?.content) {
          for (const block of assistantMsg.message.content) {
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
              cs.toolCallIndex.set(toolCallId, {
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
                  parentToolUseId: assistantMsg.parent_tool_use_id || undefined,
                  isFromSubagent,
                },
              });

              if (block.name === "Task") {
                const taskInput = block.input as Record<string, unknown> | undefined;
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
                    runInBackground: taskInput?.run_in_background as boolean | undefined,
                  },
                });
              }
            }
          }
        }
        break;
      }

      case "user": {
        const userMsg = msg as SDKUserMessage;
        const content = userMsg.message?.content;

        let userContent: string | undefined;
        if (typeof content === "string") {
          userContent = content;
        } else if (Array.isArray(content)) {
          userContent = content.map((c) => c.text || "").filter(Boolean).join("\n");
        }

        if (userContent && userContent.trim().length > 0) {
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
        } else if (systemMsg.subtype === "compact_boundary") {
          const meta = systemMsg.compact_metadata;
          const trigger = meta?.trigger ?? "auto";
          const pre = meta?.pre_tokens;
          const post = meta?.post_tokens;
          const tokenPart =
            typeof pre === "number"
              ? ` (${pre.toLocaleString()}${typeof post === "number" ? ` → ${post.toLocaleString()}` : ""} tokens)`
              : "";
          events.push({
            type: "log",
            message: `[context] Conversation compacted${tokenPart} — ${trigger} trigger`,
            level: "info",
            ts,
            metadata: { source: "compact_boundary", ...meta },
          });
        } else if (systemMsg.subtype === "api_retry") {
          const attempt = systemMsg.attempt;
          const maxRetries = systemMsg.max_retries;
          const delayMs = systemMsg.retry_delay_ms;
          const attemptPart =
            typeof attempt === "number" && typeof maxRetries === "number"
              ? ` (${attempt}/${maxRetries})`
              : "";
          const delayPart =
            typeof delayMs === "number" ? ` — retrying in ${Math.round(delayMs / 1000)}s` : "";
          const statusPart =
            systemMsg.error_status != null ? ` [HTTP ${systemMsg.error_status}]` : "";
          events.push({
            type: "log",
            message: `[api] Request failed${statusPart}${attemptPart}${delayPart}`,
            level: "warn",
            ts,
            metadata: {
              source: "api_retry",
              attempt,
              maxRetries,
              retryDelayMs: delayMs,
              errorStatus: systemMsg.error_status,
            },
          });
        }
        break;
      }

      case "rate_limit_event": {
        const rl = (msg as SDKRateLimitEvent).rate_limit_info;
        if (rl) {
          const util =
            typeof rl.utilization === "number" ? ` (${Math.round(rl.utilization * 100)}% used)` : "";
          const resets =
            typeof rl.resetsAt === "number"
              ? ` — resets ${new Date(rl.resetsAt * 1000).toLocaleTimeString()}`
              : "";
          const scope = rl.rateLimitType ? ` [${rl.rateLimitType}]` : "";
          // Only surface warnings/rejections; "allowed" is the silent happy path.
          if (rl.status !== "allowed") {
            events.push({
              type: "log",
              message: `[rate-limit] ${rl.status === "rejected" ? "Rate limit reached" : "Approaching rate limit"}${scope}${util}${resets}`,
              level: rl.status === "rejected" ? "error" : "warn",
              ts,
              metadata: { source: "rate_limit_event", ...rl },
            });
          }
        }
        break;
      }

      case "result": {
        const resultMsg = msg as SDKResultMessage;

        if (
          resultMsg.subtype === "success" &&
          resultMsg.result &&
          !cs.state.hasAssistantContent
        ) {
          events.push({
            type: "artifact",
            kind: "report",
            content: resultMsg.result,
            metadata: { source: "result.message" },
          });
        }

        if (resultMsg.stop_reason && resultMsg.stop_reason !== "end_turn") {
          events.push({
            type: "log",
            message: `[stop_reason] ${resultMsg.stop_reason}`,
            level: resultMsg.stop_reason === "refusal" ? "error" : "info",
            ts,
          });
        }

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
          const bufferKey = `${cs.runId}-${blockIndex}`;

          if (event.delta.type === "text_delta" && event.delta.text) {
            const next = (cs.partialTextBuffers.get(bufferKey) ?? "") + event.delta.text;
            cs.partialTextBuffers.set(bufferKey, next);
            events.push({
              type: "artifact",
              kind: "report",
              content: next,
              metadata: { source: "agent_message_streaming" },
              ephemeral: true,
              streamId: `claude-msg-${cs.runId}-${blockIndex}`,
            });
          } else if (event.delta.type === "thinking_delta" && event.delta.thinking) {
            const next = (cs.partialThinkingBuffers.get(bufferKey) ?? "") + event.delta.thinking;
            cs.partialThinkingBuffers.set(bufferKey, next);
            events.push({
              type: "artifact",
              kind: "report",
              content: next,
              metadata: { source: "agent_thinking_streaming" },
              ephemeral: true,
              streamId: `claude-think-${cs.runId}-${blockIndex}`,
            });
          }
        } else if (event.type === "content_block_stop" && blockIndex >= 0) {
          const key = `${cs.runId}-${blockIndex}`;
          // Thinking lane has no DB-persisted counterpart, so the content-match filter
          // in the renderer won't auto-clear it. Push an empty update.
          if (cs.partialThinkingBuffers.has(key)) {
            events.push({
              type: "artifact",
              kind: "report",
              content: "",
              metadata: { source: "agent_thinking_streaming" },
              ephemeral: true,
              streamId: `claude-think-${cs.runId}-${blockIndex}`,
            });
          }
          cs.partialTextBuffers.delete(key);
          cs.partialThinkingBuffers.delete(key);
        } else if (event.type === "message_stop") {
          for (const key of cs.partialTextBuffers.keys()) {
            if (key.startsWith(`${cs.runId}-`)) cs.partialTextBuffers.delete(key);
          }
          for (const key of cs.partialThinkingBuffers.keys()) {
            if (key.startsWith(`${cs.runId}-`)) cs.partialThinkingBuffers.delete(key);
          }
        }
        break;
      }

      default: {
        // Tool result-style messages (tool_use_id correlation)
        const anyMsg = msg as any;
        if (anyMsg.tool_use_id || anyMsg.type === "tool_result") {
          const toolUseId = anyMsg.tool_use_id || "";
          const prev = toolUseId ? cs.toolCallIndex.get(toolUseId) : undefined;

          const toolName = prev?.toolName || "unknown";
          const input = prev?.input;
          const output = anyMsg.content || anyMsg.result;
          const error = anyMsg.is_error ? String(output) : undefined;

          if (toolUseId) cs.toolCallIndex.delete(toolUseId);

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

          if (toolName === "Task") {
            const taskInput = input as Record<string, unknown> | undefined;
            const subagentType =
              (taskInput?.subagent_type as string) || "general-purpose";

            let agentId: string | undefined;
            if (typeof output === "string") {
              const agentIdMatch = output.match(/agentId:\s*([a-f0-9-]+)/i);
              if (agentIdMatch) agentId = agentIdMatch[1];
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
              metadata: { toolCallId: toolUseId || undefined },
            });
          }
        } else {
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

  // ─────────────────────────────────────────────────────────────
  // Prompt building
  // ─────────────────────────────────────────────────────────────

  /** User-pinned skill names ($) — filesystem metadata is enough; prompt only echoes names for transparency. */
  function prependPinnedSkillsToPrompt(
    prompt: string,
    skills: WorkRunRequest["skills"],
  ): string {
    if (!skills?.length) return prompt;
    const tokens = skills.map((s) => `${s.name}`).join(" ");
    return `${tokens}\n\n${prompt}`;
  }

  function buildStartPrompt(request: WorkRunRequest): string {
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

  function buildContinuePrompt(request: WorkRunContinueRequest): string {
    let prompt = request.message;
    if (request.context && request.context.length > 0) {
      const contextParts = formatContextSection(request.context);
      prompt = `Context:\n${contextParts}\n\n---\n\n${request.message}`;
    }
    prompt = appendPromptSections(prompt, {
      contextIssues: request.contextIssues,
      contextSignals: request.contextSignals,
      contextFiles: request.contextFiles,
      attachments: request.attachments,
      runId: request.runId,
      includeIssueBody: false,
    });
    return prependPinnedSkillsToPrompt(prompt, request.skills);
  }

  function buildForkPrompt(request: WorkRunForkRequest): string {
    let prompt = request.message;
    if (request.context && request.context.length > 0) {
      const contextParts = formatContextSection(request.context);
      prompt = `Context:\n${contextParts}\n\n---\n\n${request.message}`;
    }
    return appendPromptSections(prompt, {
      attachments: request.attachments,
      runId: request.runId,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Disk skills discovery (shared between listSkills and listCommands filtering)
  // ─────────────────────────────────────────────────────────────

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
        const userSkillsDir = path.join(os.homedir(), ".claude", "skills");
        const userSkills = await discoverSkillsFromDirectory(userSkillsDir, "user");
        skills.push(...userSkills);
      }

      if (settingSources.includes("project") && workspacePath) {
        const projectSkillsDir = path.join(workspacePath, ".claude", "skills");
        const projectSkills = await discoverSkillsFromDirectory(projectSkillsDir, "project");
        skills.push(...projectSkills);
      }

      skillsCache.set(cacheKey, { skills, timestamp: now });
      return skills;
    } catch (error) {
      logError("Failed to discover skills:", error);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Acquisition helpers
  // ─────────────────────────────────────────────────────────────

  function newSession(runId: string, options: SDKOptions, abortController: AbortController): ClaudeSession {
    return {
      runId,
      options,
      abortController,
      state: { hasAssistantContent: false },
      toolCallIndex: new Map(),
      partialTextBuffers: new Map(),
      partialThinkingBuffers: new Map(),
    };
  }

  async function lookupSessionId(runId: string): Promise<string | undefined> {
    const memo = sessionIdMemo.get(runId);
    if (memo) return memo;
    try {
      const run = await runsRepo.findRunById(runId);
      if (run?.sessionId) {
        sessionIdMemo.set(runId, run.sessionId);
        return run.sessionId;
      }
    } catch {
      /* ignore */
    }
    return undefined;
  }

  // ─────────────────────────────────────────────────────────────
  // CLI helpers (version + self-update via the Claude Code CLI)
  // ─────────────────────────────────────────────────────────────

  function resolveClaudeBinary(): string | null {
    if (config.binary) {
      const resolved = resolveCandidate(config.binary);
      if (resolved) return resolved;
    }
    return findClaudeBinary();
  }

  /** Run a one-shot `claude <args>` CLI command. */
  function runClaudeCli(
    args: string[],
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const binaryPath = resolveClaudeBinary();
    if (!binaryPath) {
      return Promise.resolve({ stdout: "", stderr: "Claude CLI not found", code: null });
    }
    return new Promise((resolve) => {
      const child = spawn(binaryPath, args, {
        env: { ...process.env, HOME: os.homedir() },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: timeoutMs,
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
      child.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
      child.on("close", (code) => resolve({ stdout, stderr, code }));
      child.on("error", (err) =>
        resolve({ stdout, stderr: String(err instanceof Error ? err.message : err), code: null }),
      );
    });
  }

  /** Read the installed Claude Code version (e.g. "2.1.159" from "2.1.159 (Claude Code)"). */
  async function getClaudeVersion(): Promise<string | null> {
    try {
      const { stdout } = await runClaudeCli(["--version"], 8000);
      const match = stdout.trim().match(/(\d+\.\d+\.\d+[^\s]*)/);
      return match ? match[1] : stdout.trim() || null;
    } catch {
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ProviderDriver implementation
  // ─────────────────────────────────────────────────────────────

  return {
    async createSession(request: WorkRunRequest): Promise<AcquiredSession> {
      await ensureSDK();
      if (!queryFn) throw new Error("Claude SDK not properly initialized");

      const abortController = new AbortController();
      const options = await buildOptions({
        model: getModel(request.model),
        workspacePath: request.workspace.rootPath,
        abortController,
        runHooks: request.hooks,
        runAgents: request.agents,
        runId: request.runId,
        workspaceId: request.workspace.id,
      });

      // Per-run permission-mode override (e.g. Pulse forces a specific mode)
      const overridePermissionMode = (request.configSnapshot as Record<string, unknown> | null | undefined)
        ?.permissionMode;
      if (typeof overridePermissionMode === "string") {
        (options as { permissionMode?: string }).permissionMode = overridePermissionMode;
      }

      const session = newSession(request.runId, options, abortController);
      return { session, prompt: buildStartPrompt(request) };
    },

    async resumeSession(request: WorkRunContinueRequest): Promise<AcquiredSession> {
      await ensureSDK();
      if (!queryFn) throw new Error("Claude SDK not properly initialized");

      const sessionId = await lookupSessionId(request.runId);
      if (!sessionId) {
        throw new Error(
          `Session not found for run ${request.runId}. The session may have expired or was never created.`,
        );
      }

      const abortController = new AbortController();
      const options = await buildOptions({
        model: getModel(request.model ?? config.defaultModel),
        workspacePath: request.workspace.rootPath,
        abortController,
        resumeSessionId: sessionId,
        runHooks: request.hooks,
        runAgents: request.agents,
        runId: request.runId,
        workspaceId: request.workspace.id,
      });

      const session = newSession(request.runId, options, abortController);
      // Prime sessionId so executePrompt's "first session_id" persistence is a no-op for resume;
      // the SDK keeps the same id when resuming.
      session.state.sessionId = sessionId;
      return { session, prompt: buildContinuePrompt(request) };
    },

    async forkSession(request: WorkRunForkRequest): Promise<AcquiredSession> {
      await ensureSDK();
      if (!queryFn) throw new Error("Claude SDK not properly initialized");

      const sourceSessionId = await lookupSessionId(request.sourceRunId);
      if (!sourceSessionId) {
        throw new Error(
          `Session not found for source run ${request.sourceRunId}. Cannot fork.`,
        );
      }

      const abortController = new AbortController();
      const options = await buildOptions({
        model: getModel(request.model ?? config.defaultModel),
        workspacePath: request.workspace.rootPath,
        abortController,
        resumeSessionId: sourceSessionId,
        runHooks: request.hooks,
        runAgents: request.agents,
        runId: request.runId,
        workspaceId: request.workspace.id,
        forkSession: true,
      });

      const session = newSession(request.runId, options, abortController);
      // Don't prime sessionId — fork creates a NEW session id which will arrive in the stream.
      return { session, prompt: buildForkPrompt(request) };
    },

    async executePrompt(
      sessionParam,
      prompt,
      onEvent,
      signal,
    ): Promise<DriverOutcome> {
      const cs = sessionParam as ClaudeSession;
      const timeout = config.timeout ?? 3_600_000;
      if (!queryFn) throw new Error("Claude SDK not properly initialized");

      // Wire the incoming AbortSignal to fire BOTH the SDK's AbortController and query.interrupt().
      const onAbort = () => {
        try {
          cs.abortController.abort();
        } catch (err) {
          logError("Error aborting controller:", err);
        }
        if (cs.query?.interrupt) {
          cs.query.interrupt().catch(() => {
            /* shutdown interrupt is best-effort */
          });
        }
      };
      signal.addEventListener("abort", onAbort, { once: true });

      // Create the SDK query (this is when the prompt is bound to the session).
      const query = queryFn({ prompt, options: cs.options });
      cs.query = query;

      let timeoutId: NodeJS.Timeout | undefined;
      let timedOut = false;
      const timeoutPromise = new Promise<void>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          cs.abortController.abort();
          reject(new Error(`Request timed out after ${timeout}ms`));
        }, timeout);
      });

      try {
        // Single-request context snapshot for the context meter. result.modelUsage
        // is *cumulative* across every API round-trip in the turn, so cache-read
        // tokens balloon with each tool call and the meter pins to 100%. The latest
        // top-level assistant message instead reflects one request — its
        // prompt+response size ≈ what currently occupies the window (matches `/context`).
        let lastReqContextTokens = 0;
        const streamPromise = (async () => {
          for await (const msg of query) {
            if (signal.aborted || timedOut) break;

            // Track whether any assistant text content has been streamed (for result-message dedup).
            if (msg.type === "assistant") {
              const aMsg = msg as SDKAssistantMessage;
              if (aMsg.message?.content?.some((b: any) => b.type === "text" && b.text)) {
                cs.state.hasAssistantContent = true;
              }
              // Skip subagent (e.g. haiku) messages so they don't clobber the
              // main conversation's snapshot. The Anthropic message carries a
              // per-request `usage` at runtime even though our local type omits it.
              const u = (aMsg.message as any)?.usage as
                | { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
                | undefined;
              if (u && !aMsg.parent_tool_use_id) {
                const snapshot =
                  (u.input_tokens ?? 0) +
                  (u.cache_read_input_tokens ?? 0) +
                  (u.cache_creation_input_tokens ?? 0) +
                  (u.output_tokens ?? 0);
                if (snapshot > 0) lastReqContextTokens = snapshot;
              }
            }

            // Capture session ID (Claude's id arrives in the stream) and persist on first sight.
            if (msg.session_id && !cs.state.sessionId) {
              cs.state.sessionId = msg.session_id;
              sessionIdMemo.set(cs.runId, msg.session_id);
              runsRepo
                .updateRun(cs.runId, { sessionId: msg.session_id })
                .catch((err) => logError("Failed to persist session ID:", err));
            }

            // Capture stop reason + usage from result messages.
            if (msg.type === "result") {
              const resultMsg = msg as SDKResultMessage;
              if (resultMsg.stop_reason !== undefined) {
                cs.state.lastStopReason = resultMsg.stop_reason;
              }

              let inputTokens = 0,
                outputTokens = 0,
                cacheRead = 0,
                cacheWrite = 0;
              let primaryModel: string | undefined;
              // Context meter: track the model entry with the largest window (the
              // main conversation model, not haiku subagents) to estimate fill.
              let ctxModel: string | undefined;
              let ctxWindow = 0;
              // Cumulative fallback for the largest-window model, used only when
              // the per-request snapshot above is unavailable (older SDK builds
              // may not surface `message.usage` on assistant messages). It runs
              // hot (cache-read balloons across tool calls), so it's a worse
              // estimate than the snapshot — hence fallback-only.
              let ctxFallbackTokens = 0;
              if (resultMsg.modelUsage) {
                for (const [modelName, usage] of Object.entries(resultMsg.modelUsage)) {
                  inputTokens += usage.inputTokens;
                  outputTokens += usage.outputTokens;
                  cacheRead += usage.cacheReadInputTokens;
                  cacheWrite += usage.cacheCreationInputTokens;
                  if (!primaryModel) primaryModel = modelName;
                  // Pick the entry with the largest window as the main
                  // conversation model (not haiku subagents). Occupancy comes
                  // from the per-request snapshot above, not this cumulative sum.
                  const window = usage.contextWindow ?? 0;
                  if (window > ctxWindow) {
                    ctxWindow = window;
                    ctxModel = modelName;
                    ctxFallbackTokens =
                      (usage.inputTokens ?? 0) +
                      (usage.cacheReadInputTokens ?? 0) +
                      (usage.cacheCreationInputTokens ?? 0) +
                      (usage.outputTokens ?? 0);
                  }
                }
              }

              cs.state.lastUsage = {
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

              // Derive the context-window snapshot from usage data rather than the
              // SDK's getContextUsage() control request — the latter races the
              // query teardown in single-prompt mode ("Query closed before response").
              const ctxTokens = lastReqContextTokens || ctxFallbackTokens;
              if (ctxWindow > 0 && ctxTokens > 0) {
                const total = Math.min(ctxTokens, ctxWindow);
                await onEvent({
                  type: "context_usage",
                  totalTokens: total,
                  maxTokens: ctxWindow,
                  percentage: (total / ctxWindow) * 100,
                  model: ctxModel ?? primaryModel,
                  ts: Date.now(),
                });
              }
            }

            const events = mapSDKMessage(msg, cs);
            for (const event of events) {
              await onEvent(event);

              if (
                event.type === "tool_call" &&
                event.metadata?.phase === "complete" &&
                event.output
              ) {
                for (const artEvent of extractArtifactsFromToolOutput(event.toolName, event.output)) {
                  await onEvent(artEvent);
                }
              }
            }
          }
        })();

        await Promise.race([streamPromise, timeoutPromise]);

        return classifyOutcome({
          stopReason: cs.state.lastStopReason ?? null,
          usage: cs.state.lastUsage,
          aborted: signal.aborted,
          timedOut: false,
          errorMessage: undefined,
          timeoutMs: timeout,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Emit interrupted events for any pending tool calls
        const ts = Date.now();
        for (const [toolCallId, toolInfo] of cs.toolCallIndex) {
          await onEvent({
            type: "tool_call",
            toolName: toolInfo.toolName,
            input: toolInfo.input as Record<string, unknown> | undefined,
            error: "Interrupted",
            endedAt: ts,
            metadata: { phase: "complete", toolCallId, interrupted: true },
          });
        }
        cs.toolCallIndex.clear();

        return classifyOutcome({
          stopReason: cs.state.lastStopReason ?? null,
          usage: cs.state.lastUsage,
          aborted: signal.aborted || cs.abortController.signal.aborted,
          timedOut,
          errorMessage,
          timeoutMs: timeout,
        });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        signal.removeEventListener("abort", onAbort);
      }
    },

    async cleanup(_session): Promise<void> {
      // Per-run state lives on the Session object Core is about to drop.
      // The SDK query auto-completes when the stream ends; nothing to release here.
    },

    async canResumeSession(runId: string): Promise<boolean> {
      const sessionId = await lookupSessionId(runId);
      if (!sessionId) return false;
      try {
        await ensureSDK();
        return queryFn !== null;
      } catch {
        return false;
      }
    },

    async deleteSession(runId: string): Promise<void> {
      sessionIdMemo.delete(runId);
      runsRepo
        .updateRun(runId, { sessionId: null })
        .catch((err) => logError("Failed to clear session ID in DB:", err));
    },

    async shutdown(): Promise<void> {
      sessionIdMemo.clear();
      sdkLoaded = false;
      loadError = null;
      queryFn = null;
      cachedModels = null;
      cachedModelsTimestamp = 0;
      commandsCache.clear();
      skillsCache.clear();
      logInfo("Shutdown complete");
    },

    async listModels(): Promise<ModelInfo[]> {
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

        let binaryPath: string | null = null;
        if (config.binary) {
          const resolved = resolveCandidate(config.binary);
          if (resolved) binaryPath = resolved;
        }
        if (!binaryPath) binaryPath = findClaudeBinary();
        if (!binaryPath) {
          logWarn("CLI not found, returning fallback models");
          return getDefaultModels(config.defaultModel);
        }

        const tempQuery = queryFn({
          prompt: "",
          options: { pathToClaudeCodeExecutable: binaryPath },
        });

        const sdkModels = await tempQuery.supportedModels();
        if (!sdkModels || sdkModels.length === 0) {
          logWarn("SDK returned no models, using fallback");
          return getDefaultModels(config.defaultModel);
        }

        const models: ModelInfo[] = sdkModels.map((sdkModel, index) => {
          // SDK's .d.ts declares supportsFastMode but the runtime payload doesn't include it.
          // Fast mode is currently meaningful only on opus; this fallback lights it up
          // automatically when the SDK starts surfacing the field.
          const id = sdkModel.value;
          const fallbackFastMode = id === "opus[1m]";
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
              reasoning: sdkModel.value.includes("opus"),
            },
            contextWindow: sdkModel.value.includes("haiku") ? 128000 : 200000,
            supportsFastMode: sdkModel.supportsFastMode ?? fallbackFastMode,
            supportsEffort: sdkModel.supportsEffort,
            supportedEffortLevels: sdkModel.supportedEffortLevels,
          };
        });

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
        if (!queryFn) return [];

        let binaryPath: string | null = null;
        if (config.binary) {
          const resolved = resolveCandidate(config.binary);
          if (resolved) binaryPath = resolved;
        }
        if (!binaryPath) binaryPath = findClaudeBinary();
        if (!binaryPath) return [];

        const tempQuery = queryFn({
          prompt: "",
          options: { pathToClaudeCodeExecutable: binaryPath },
        });

        const initResult = await tempQuery.initializationResult();
        if (!initResult?.commands || initResult.commands.length === 0) {
          return [];
        }

        // initializationResult().commands mixes built-in /commands with disk-backed skills.
        // Exclude only skills we discover the same way as the $ menu.
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

    async listSkills(workspacePath?: string): Promise<SkillInfo[]> {
      return fetchDiskSkills(workspacePath);
    },

    async getAccountInfo(): Promise<AccountInfo> {
      const cli = { version: await getClaudeVersion(), channel: null, outdated: false };

      // Read the logged-in account via a lightweight control query (same pattern
      // as listModels — prompt:"" never sends a turn). Falls back to no account.
      let account: AccountInfo["account"] = null;
      try {
        await ensureSDK();
        const binaryPath = resolveClaudeBinary();
        if (queryFn && binaryPath) {
          const tempQuery = queryFn({
            prompt: "",
            options: { pathToClaudeCodeExecutable: binaryPath },
          });
          try {
            const info = await tempQuery.accountInfo();
            if (info?.email) {
              account = {
                type: "claude",
                email: info.email,
                planType: info.subscriptionType ?? info.organization ?? "",
              };
            } else if (info?.apiKeySource || info?.tokenSource) {
              account = { type: "apiKey" };
            }
          } finally {
            await tempQuery.interrupt().catch(() => {});
          }
        }
      } catch (error) {
        logWarn(
          `getAccountInfo: account read failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return { account, requiresOpenaiAuth: false, cli };
    },

    async updateCli(): Promise<CliUpdateResult> {
      const { stdout, stderr, code } = await runClaudeCli(["update"], 120000);
      return { success: code === 0, output: `${stdout}${stderr}`.trim() };
    },

    async generateTitle(goal: string, context?: WorkRunContextItem[]): Promise<string> {
      await ensureSDK();
      if (!queryFn) throw new Error("Claude SDK not properly initialized");

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

      const titlePrompt = [
        "Generate a concise title (2-5 words) that summarizes what the user wants.",
        "Rules:",
        "- Reply with ONLY the title text, nothing else",
        '- Use title case: capitalize the first letter of each word (e.g. "Fix Login Redirect", "Add Dark Mode", "Greeting Message")',
        '- Do NOT use generic descriptions of the request type (e.g. NOT "Greeting Title Generation")',
        '- Instead, describe the actual topic or intent (e.g. "Hello Greeting" for a hello message)',
        "- No quotes, no punctuation at the end, no prefixes",
        "",
        `User message: ${goal}`,
        contextSnippet ? `\nContext:\n${contextSnippet}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const options = await buildOptions({
        model: "claude-haiku-4-5-20251001",
      });
      options.maxTurns = 1;
      options.allowedTools = [];
      options.disallowedTools = ["*"];
      options.systemPrompt =
        "You generate short titles. Output ONLY the title (2-5 words, title case). Describe the topic, not the action of generating a title.";

      const query = queryFn({ prompt: titlePrompt, options });

      let titleText = "";
      for await (const msg of query) {
        if (msg.type === "assistant") {
          const assistantMsg = msg as { message?: { content?: Array<{ type: string; text?: string }> } };
          if (assistantMsg.message?.content) {
            for (const block of assistantMsg.message.content) {
              if (block.type === "text" && block.text) titleText += block.text;
            }
          }
        }
      }

      const title = titleText
        .trim()
        .split("\n")[0]
        .trim()
        .replace(/^(title:\s*)/i, "")
        .replace(/^["'`]|["'`]$/g, "")
        .replace(/[.!?]$/, "")
        .trim();

      if (!title) throw new Error("Empty title generated");
      return title.slice(0, 50);
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Module-level helpers (no closure dependencies)
// ─────────────────────────────────────────────────────────────

async function discoverSkillsFromDirectory(
  skillsDir: string,
  source: "user" | "project",
): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];
  try {
    if (!fs.existsSync(skillsDir)) return skills;

    const stat = fs.statSync(skillsDir);
    if (!stat.isDirectory()) return skills;

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(skillsDir, entry.name);
      const skillMdPath = path.join(skillDir, "SKILL.md");
      if (!fs.existsSync(skillMdPath)) continue;

      try {
        const skill = parseSkillFile(skillMdPath, entry.name, source);
        if (skill) skills.push(skill);
      } catch (err) {
        console.warn(`[ClaudeDriver] Failed to parse skill ${entry.name}:`, err);
      }
    }
  } catch (err) {
    console.warn(`[ClaudeDriver] Failed to read skills directory ${skillsDir}:`, err);
  }
  return skills;
}

function parseSkillFile(
  filePath: string,
  dirName: string,
  source: "user" | "project",
): SkillInfo | null {
  const content = fs.readFileSync(filePath, "utf-8");

  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
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

  if (!skill.description) {
    const bodyContent = content.slice(frontmatterMatch[0].length).trim();
    const firstParagraph = bodyContent.split("\n\n")[0]?.trim();
    if (firstParagraph && !firstParagraph.startsWith("#")) {
      skill.description = firstParagraph.substring(0, 200);
    }
  }

  return skill;
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value: unknown = trimmed.slice(colonIndex + 1).trim();

    if (
      ((value as string).startsWith('"') && (value as string).endsWith('"')) ||
      ((value as string).startsWith("'") && (value as string).endsWith("'"))
    ) {
      value = (value as string).slice(1, -1);
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    } else if (value === "") {
      value = undefined;
    }

    result[key] = value;
  }

  return result;
}

function readMcpServersFromSettings(
  settingSources: Array<"user" | "project" | "local">,
  workspacePath?: string,
): Record<string, McpServerConfig> {
  const mergedServers: Record<string, McpServerConfig> = {};

  if (settingSources.includes("user")) {
    const userSettingsPath = path.join(os.homedir(), ".claude", "settings.json");
    const userServers = readMcpServersFromFile(userSettingsPath);
    if (userServers) Object.assign(mergedServers, userServers);

    const claudeJsonPath = path.join(os.homedir(), ".claude.json");
    const claudeJsonServers = readMcpServersFromFile(claudeJsonPath);
    if (claudeJsonServers) Object.assign(mergedServers, claudeJsonServers);
  }

  if (settingSources.includes("project") && workspacePath) {
    const projectSettingsPath = path.join(workspacePath, ".claude", "settings.json");
    const projectServers = readMcpServersFromFile(projectSettingsPath);
    if (projectServers) Object.assign(mergedServers, projectServers);

    const mcpJsonPath = path.join(workspacePath, ".mcp.json");
    const mcpJsonServers = readMcpServersFromFile(mcpJsonPath);
    if (mcpJsonServers) Object.assign(mergedServers, mcpJsonServers);
  }

  if (settingSources.includes("local") && workspacePath) {
    const localSettingsPath = path.join(workspacePath, ".claude", "settings.local.json");
    const localServers = readMcpServersFromFile(localSettingsPath);
    if (localServers) Object.assign(mergedServers, localServers);
  }

  return mergedServers;
}

function readMcpServersFromFile(
  filePath: string,
): Record<string, McpServerConfig> | null {
  try {
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, "utf-8");
    const settings = JSON.parse(content);
    const servers = settings.mcpServers || settings;

    if (!servers || typeof servers !== "object") return null;

    const validServers: Record<string, McpServerConfig> = {};
    for (const [name, cfg] of Object.entries(servers)) {
      if (isValidMcpServerConfig(cfg)) {
        validServers[name] = cfg as McpServerConfig;
      }
    }

    return Object.keys(validServers).length > 0 ? validServers : null;
  } catch (err) {
    console.warn(`[ClaudeDriver] Failed to read MCP servers from ${filePath}:`, err);
    return null;
  }
}

function isValidMcpServerConfig(cfg: unknown): boolean {
  if (!cfg || typeof cfg !== "object") return false;
  const c = cfg as Record<string, unknown>;
  if (c.type === undefined || c.type === "stdio") {
    return typeof c.command === "string" && c.command.length > 0;
  }
  if (c.type === "http" || c.type === "sse") {
    return typeof c.url === "string" && c.url.length > 0;
  }
  return false;
}

function getDefaultModels(defaultModel?: string): ModelInfo[] {
  return [
    {
      id: "sonnet",
      displayName: "Claude Sonnet 4.6",
      isDefault: defaultModel === "sonnet" || !defaultModel,
      capabilities: { streaming: true, vision: true, functionCalling: true },
      contextWindow: 200000,
      supportsFastMode: true,
      supportsEffort: true,
      supportedEffortLevels: ["low", "medium", "high"],
    },
    {
      id: "opus[1m]",
      displayName: "Claude Opus 4.8",
      isDefault: defaultModel === "opus[1m]",
      capabilities: { streaming: true, vision: true, functionCalling: true, reasoning: true },
      contextWindow: 200000,
      supportsFastMode: true,
      supportsEffort: true,
      supportedEffortLevels: ["low", "medium", "high", "max"],
    },
    {
      id: "haiku",
      displayName: "Claude Haiku 4.5",
      isDefault: defaultModel === "haiku" || !defaultModel,
      capabilities: { streaming: true, vision: true, functionCalling: true },
      contextWindow: 128000,
      supportsFastMode: false,
      supportsEffort: true,
      supportedEffortLevels: ["low", "medium", "high"],
    },
  ];
}

// ─────────────────────────────────────────────────────────────
// Pure helpers exported for testing
// ─────────────────────────────────────────────────────────────

/**
 * Translate the streaming outcome (stop reason / abort flags / error / timeout)
 * into a DriverOutcome. Pure: no SDK access, exposed for tests.
 */
export function classifyOutcome(args: {
  stopReason: string | null;
  usage?: WorkRunUsage;
  aborted: boolean;
  timedOut: boolean;
  errorMessage?: string;
  timeoutMs: number;
}): DriverOutcome {
  const { stopReason: rawStopReason, usage, aborted, timedOut, errorMessage, timeoutMs } = args;
  // DriverOutcome.stopReason is `string | undefined`; coerce null → undefined.
  const stopReason = rawStopReason ?? undefined;

  // Success path: no error, stopReason indicates normal completion (or undefined).
  if (!errorMessage && !timedOut && !aborted) {
    if (stopReason === "refusal") {
      return {
        status: "failed",
        summary: "The model declined to fulfill this request.",
        stopReason,
        usage,
      };
    }
    return {
      status: "succeeded",
      summary: "Completed successfully",
      stopReason,
      usage,
    };
  }

  // Aborted (signal fired) takes precedence over timeout — Core fired the signal.
  if (aborted && !timedOut) {
    return { status: "canceled", summary: "Run was aborted", stopReason, usage };
  }

  if (timedOut) {
    return {
      status: "failed",
      summary: `Request timed out after ${timeoutMs / 1000} seconds.`,
      stopReason,
      usage,
    };
  }

  // Generic error path
  if (errorMessage) {
    if (errorMessage.includes("timed out")) {
      return {
        status: "failed",
        summary: `Request timed out after ${timeoutMs / 1000} seconds.`,
        stopReason,
        usage,
      };
    }
    if (errorMessage.includes("aborted")) {
      return { status: "canceled", summary: "Run was aborted", stopReason, usage };
    }
    return { status: "failed", summary: errorMessage, stopReason, usage };
  }

  // Fallthrough
  return { status: "failed", summary: "Unknown error", stopReason, usage };
}
