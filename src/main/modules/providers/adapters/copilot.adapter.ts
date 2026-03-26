// ─────────────────────────────────────────────────────────────
// Copilot SDK Adapter
// Implements WorkRunAdapter using GitHub Copilot SDK
// ─────────────────────────────────────────────────────────────

import path from "node:path";
import os from "node:os";
import type {
  WorkRunAdapter,
  WorkRunRequest,
  WorkRunContinueRequest,
  WorkRunResult,
  WorkRunUsage,
  WorkRunEventHandler,
  WorkRunEvent,
  CopilotAdapterConfig,
  ModelInfo,
} from "./adapter.types";
import {
  requestToolApproval,
  cancelPendingRequests,
} from "../../runs/user-input-broker";
import type { ToolApprovalRequest } from "../../runs/runs.dto";
import {
  createLogger,
  ALLOWED_TOOLS_SET,
  safeJson,
  extractArtifactsFromToolOutput,
  formatContextSection,
  appendPromptSections,
  emitUserPromptArtifact,
} from "./adapter.shared";
import type { JinzoToolContext } from "./jinzo-tools.core";
import {
  TOOL_DESCRIPTIONS,
  handleGetWorkspaceDiff,
  handleSaveReview,
  handleSaveFinding,
  handleSaveFindings,
  handleCommitChanges,
  handleCreatePR,
} from "./jinzo-tools.core";

/**
 * NOTE: This adapter is designed for the @github/copilot-sdk package.
 * The SDK API is based on the technical preview documentation.
 * Some types and interfaces may need adjustment when the actual package is integrated.
 *
 * The implementation below uses dynamic imports and type assertions
 * to allow the code to compile without the actual SDK installed.
 */

// Types inferred from Copilot SDK (@github/copilot-sdk 0.2)
interface CopilotClientOptions {
  /** Path to the CLI executable or JavaScript entry point */
  cliPath?: string;
  /** Extra arguments to pass to the CLI executable */
  cliArgs?: string[];
  /** URL of an existing Copilot CLI server to connect to over TCP */
  cliUrl?: string;
  /** Working directory for the CLI process */
  cwd?: string;
  /** Port for the CLI server (TCP mode only) */
  port?: number;
  /** Use stdio transport instead of TCP (default: true) */
  useStdio?: boolean;
  /** SDK is running as a child process of the Copilot CLI server */
  isChildProcess?: boolean;
  /** Log level for the CLI server */
  logLevel?: "none" | "error" | "warning" | "info" | "debug" | "all";
  /** Auto-start the CLI server on first use (default: true) */
  autoStart?: boolean;
  /** @deprecated This option has no effect and will be removed */
  autoRestart?: boolean;
  /** Environment variables to pass to the CLI process */
  env?: Record<string, string | undefined>;
  /** GitHub token for authentication — takes priority over other auth methods */
  githubToken?: string;
  /** Whether to use stored OAuth tokens or gh CLI auth (default: true) */
  useLoggedInUser?: boolean;
  // TODO: expose in config UI — custom model list callback for BYOK mode
  /** Custom handler for listing available models (BYOK mode) */
  onListModels?: () => Promise<unknown[]> | unknown[];
  // TODO: expose in config UI — OpenTelemetry configuration
  /** OpenTelemetry configuration for the CLI process */
  telemetry?: {
    otlpEndpoint?: string;
    filePath?: string;
    exporterType?: string;
    sourceName?: string;
    captureContent?: boolean;
  };
  // TODO: expose in config UI — distributed tracing
  /** W3C Trace Context provider for distributed trace propagation */
  onGetTraceContext?: () => { traceparent?: string; tracestate?: string } | Promise<{ traceparent?: string; tracestate?: string }>;
}

interface CopilotTool {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  handler: (args: any, invocation: { sessionId: string; toolCallId: string; toolName: string; arguments: unknown }) => Promise<unknown> | unknown;
  /** When true, indicates this tool overrides a built-in tool of the same name */
  overridesBuiltInTool?: boolean;
  /** When true, the tool can execute without a permission prompt */
  skipPermission?: boolean;
}

type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

interface CustomAgentConfig {
  /** Unique name of the custom agent */
  name: string;
  /** Display name for UI purposes */
  displayName?: string;
  /** Description of what the agent does */
  description?: string;
  /** List of tool names the agent can use (null = all tools) */
  tools?: string[] | null;
  /** The prompt content for the agent */
  prompt: string;
  /** MCP servers specific to this agent */
  mcpServers?: Record<string, MCPServerConfig>;
  /** Whether the agent should be available for model inference (default: true) */
  infer?: boolean;
}

// TODO: load user MCP servers from config and pass to session (like Claude adapter)
interface MCPServerConfig {
  type?: "local" | "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  tools: string[];
  timeout?: number;
}

interface SessionConfig {
  sessionId?: string;
  model?: string;
  /** Reasoning effort level for models that support it */
  reasoningEffort?: ReasoningEffort;
  systemMessage?: { content: string } | { mode: "append"; content?: string } | { mode: "replace"; content: string };
  streaming?: boolean;
  cwd?: string;
  workingDirectory?: string;
  tools?: CopilotTool[];
  /** MCP server configurations — keys are server names */
  mcpServers?: Record<string, MCPServerConfig>;
  /** Custom agent configurations for the session */
  customAgents?: CustomAgentConfig[];
  /** Name of the custom agent to activate when the session starts */
  agent?: string;
  /** Directories to load skills from */
  skillDirectories?: string[];
  /** List of skill names to disable */
  disabledSkills?: string[];
  // TODO: expose in config UI — auto-compaction thresholds for long sessions
  /** Infinite session config for automatic context compaction */
  infiniteSessions?: {
    /** Whether infinite sessions are enabled (default: true) */
    enabled?: boolean;
    /** Context utilization (0.0-1.0) at which background compaction starts (default: 0.80) */
    backgroundCompactionThreshold?: number;
    /** Context utilization (0.0-1.0) at which session blocks until compaction completes (default: 0.95) */
    bufferExhaustionThreshold?: number;
  };
  // TODO: use SDK-level tool filtering instead of hook-based ALLOWED_TOOLS_SET checks
  /** Tool whitelist — only these tools will be available. Takes precedence over excludedTools. */
  availableTools?: string[];
  /** Tool blacklist — these tools are disabled. Ignored if availableTools is set. */
  excludedTools?: string[];
  onPermissionRequest: (
    request: { kind: string; toolCallId?: string; [key: string]: any },
    invocation: { sessionId: string },
  ) => Promise<{ kind: string; rules?: unknown[] }> | { kind: string; rules?: unknown[] };
  onUserInputRequest?: (
    request: { question: string; choices?: string[]; allowFreeform?: boolean },
    invocation: { sessionId: string },
  ) => Promise<{ answer: string; wasFreeform: boolean }> | { answer: string; wasFreeform: boolean };
  // TODO: wire up remaining hooks — currently only onPreToolUse is used
  hooks?: {
    onPreToolUse?: (
      input: { toolName: string; toolArgs: unknown; timestamp: number; cwd: string },
      invocation: { sessionId: string },
    ) => Promise<{ permissionDecision?: "allow" | "deny" | "ask"; permissionDecisionReason?: string; modifiedArgs?: unknown } | void> | { permissionDecision?: "allow" | "deny" | "ask"; permissionDecisionReason?: string; modifiedArgs?: unknown } | void;
    /** Called after a tool is executed — capture/modify output */
    onPostToolUse?: (
      input: { toolName: string; toolArgs: unknown; toolResult: { textResultForLlm: string; resultType: string; error?: string }; timestamp: number; cwd: string },
      invocation: { sessionId: string },
    ) => Promise<{ modifiedResult?: unknown; additionalContext?: string; suppressOutput?: boolean } | void> | void;
    /** Called when the user submits a prompt — modify prompt or add context */
    onUserPromptSubmitted?: (
      input: { prompt: string; timestamp: number; cwd: string },
      invocation: { sessionId: string },
    ) => Promise<{ modifiedPrompt?: string; additionalContext?: string } | void> | void;
    /** Called when a session starts */
    onSessionStart?: (
      input: { source: "startup" | "resume" | "new"; initialPrompt?: string; timestamp: number; cwd: string },
      invocation: { sessionId: string },
    ) => Promise<{ additionalContext?: string; modifiedConfig?: Record<string, unknown> } | void> | void;
    /** Called when a session ends — cleanup, summary */
    onSessionEnd?: (
      input: { reason: "complete" | "error" | "abort" | "timeout" | "user_exit"; finalMessage?: string; error?: string; timestamp: number; cwd: string },
      invocation: { sessionId: string },
    ) => Promise<{ sessionSummary?: string; cleanupActions?: string[] } | void> | void;
    /** Called when an error occurs — retry/skip/abort */
    onErrorOccurred?: (
      input: { error: string; errorContext: "model_call" | "tool_execution" | "system" | "user_input"; recoverable: boolean; timestamp: number; cwd: string },
      invocation: { sessionId: string },
    ) => Promise<{ errorHandling?: "retry" | "skip" | "abort"; retryCount?: number; userNotification?: string } | void> | void;
  };
}

interface SessionEvent {
  type: string;
  content?: string;
  deltaContent?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  error?: string;
  data?: unknown;
  ephemeral?: boolean;
  id?: string;
  timestamp?: string;
  [key: string]: any;
}

interface CopilotSession {
  send(options: {
    prompt: string;
    attachments?: Array<{ type: string; path: string }>;
  }): Promise<string>;
  sendAndWait(
    options: { prompt: string },
    timeout?: number,
  ): Promise<SessionEvent | undefined>;
  on(handler: (event: SessionEvent) => void): () => void;
  abort(): Promise<void>;
  destroy(): Promise<void>;
}

interface CopilotModelInfo {
  id: string;
  name?: string;
  capabilities?: {
    supports?: {
      vision?: boolean;
      reasoningEffort?: boolean;
    };
    limits?: {
      max_prompt_tokens?: number;
      max_context_window_tokens?: number;
    };
  };
  policy?: { state?: string };
  billing?: { multiplier?: number };
  supportedReasoningEfforts?: ReasoningEffort[];
  defaultReasoningEffort?: ReasoningEffort;
}

interface CopilotClientInterface {
  start(): Promise<void>;
  stop(): Promise<Error[]>;
  forceStop(): Promise<void>;
  createSession(config?: SessionConfig): Promise<CopilotSession>;
  resumeSession(sessionId: string, config: Omit<SessionConfig, 'sessionId'>): Promise<CopilotSession>;
  listSessions(): Promise<Array<{ sessionId: string }>>;
  deleteSession(sessionId: string): Promise<void>;
  ping(message?: string): Promise<{ message: string; timestamp: number }>;
  connection?: {
    sendRequest(method: string, params: Record<string, unknown>): Promise<unknown>;
  };
}

// Active run tracking for abort support
const activeRuns = new Map<
  string,
  { session: CopilotSession; aborted: boolean }
>();

// Pre-approved tools imported from adapter.shared (ALLOWED_TOOLS_SET)
// Copilot also auto-allows these additional lowercase/copilot-specific tool names
const COPILOT_EXTRA_ALLOWED = new Set([
  "bash", "read", "glob", "grep", "report_intent", "view", "permission:read",
]);

function isCopilotToolAllowed(toolName: string): boolean {
  return ALLOWED_TOOLS_SET.has(toolName) || COPILOT_EXTRA_ALLOWED.has(toolName);
}

// ─────────────────────────────────────────────────────────────
// Permission & tool approval handlers
// ─────────────────────────────────────────────────────────────

/** Always-approve handler for bypassPermissions mode */
function approveAllPermissions(): { kind: string } {
  return { kind: "approved" };
}

/** Build operation-level permission handler (shell/write/read/mcp/url/custom-tool) */
function buildPermissionHandler(runId: string) {
  return async (
    request: { kind: string; toolCallId?: string; [key: string]: any },
  ): Promise<{ kind: string; rules?: unknown[] }> => {
    if (request.kind === "read" || request.kind === "shell" || request.kind === "task" || request.kind === "ask_user" ) {
      return { kind: "approved" };
    }

    if (request.kind === "custom-tool" && typeof request.toolName === "string" && request.toolName.startsWith("mcp__jinzo__")) {
      return { kind: "approved" };
    }

    const req: ToolApprovalRequest = {
      requestId: `perm-${runId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      runId,
      toolName: `[permission:${request.kind}]`,
      toolInput: request as Record<string, unknown>,
      kind: "tool_approval",
      question: `Copilot requests "${request.kind}" permission`,
      timestamp: Date.now(),
    };

    const response = await requestToolApproval(req);
    return { kind: response.approved ? "approved" : "denied-interactively-by-user" };
  };
}

/** Build tool-level pre-use hook (toolName + toolArgs) */
function buildPreToolUseHook(runId: string) {
  return async (
    input: { toolName: string; toolArgs: unknown; timestamp: number; cwd: string },
  ): Promise<{ permissionDecision?: "allow" | "deny" | "ask"; permissionDecisionReason?: string; modifiedArgs?: unknown } | void> => {
    // Auto-allow pre-approved tools
    if (isCopilotToolAllowed(input.toolName)) {
      return { permissionDecision: "allow" };
    }

    // Auto-allow MCP tools (mcp__ prefix)
    if (input.toolName.startsWith("mcp__")) {
      return { permissionDecision: "allow" };
    }

    // Interactive approval for unknown tools
    const req: ToolApprovalRequest = {
      requestId: `tool-${runId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      runId,
      toolName: input.toolName,
      toolInput: (typeof input.toolArgs === "object" && input.toolArgs !== null
        ? input.toolArgs
        : { args: input.toolArgs }) as Record<string, unknown>,
      kind: "tool_approval",
      timestamp: Date.now(),
    };

    const response = await requestToolApproval(req);
    if (response.approved) {
      return { permissionDecision: "allow" };
    }
    return { permissionDecision: "deny", permissionDecisionReason: "User denied" };
  };
}

/** Build user-input handler (ask_user questions) */
function buildUserInputHandler(runId: string) {
  return async (
    request: { question: string; choices?: string[]; allowFreeform?: boolean },
  ): Promise<{ answer: string; wasFreeform: boolean }> => {
    const options = request.choices?.map((c) => ({ label: c }));
    const req: ToolApprovalRequest = {
      requestId: `ask-${runId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      runId,
      toolName: "AskUser",
      kind: "ask_user",
      question: request.question,
      options,
      timestamp: Date.now(),
    };

    const response = await requestToolApproval(req);
    return { answer: response.answer || "", wasFreeform: true };
  };
}

const { info: logInfo, warn: logWarn, error: logError } = createLogger("[CopilotAdapter]");

/**
 * Creates a Copilot SDK adapter instance
 */
export function createCopilotAdapter(
  config: CopilotAdapterConfig,
): WorkRunAdapter {
  let client: CopilotClientInterface | null = null;
  let clientInitPromise: Promise<void> | null = null;
  let initError: Error | null = null;
  // Track the current workspace cwd to recreate client when it changes
  let currentClientCwd: string | null = null;

  // Correlate tool events when toolName/input is missing in completion events
  const toolCallIndex = new Map<
    string,
    { toolName: string; input?: unknown; startedAt?: number }
  >();

  // Accumulate usage data from assistant.usage events per run
  const usageAccumulator = new Map<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    totalCostUsd: number;
    numTurns: number;
    model: string;
    modelUsage: Record<string, { costUSD: number; inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number }>;
  }>();

  function getOrCreateUsage(runId: string) {
    let acc = usageAccumulator.get(runId);
    if (!acc) {
      acc = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalCostUsd: 0,
        numTurns: 0,
        model: "",
        modelUsage: {},
      };
      usageAccumulator.set(runId, acc);
    }
    return acc;
  }

  function accumulateUsage(runId: string, payload: Record<string, unknown>) {
    const acc = getOrCreateUsage(runId);
    const input = typeof payload.inputTokens === "number" ? payload.inputTokens : 0;
    const output = typeof payload.outputTokens === "number" ? payload.outputTokens : 0;
    const cacheRead = typeof payload.cacheReadTokens === "number" ? payload.cacheReadTokens : 0;

    // SDK reports cacheWriteTokens: 0 at top level — get real value from tokenDetails
    let cacheWrite = typeof payload.cacheWriteTokens === "number" ? payload.cacheWriteTokens : 0;
    const copilotUsage = payload.copilotUsage as Record<string, unknown> | undefined;
    if (copilotUsage && Array.isArray(copilotUsage.tokenDetails)) {
      const writeDetail = (copilotUsage.tokenDetails as any[]).find(
        (d) => d.tokenType === "cache_write",
      );
      if (writeDetail && typeof writeDetail.tokenCount === "number") {
        cacheWrite = writeDetail.tokenCount;
      }
    }

    acc.inputTokens += input;
    acc.outputTokens += output;
    acc.cacheReadTokens += cacheRead;
    acc.cacheWriteTokens += cacheWrite;
    // Cost calculation for Copilot is not yet implemented — skipped intentionally
    //TODO: Implement cost calculation for Copilot later

    // Track model — normalize Copilot names (e.g. "claude-opus-4.6" → "claude-opus-4-6")
    const rawModel = typeof payload.model === "string" ? payload.model : "";
    const model = rawModel.replace(/(\d+)\.(\d+)/g, "$1-$2");
    if (model) {
      acc.model = model;
      if (!acc.modelUsage[model]) {
        acc.modelUsage[model] = { costUSD: 0, inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };
      }
      acc.modelUsage[model].inputTokens += input;
      acc.modelUsage[model].outputTokens += output;
      acc.modelUsage[model].cacheReadInputTokens += cacheRead;
      acc.modelUsage[model].cacheCreationInputTokens += cacheWrite;
    }
  }

  function flushUsage(runId: string): WorkRunUsage | undefined {
    const acc = usageAccumulator.get(runId);
    usageAccumulator.delete(runId);
    if (!acc || (acc.inputTokens === 0 && acc.outputTokens === 0)) {
      return undefined;
    }
    return {
      totalCostUsd: undefined,
      inputTokens: acc.inputTokens,
      outputTokens: acc.outputTokens,
      cacheReadTokens: acc.cacheReadTokens,
      cacheWriteTokens: acc.cacheWriteTokens,
      numTurns: acc.numTurns,
      model: acc.model || undefined,
      modelUsage: Object.keys(acc.modelUsage).length > 0 ? acc.modelUsage : undefined,
    };
  }

  /**
   * Build Jinzo custom tools for Copilot SDK sessions.
   * Handlers are shared from jinzo-tools.core.ts — only the Copilot wrapper lives here.
   */
  function buildJinzoTools(workspaceId: string | null, rootPath: string | null = null, runId: string | null = null): CopilotTool[] {
    const ctx: JinzoToolContext = { workspaceId, rootPath, runId };

    // Copilot tool handlers return plain strings, so we unwrap the MCP-style response
    const unwrap = async (result: { content: Array<{ text: string }>; isError?: boolean }) => {
      const text = result.content[0]?.text ?? "";
      return result.isError ? text : text;
    };

    return [
      {
        name: "mcp__jinzo__GetWorkspaceDiff",
        description: TOOL_DESCRIPTIONS.GetWorkspaceDiff,
        parameters: {
          type: "object",
          properties: {
            runId: { type: "string", description: "Run ID to get diff for a specific run" },
          },
        },
        handler: async (args: { runId?: string }) => unwrap(await handleGetWorkspaceDiff(args, ctx)),
      },
      {
        name: "mcp__jinzo__SaveReview",
        description: TOOL_DESCRIPTIONS.SaveReview,
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Review title" },
            summary: { type: "string", description: "Review summary" },
            status: { type: "string", enum: ["open", "in_review", "approved", "rejected"], description: "Review status" },
            metadata: { type: "object", description: "Additional metadata as JSON" },
          },
          required: ["title"],
        },
        handler: async (args: { title: string; summary?: string; status?: string; metadata?: Record<string, unknown> }) =>
          unwrap(await handleSaveReview(args, ctx)),
      },
      {
        name: "mcp__jinzo__SaveFinding",
        description: TOOL_DESCRIPTIONS.SaveFinding,
        parameters: {
          type: "object",
          properties: {
            reviewId: { type: "string", description: "ID of the parent review" },
            severity: { type: "string", enum: ["critical", "warning", "info"], description: "Finding severity level" },
            file: { type: "string", description: "File path where the finding was detected" },
            lineStart: { type: "number", description: "Start line number" },
            lineEnd: { type: "number", description: "End line number" },
            message: { type: "string", description: "Description of the finding" },
            reason: { type: "string", description: "Why this was flagged (e.g. bug, security, claude_md_violation)" },
            suggestion: { type: "string", description: "Suggested fix" },
            metadata: { type: "object", description: "Additional metadata as JSON" },
          },
          required: ["reviewId", "severity", "file", "message", "reason"],
        },
        handler: async (args: {
          reviewId: string; severity: string; file: string;
          lineStart?: number; lineEnd?: number; message: string;
          reason: string; suggestion?: string; metadata?: Record<string, unknown>;
        }) => unwrap(await handleSaveFinding(args, ctx)),
      },
      {
        name: "mcp__jinzo__SaveFindings",
        description: TOOL_DESCRIPTIONS.SaveFindings,
        parameters: {
          type: "object",
          properties: {
            reviewId: { type: "string", description: "ID of the parent review" },
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  severity: { type: "string", enum: ["critical", "warning", "info"] },
                  file: { type: "string" },
                  lineStart: { type: "number" },
                  lineEnd: { type: "number" },
                  message: { type: "string" },
                  reason: { type: "string" },
                  suggestion: { type: "string" },
                  metadata: { type: "object" },
                },
                required: ["severity", "file", "message", "reason"],
              },
              description: "Array of findings to save",
            },
          },
          required: ["reviewId", "findings"],
        },
        handler: async (args: {
          reviewId: string;
          findings: Array<{
            severity: string; file: string; lineStart?: number; lineEnd?: number;
            message: string; reason: string; suggestion?: string; metadata?: Record<string, unknown>;
          }>;
        }) => unwrap(await handleSaveFindings(args, ctx)),
      },
      {
        name: "mcp__jinzo__CommitChanges",
        description: TOOL_DESCRIPTIONS.CommitChanges,
        parameters: {
          type: "object",
          properties: {
            message: { type: "string", description: "The commit message. Omit on first call to retrieve commitInstructions if configured." },
            files: {
              type: "array",
              items: { type: "string" },
              description: "Specific files to stage. If omitted, stages all changes (git add -A)",
            },
          },
        },
        handler: async (args: { message?: string; files?: string[] }) =>
          unwrap(await handleCommitChanges(args, ctx)),
      },
      {
        name: "mcp__jinzo__CreatePR",
        description: TOOL_DESCRIPTIONS.CreatePR,
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "The pull request title" },
            body: { type: "string", description: "The pull request body/description" },
            base: { type: "string", description: "The base branch to merge into (defaults to the repo default branch)" },
            draft: { type: "boolean", description: "Create as a draft pull request" },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Labels to add to the pull request",
            },
          },
          required: ["title"],
        },
        handler: async (args: { title: string; body?: string; base?: string; draft?: boolean; labels?: string[] }) =>
          unwrap(await handleCreatePR(args, ctx)),
      },
    ];
  }

  /**
   * Lazily initialize the Copilot client for a specific workspace
   */
  async function ensureClient(workspaceCwd?: string): Promise<CopilotClientInterface> {
    // If workspace changed between two non-null paths, stop and reinitialize.
    // When currentClientCwd is null (client initialized without workspace, e.g. listModels),
    // skip reinit — the session config sets its own cwd so a full restart isn't needed.
    if (client && workspaceCwd && currentClientCwd && currentClientCwd !== workspaceCwd) {
      logInfo(`Workspace changed from ${currentClientCwd} to ${workspaceCwd}, reinitializing client`);
      try {
        const stopTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Stop timed out")), 5000),
        );
        await Promise.race([client.stop(), stopTimeout]);
      } catch {
        try {
          await client.forceStop();
        } catch (err) {
          logWarn("Error force stopping client during workspace change:", err);
        }
      }
      client = null;
      clientInitPromise = null;
      initError = null;
    }

    // Track the workspace path without reinitializing
    if (workspaceCwd && !currentClientCwd) {
      currentClientCwd = workspaceCwd;
    }

    if (initError) {
      // Clear cached error so the next call can retry
      const err = initError;
      initError = null;
      clientInitPromise = null;
      throw err;
    }

    if (client) {
      return client;
    }

    if (clientInitPromise) {
      await clientInitPromise;
      if (client) return client;
      throw initError || new Error("Failed to initialize Copilot client");
    }

    clientInitPromise = (async () => {
      try {
        // Dynamic import to avoid compile-time dependency
        // Use new Function to prevent Vite from transforming import() to require() in CJS output
        // This is necessary because @github/copilot-sdk is ESM-only (no "require" export condition)
        const dynamicImport = new Function(
          "specifier",
          "return import(specifier)",
        );
        const CopilotSDK = await dynamicImport("@github/copilot-sdk").catch(
          () => null,
        );

        if (!CopilotSDK) {
          throw new Error(
            "Copilot SDK (@github/copilot-sdk) is not installed. " +
              "Please install it to use the Copilot provider.",
          );
        }

        const CopilotClient = (CopilotSDK as any).CopilotClient;

        if (!CopilotClient) {
          throw new Error(
            "Could not find CopilotClient in @github/copilot-sdk",
          );
        }

        // Check GitHub CLI auth before starting the Copilot client
        try {
          const { execSync } = require("child_process");
          execSync("gh auth status", { stdio: "pipe", timeout: 5000 });
        } catch {
          throw new Error(
            "GitHub CLI is not authenticated. Please run `gh auth login` in your terminal to sign in.",
          );
        }

        const options: CopilotClientOptions = {
          autoStart: true,
          logLevel: config.logLevel ?? "info",
        } satisfies CopilotClientOptions;

        if (config.binary) {
          options.cliPath = config.binary;
        }

        if (config.cliUrl) {
          options.cliUrl = config.cliUrl;
        } else if (config.useStdio === false && config.port) {
          options.port = config.port;
          options.useStdio = false;
        } else {
          options.useStdio = true;
        }

        // Set the working directory for the Copilot CLI process
        if (workspaceCwd) {
          options.cwd = workspaceCwd;
          currentClientCwd = workspaceCwd;
          logInfo(`Setting client cwd to: ${workspaceCwd}`);
        }

        client = new CopilotClient(options) as CopilotClientInterface;

        try {
          await client.start();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          if (errorMessage.includes("ENOENT")) {
            throw new Error(
              "Copilot CLI binary not found. Please ensure GitHub Copilot CLI is installed and the path is correct. " +
              `Current path: ${options.cliPath || "default"}`,
            );
          } else if (errorMessage.includes("ECONNREFUSED")) {
            throw new Error(
              "Could not connect to Copilot CLI server. The server may not be running or the port may be blocked. " +
              `Port: ${options.port || "stdio"}`,
            );
          } else if (errorMessage.includes("EACCES")) {
            throw new Error(
              "Permission denied when trying to start Copilot CLI. Please check file permissions. " +
              `Binary path: ${options.cliPath || "default"}`,
            );
          } else if (errorMessage.includes("ETIMEDOUT")) {
            throw new Error(
              "Connection timed out while starting Copilot CLI. The service may be unresponsive.",
            );
          } else {
            throw new Error(
              `Failed to start Copilot CLI: ${errorMessage}`,
            );
          }
        }

        // Verify connectivity
        await client.ping("init");

        logInfo("Client initialized successfully");
      } catch (error) {
        initError = error instanceof Error ? error : new Error(String(error));
        logError("Failed to initialize client:", initError.message);
        throw initError;
      }
    })();

    await clientInitPromise;
    if (!client) {
      throw initError || new Error("Failed to initialize Copilot client");
    }
    return client;
  }

  /**
   * Extract a normalized payload (some SDK events store data under event.data)
   */
  function getPayload(event: SessionEvent): any {
    return (event as any)?.data ?? event;
  }

  /**
   * Ephemeral events are UI/telemetry noise - ignore by default
   */
  function isEphemeral(event: SessionEvent): boolean {
    return Boolean((event as any)?.ephemeral === true);
  }

  /**
   * Map Copilot SDK session events to our WorkRunEvent type
   */
  function mapSessionEvent(
    event: SessionEvent,
    runId: string,
  ): WorkRunEvent | null {
    const ts = Date.now();

    // Let usage events through even if ephemeral
    if (event.type !== "assistant.usage" && isEphemeral(event)) return null;

    const payload = getPayload(event);

    switch (event.type) {
      // ─────────────── Ignore noisy flow markers
      case "pending_messages.modified":
      case "assistant.turn_start":
      case "session.usage_info":
        return null;

      case "assistant.turn_end": {
        const acc = usageAccumulator.get(runId);
        if (acc) acc.numTurns++;
        return null;
      }

      // ─────────────── Usage telemetry — accumulate per run
      case "assistant.usage": {
        if (payload && typeof payload === "object") {
          accumulateUsage(runId, payload as Record<string, unknown>);
        }
        return null;
      }

      // ─────────────── Assistant content (best-effort)
      case "assistant.message": {
        // Treat as a report artifact to ensure we actually persist "final" output
        const content = String((payload as any)?.content ?? event.content ?? "").trim();
        if (!content) return null;
        return {
          type: "artifact",
          kind: "report",
          content,
          metadata: { source: "assistant.message" },
        };
      }

      case "assistant.message_delta":
      case "assistant.reasoning_delta":
        return null;

      case "assistant.reasoning":
        return {
          type: "log",
          message: `[reasoning] ${String((payload as any)?.content ?? event.content ?? "")}`,
          level: "info",
          ts,
        };

      // ─────────────── Tooling
      case "tool.execution_start": {
        const toolCallId = String(
          (payload as any)?.toolCallId ?? (event as any)?.id ?? "",
        );
        const toolName = String(
          (payload as any)?.toolName ??
            (payload as any)?.name ??
            event.toolName ??
            "unknown",
        );
        const input =
          (payload as any)?.toolInput ??
          (payload as any)?.input ??
          (payload as any)?.toolArgs ??
          (payload as any)?.arguments ??
          event.toolInput ??
          (event as any).toolArgs ??
          (event as any).arguments;

        if (toolCallId) {
          toolCallIndex.set(toolCallId, { toolName, input, startedAt: ts });
        }

        return {
          type: "tool_call",
          toolName,
          input,
          startedAt: ts,
          metadata: {
            phase: "start",
            toolCallId: toolCallId || undefined,
            rawType: event.type,
          },
        };
      }

      case "tool.execution_end":
      case "tool.execution_complete": {
        const toolCallId = String(
          (payload as any)?.toolCallId ?? (event as any)?.id ?? "",
        );
        const prev = toolCallId ? toolCallIndex.get(toolCallId) : undefined;

        const toolName = String(
          (payload as any)?.toolName ??
            prev?.toolName ??
            event.toolName ??
            "unknown",
        );
        const input =
          (payload as any)?.toolInput ??
          (payload as any)?.input ??
          (payload as any)?.toolArgs ??
          (payload as any)?.arguments ??
          prev?.input ??
          event.toolInput ??
          (event as any).toolArgs ??
          (event as any).arguments;

        const success = (payload as any)?.success;
        const result =
          (payload as any)?.result ??
          (payload as any)?.toolOutput ??
          (payload as any)?.output ??
          event.toolOutput;

        const error =
          (payload as any)?.error ??
          event.error ??
          (success === false ? "tool_failed" : undefined);

        // don't keep index forever
        if (toolCallId) toolCallIndex.delete(toolCallId);

        return {
          type: "tool_call",
          toolName,
          input,
          output: result,
          error: error ? String(error) : undefined,
          endedAt: ts,
          metadata: {
            phase:
              event.type === "tool.execution_complete" ? "complete" : "end",
            toolCallId: toolCallId || undefined,
            success: typeof success === "boolean" ? success : undefined,
            toolTelemetry: (payload as any)?.toolTelemetry,
            rawType: event.type,
          },
        };
      }

      case "session.idle":
        return null;

      default:
        // Log unknown event types for debugging
        return {
          type: "log",
          message: `[event] ${event.type}: ${safeJson(payload)}`,
          level: "info",
          ts,
        };
    }
  }

  // extractArtifactsFromToolOutput imported from adapter.shared

  // saveAttachments, buildAttachmentPrompt are internal to adapter.shared

  /**
   * Build the prompt with context, including workspace path
   */
  function buildPrompt(request: WorkRunRequest): string {
    const workspaceInfo = `Working directory: ${request.workspace.rootPath}`;
    let prompt: string;

    if (request.context && request.context.length > 0) {
      const contextParts = formatContextSection(request.context);
      prompt = `${workspaceInfo}\n\nContext:\n${contextParts}\n\n---\n\nGoal: ${request.goal}`;
    } else {
      prompt = `${workspaceInfo}\n\nGoal: ${request.goal}`;
    }

    return appendPromptSections(prompt, {
      contextIssues: request.contextIssues,
      contextSignals: request.contextSignals,
      contextFiles: request.contextFiles,
      attachments: request.attachments,
      runId: request.runId,
    });
  }

  return {
    async startRun(
      request: WorkRunRequest,
      onEvent: WorkRunEventHandler,
    ): Promise<WorkRunResult> {
      const { runId, model, systemPrompt } = request;
      const timeout = config.timeout ?? 300000; // 5 minutes default

      let session: CopilotSession | null = null;
      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });
        await onEvent({
          type: "log",
          message: `Starting Copilot run in workspace: ${request.workspace.rootPath}`,
          level: "start",
          ts: Date.now(),
        });

        const copilotClient = await ensureClient(request.workspace.rootPath);

        const permissionMode = config.permissionMode || "default";

        const sessionConfig: SessionConfig = {
          sessionId: runId,
          streaming: true,
          cwd: request.workspace.rootPath,
          onPermissionRequest: permissionMode === "bypassPermissions"
            ? approveAllPermissions
            : buildPermissionHandler(runId),
        };

        if (permissionMode !== "bypassPermissions") {
          sessionConfig.hooks = { onPreToolUse: buildPreToolUseHook(runId) };
          sessionConfig.onUserInputRequest = buildUserInputHandler(runId);
        }

        if (model || config.defaultModel) {
          sessionConfig.model = model || config.defaultModel;
        }

        // Set reasoning effort from config (if model supports it)
        const reasoningEffort = (config as any).modelReasoningEffort as ReasoningEffort | undefined;
        if (reasoningEffort) {
          sessionConfig.reasoningEffort = reasoningEffort;
        }

        // Default skill directories: ~/.claude/skills, ~/.copilot/skills, {workspace}/.github/skills
        const homedir = os.homedir();
        sessionConfig.skillDirectories = [
          path.join(homedir, ".claude", "skills"),
          path.join(homedir, ".copilot", "skills"),
          path.join(request.workspace.rootPath, ".github", "skills"),
        ];

        // Inject Jinzo tools for workspace reviews
        const workspaceId = request.workspace.id ?? null;
        sessionConfig.tools = buildJinzoTools(workspaceId, request.workspace.rootPath, runId);

        // Build system message with explicit workspace context
        //TODO: CHECK
        const commitInstruction = "\nIMPORTANT: Never commit changes using Bash (git add, git commit). If the user asks you to commit, always use the CommitChanges tool from the jinzo MCP server to stage and commit changes. Similarly, never create pull requests using Bash (gh pr create). Always use the CreatePR tool from the jinzo MCP server instead.";
        const workspaceContext = `You are working in the directory: ${request.workspace.rootPath}\nAll file operations should be relative to this workspace root.`;
        if (systemPrompt) {
          sessionConfig.systemMessage = { content: `${workspaceContext}\n\n${systemPrompt}${commitInstruction}` };
        } else {
          sessionConfig.systemMessage = { content: `${workspaceContext}${commitInstruction}` };
        }

        session = await copilotClient.createSession(sessionConfig);
        activeRuns.set(runId, { session, aborted: false });

        await onEvent({
          type: "log",
          message: `Creating Copilot session with model: ${sessionConfig.model || "default"}`,
          level: "start",
          ts: Date.now(),
        });

        const unsubscribe = session.on((event: SessionEvent) => {
          const runState = activeRuns.get(runId);
          if (runState?.aborted) return;

          // Let usage/turn events through even if ephemeral
          if (event.type !== "assistant.usage" && event.type !== "assistant.turn_end" && isEphemeral(event)) return;

          const mappedEvent = mapSessionEvent(event, runId);
          if (mappedEvent) {
            Promise.resolve(onEvent(mappedEvent)).catch((err) => {
              logError("Error in event handler:", err);
            });

            // Track artifact list for the final result summary
            if (mappedEvent.type === "artifact") {
              collectedArtifacts.push({
                kind: mappedEvent.kind,
                path: mappedEvent.path,
              });
            }

            // If tool completion: extract artifacts/commands from payload result
            if (
              event.type === "tool.execution_end" ||
              event.type === "tool.execution_complete"
            ) {
              const payload = getPayload(event);
              const toolCallId = String((payload as any)?.toolCallId ?? "");
              const prev = toolCallId
                ? toolCallIndex.get(toolCallId)
                : undefined;

              const toolName = String(
                (payload as any)?.toolName ?? prev?.toolName ?? "unknown",
              );

              const toolOutput =
                (payload as any)?.result ??
                (payload as any)?.toolOutput ??
                (payload as any)?.output ??
                (event as any)?.toolOutput;

              if (toolOutput) {
                const artifactEvents = extractArtifactsFromToolOutput(
                  toolName,
                  toolOutput,
                );
                for (const artEvent of artifactEvents) {
                  Promise.resolve(onEvent(artEvent)).catch((err) => {
                    logError("Error emitting artifact:", err);
                  });

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
        });

        const prompt = buildPrompt(request);

        // Emit user's original goal as artifact for UI display
        await emitUserPromptArtifact(onEvent, request.goal, {
          attachments: request.attachments,
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
        });

        await onEvent({
          type: "log",
          message: `Sending prompt to Copilot (${prompt.length} chars)`,
          level: "start",
          ts: Date.now(),
        });

        const result = await session.sendAndWait({ prompt }, timeout);

        if (!result) {
          await onEvent({
            type: "log",
            message: "No response received from Copilot",
            level: "warn",
            ts: Date.now(),
          });
        }

        unsubscribe();

        const runState = activeRuns.get(runId);
        if (runState?.aborted) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });

          return {
            status: "canceled",
            summary: "Run was aborted by user",
            artifacts: collectedArtifacts,
            usage: flushUsage(runId),
          };
        }

        // Extract final text for summary (don't emit as artifact - already came via assistant.message event)
        const finalText =
          (result as any)?.content ??
          (result as any)?.output ??
          (result as any)?.data?.content ??
          (result as any)?.data?.output ??
          "";

        await onEvent({ type: "status", status: "succeeded", ts: Date.now() });

        return {
          status: "succeeded",
          summary: finalText || "Completed successfully",
          artifacts: collectedArtifacts,
          usage: flushUsage(runId),
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
        if (errorMessage.includes("timed out") || errorMessage.toLowerCase().includes("timeout")) {
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
            artifacts: collectedArtifacts,
            usage: flushUsage(runId),
          };
        }

        // Check for abort
        if (errorMessage.includes("aborted") || errorMessage.includes("abort")) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });

          return {
            status: "canceled",
            summary: "Run was aborted",
            artifacts: collectedArtifacts,
            usage: flushUsage(runId),
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
          artifacts: collectedArtifacts,
          usage: flushUsage(runId),
        };
      } finally {
        cancelPendingRequests(runId);
        activeRuns.delete(runId);

        if (session) {
          try {
            await session.destroy();
          } catch (err) {
            logError("Error destroying session:", err);
          }
        }
      }
    },

    async continueRun(
      request: WorkRunContinueRequest,
      onEvent: WorkRunEventHandler,
    ): Promise<WorkRunResult> {
      const { runId, message } = request;
      const timeout = config.timeout ?? 300000;

      let session: CopilotSession | null = null;
      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });
        await onEvent({
          type: "log",
          message: `Resuming Copilot session for run: ${runId}`,
          level: "resume",
          ts: Date.now(),
        });

        const copilotClient = await ensureClient(request.workspace.rootPath);

        // Resume the existing session with permission handlers
        const permissionMode = config.permissionMode || "default";
        const workspaceId = request.workspace.id ?? null;
        const resumeReasoningEffort = (config as any).modelReasoningEffort as ReasoningEffort | undefined;
        const resumeHomedir = os.homedir();
        const resumeConfig: Omit<SessionConfig, 'sessionId'> = {
          tools: buildJinzoTools(workspaceId, request.workspace.rootPath, runId),
          onPermissionRequest: permissionMode === "bypassPermissions"
            ? approveAllPermissions
            : buildPermissionHandler(runId),
          ...(permissionMode !== "bypassPermissions" && {
            hooks: { onPreToolUse: buildPreToolUseHook(runId) },
            onUserInputRequest: buildUserInputHandler(runId),
          }),
          ...(resumeReasoningEffort && { reasoningEffort: resumeReasoningEffort }),
          skillDirectories: [
            path.join(resumeHomedir, ".claude", "skills"),
            path.join(resumeHomedir, ".copilot", "skills"),
            path.join(request.workspace.rootPath, ".github", "skills"),
          ],
        };
        session = await copilotClient.resumeSession(runId, resumeConfig);
        activeRuns.set(runId, { session, aborted: false });

        const unsubscribe = session.on((event: SessionEvent) => {
          const runState = activeRuns.get(runId);
          if (runState?.aborted) return;

          // Let usage/turn events through even if ephemeral
          if (event.type !== "assistant.usage" && event.type !== "assistant.turn_end" && isEphemeral(event)) return;

          const mappedEvent = mapSessionEvent(event, runId);
          if (mappedEvent) {
            Promise.resolve(onEvent(mappedEvent)).catch((err) => {
              logError("Error in event handler:", err);
            });

            if (mappedEvent.type === "artifact") {
              collectedArtifacts.push({
                kind: mappedEvent.kind,
                path: mappedEvent.path,
              });
            }

            // Extract artifacts from tool completion events
            if (
              event.type === "tool.execution_end" ||
              event.type === "tool.execution_complete"
            ) {
              const payload = getPayload(event);
              const toolCallId = String((payload as any)?.toolCallId ?? "");
              const prev = toolCallId
                ? toolCallIndex.get(toolCallId)
                : undefined;

              const toolName = String(
                (payload as any)?.toolName ?? prev?.toolName ?? "unknown",
              );

              const toolOutput =
                (payload as any)?.result ??
                (payload as any)?.toolOutput ??
                (payload as any)?.output ??
                (event as any)?.toolOutput;

              if (toolOutput) {
                const artifactEvents = extractArtifactsFromToolOutput(
                  toolName,
                  toolOutput,
                );
                for (const artEvent of artifactEvents) {
                  Promise.resolve(onEvent(artEvent)).catch((err) => {
                    logError("Error emitting artifact:", err);
                  });

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
        });

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

        // Emit user's follow-up message as artifact for UI display
        await emitUserPromptArtifact(onEvent, message, {
          attachments: request.attachments,
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
        });

        await onEvent({
          type: "log",
          message: `Sending follow-up message (${prompt.length} chars)`,
          level: "resume",
          ts: Date.now(),
        });

        const result = await session.sendAndWait({ prompt }, timeout);

        if (!result) {
          await onEvent({
            type: "log",
            message: "No response received from Copilot",
            level: "warn",
            ts: Date.now(),
          });
        }

        unsubscribe();

        const runState = activeRuns.get(runId);
        if (runState?.aborted) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });

          return {
            status: "canceled",
            summary: "Run was aborted by user",
            artifacts: collectedArtifacts,
            usage: flushUsage(runId),
          };
        }

        const finalText =
          (result as any)?.content ??
          (result as any)?.output ??
          (result as any)?.data?.content ??
          (result as any)?.data?.output ??
          "";

        await onEvent({ type: "status", status: "succeeded", ts: Date.now() });

        return {
          status: "succeeded",
          summary: finalText || "Completed successfully",
          artifacts: collectedArtifacts,
          usage: flushUsage(runId),
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
        if (errorMessage.includes("timed out") || errorMessage.toLowerCase().includes("timeout")) {
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
            artifacts: collectedArtifacts,
            usage: flushUsage(runId),
          };
        }

        // Check for abort
        if (errorMessage.includes("aborted") || errorMessage.includes("abort")) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });

          return {
            status: "canceled",
            summary: "Run was aborted",
            artifacts: collectedArtifacts,
            usage: flushUsage(runId),
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
          artifacts: collectedArtifacts,
          usage: flushUsage(runId),
        };
      } finally {
        cancelPendingRequests(runId);
        activeRuns.delete(runId);

        if (session) {
          try {
            // Destroy keeps session state persisted on disk
            await session.destroy();
          } catch (err) {
            logError("Error destroying session:", err);
          }
        }
      }
    },

    async canResumeSession(runId: string): Promise<boolean> {
      try {
        const copilotClient = await ensureClient();
        const sessions = await copilotClient.listSessions();
        return sessions.some((s) => s.sessionId === runId);
      } catch (err) {
        logError("Error checking session:", err);
        return false;
      }
    },

    async deleteSession(runId: string): Promise<void> {
      try {
        const copilotClient = await ensureClient();
        await copilotClient.deleteSession(runId);
        logInfo(`Deleted session: ${runId}`);
      } catch (err) {
        logError("Error deleting session:", err);
      }
    },

    async abortRun(runId: string): Promise<void> {
      cancelPendingRequests(runId);
      const runState = activeRuns.get(runId);
      if (runState) {
        runState.aborted = true;
        try {
          await runState.session.abort();
        } catch (err) {
          logError("Error aborting session:", err);
        }
      }
    },

    async shutdown(): Promise<void> {
      // Mark all runs as aborted first to prevent new writes
      for (const [, state] of activeRuns) {
        state.aborted = true;
      }

      // Small delay to let pending operations complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clean up active sessions
      for (const [runId, state] of activeRuns) {
        try {
          await state.session.abort();
        } catch (err) {
          // Ignore abort errors during shutdown - stream may already be closed
          if (!(err instanceof Error && err.message.includes("ERR_STREAM_DESTROYED"))) {
            logError(`Error aborting run ${runId}:`, err);
          }
        }
        try {
          await state.session.destroy();
        } catch (err) {
          // Ignore destroy errors during shutdown
          if (!(err instanceof Error && err.message.includes("ERR_STREAM_DESTROYED"))) {
            logError(`Error destroying session ${runId}:`, err);
          }
        }
      }
      activeRuns.clear();
      toolCallIndex.clear();

      if (client) {
        try {
          // Try graceful stop first, fall back to forceStop on timeout
          const stopTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Stop timed out")), 5000),
          );
          await Promise.race([client.stop(), stopTimeout]);
        } catch {
          try {
            await client.forceStop();
          } catch (err) {
            if (!(err instanceof Error && err.message.includes("ERR_STREAM_DESTROYED"))) {
              logError("Error force stopping client:", err);
            }
          }
        }
        client = null;
      }

      clientInitPromise = null;
      initError = null;
      currentClientCwd = null;
      logInfo("Shutdown complete");
    },

    async generateTitle(goal: string, context?: import("./adapter.types").WorkRunContextItem[]): Promise<string> {
      const copilotClient = await ensureClient();

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
        "TASK: Generate a short title (3-5 words) for the following coding task.",
        "RULES: Reply with ONLY the title. No quotes, no explanation, no punctuation at the end, no prefixes like 'Title:'.",
        "",
        `User's request: ${goal}`,
        contextSnippet ? `\nContext:\n${contextSnippet}` : "",
        "",
        "Title:",
      ].filter(Boolean).join("\n");

      const session = await copilotClient.createSession({
        model: "gpt-4.1-nano",
        systemMessage: {
          content: "You are a title generator. Output ONLY a short title (3-5 words). Never explain, never use tools, never write code.",
        },
        onPermissionRequest: approveAllPermissions,
      });

      try {
        const result = await session.sendAndWait(
          { prompt: titlePrompt },
          15000, // 15s timeout for title generation
        );

        const titleText = String(
          (result as any)?.content ??
          (result as any)?.data?.content ??
          "",
        );

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
      } finally {
        try {
          await session.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }
    },

    async listModels(): Promise<ModelInfo[]> {
      try {
        const copilotClient = await ensureClient();

        // Check if client has connection with sendRequest capability
        if (!copilotClient.connection) {
          logWarn("Client connection not available for listing models");
          return [];
        }

        const result = await copilotClient.connection.sendRequest("models.list", {});
        const response = result as { models?: CopilotModelInfo[] };

        if (!response.models || !Array.isArray(response.models)) {
          logWarn("Invalid models response");
          return [];
        }

        return response.models.map((model): ModelInfo => ({
          id: model.id,
          displayName: model.name || model.id,
          isDefault: model.id === config.defaultModel,
          capabilities: {
            vision: model.capabilities?.supports?.vision,
          },
          contextWindow: model.capabilities?.limits?.max_context_window_tokens,
          supportsEffort: model.capabilities?.supports?.reasoningEffort ?? false,
          supportedEffortLevels: model.supportedReasoningEfforts,
        }));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // Auth errors should bubble up, not be silently swallowed
        if (/not authenticated|gh auth login/i.test(msg)) {
          throw error;
        }
        logError("Failed to list models:", error);
        return [];
      }
    },
  };
}

