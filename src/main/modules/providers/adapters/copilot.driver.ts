// ─────────────────────────────────────────────────────────────
// Copilot ProviderDriver
//
// SDK-specific seam for GitHub Copilot. Wraps `@github/copilot-sdk`'s
// CopilotClient + CopilotSession. Wrapped by `createWorkRunAdapter()` in
// work-run-core.ts to expose the WorkRunAdapter interface.
//
// Differences from cursor.driver:
//   - Copilot uses `runId` directly as `sessionId` (no separate ID assignment).
//     `AcquiredSession.sessionId` is omitted; Core doesn't persist anything.
//   - No fork or review verbs.
//   - Stop reason isn't a string — final outcome is determined by inspecting
//     the result object + the AbortSignal state in executePrompt's catch.
//   - Tool-call interruption events are emitted inside Driver's catch handler;
//     only the Driver knows which tool calls were in-flight.
// ─────────────────────────────────────────────────────────────

import path from "node:path";
import os from "node:os";
import type {
  AcquiredSession,
  CopilotAdapterConfig,
  DriverOutcome,
  ModelInfo,
  ProviderDriver,
  WorkRunContextItem,
  WorkRunContinueRequest,
  WorkRunEvent,
  WorkRunEventHandler,
  WorkRunRequest,
  WorkRunUsage,
} from "../../../../shared/adapter.types";
import {
  requestToolApproval,
} from "../../runs/user-input-broker";
import type { ToolApprovalRequest } from "../../runs/runs.dto";
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
// adapter compilable without the package installed)
// ─────────────────────────────────────────────────────────────

interface CopilotClientOptions {
  cliPath?: string;
  cliArgs?: string[];
  cliUrl?: string;
  cwd?: string;
  port?: number;
  useStdio?: boolean;
  isChildProcess?: boolean;
  logLevel?: "none" | "error" | "warning" | "info" | "debug" | "all";
  autoStart?: boolean;
  autoRestart?: boolean;
  env?: Record<string, string | undefined>;
  gitHubToken?: string;
  useLoggedInUser?: boolean;
  onListModels?: () => Promise<unknown[]> | unknown[];
  telemetry?: {
    otlpEndpoint?: string;
    filePath?: string;
    exporterType?: string;
    sourceName?: string;
    captureContent?: boolean;
  };
  onGetTraceContext?: () => { traceparent?: string; tracestate?: string } | Promise<{ traceparent?: string; tracestate?: string }>;
}

interface CopilotTool {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  handler: (args: any, invocation: { sessionId: string; toolCallId: string; toolName: string; arguments: unknown }) => Promise<unknown> | unknown;
  overridesBuiltInTool?: boolean;
  skipPermission?: boolean;
}

type ReasoningEffort = "low" | "medium" | "high" | "xhigh";

interface MCPServerConfig {
  type?: "stdio" | "http" | "sse";
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
  reasoningEffort?: ReasoningEffort;
  systemMessage?: { content: string } | { mode: "append"; content?: string } | { mode: "replace"; content: string };
  streaming?: boolean;
  cwd?: string;
  workingDirectory?: string;
  tools?: CopilotTool[];
  mcpServers?: Record<string, MCPServerConfig>;
  customAgents?: unknown[];
  agent?: string;
  skillDirectories?: string[];
  disabledSkills?: string[];
  infiniteSessions?: { enabled?: boolean; backgroundCompactionThreshold?: number; bufferExhaustionThreshold?: number };
  availableTools?: string[];
  excludedTools?: string[];
  onPermissionRequest: (
    request: { kind: string; toolCallId?: string; [key: string]: any },
    invocation: { sessionId: string },
  ) => Promise<{ kind: string; rules?: unknown[] }> | { kind: string; rules?: unknown[] };
  onUserInputRequest?: (
    request: { question: string; choices?: string[]; allowFreeform?: boolean },
    invocation: { sessionId: string },
  ) => Promise<{ answer: string; wasFreeform: boolean }> | { answer: string; wasFreeform: boolean };
  hooks?: {
    onPreToolUse?: (
      input: { toolName: string; toolArgs: unknown; timestamp: number; cwd: string },
      invocation: { sessionId: string },
    ) => Promise<{ permissionDecision?: "allow" | "deny" | "ask"; permissionDecisionReason?: string; modifiedArgs?: unknown } | void> | { permissionDecision?: "allow" | "deny" | "ask"; permissionDecisionReason?: string; modifiedArgs?: unknown } | void;
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

interface CopilotSdkSession {
  send(options: { prompt: string }): Promise<string>;
  sendAndWait(options: { prompt: string }, timeout?: number): Promise<SessionEvent | undefined>;
  on(handler: (event: SessionEvent) => void): () => void;
  abort(): Promise<void>;
  disconnect(): Promise<void>;
  setModel(model: string, options?: { reasoningEffort?: ReasoningEffort }): Promise<void>;
}

interface CopilotModelInfo {
  id: string;
  name?: string;
  capabilities?: {
    supports?: { vision?: boolean; reasoningEffort?: boolean };
    limits?: { max_prompt_tokens?: number; max_context_window_tokens?: number };
  };
  policy?: { state?: string };
  billing?: { multiplier?: number };
  supportedReasoningEfforts?: ReasoningEffort[];
  defaultReasoningEffort?: ReasoningEffort;
}

interface SessionMetadata {
  sessionId: string;
  startTime: Date;
  modifiedTime: Date;
  summary?: string;
  isRemote: boolean;
  context?: { cwd: string; gitRoot?: string; repository?: string; branch?: string };
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

interface CopilotClientInterface {
  start(): Promise<void>;
  stop(): Promise<Error[]>;
  forceStop(): Promise<void>;
  createSession(config: SessionConfig): Promise<CopilotSdkSession>;
  resumeSession(sessionId: string, config: Omit<SessionConfig, "sessionId">): Promise<CopilotSdkSession>;
  listSessions(filter?: { cwd?: string; repository?: string }): Promise<SessionMetadata[]>;
  deleteSession(sessionId: string): Promise<void>;
  ping(message?: string): Promise<{ message: string; timestamp: number; protocolVersion?: number }>;
  listModels(): Promise<CopilotModelInfo[]>;
  getAuthStatus(): Promise<unknown>;
  getState(): ConnectionState;
  getLastSessionId(): Promise<string | undefined>;
}

// ─────────────────────────────────────────────────────────────
// Per-run session state (handed back to Core as opaque `session`)
// ─────────────────────────────────────────────────────────────

interface CopilotSession {
  runId: string;
  sdkSession: CopilotSdkSession;
  /** Captured during executePrompt for use by error-path tool-call interruption emission. */
  unsubscribe?: () => void;
}

const { info: logInfo, warn: logWarn, error: logError } = createLogger("[CopilotDriver]");

// ─────────────────────────────────────────────────────────────
// Module-scoped pre-approved tool set (extends adapter.shared's set)
// ─────────────────────────────────────────────────────────────

const COPILOT_EXTRA_ALLOWED = new Set([
  "bash", "read", "glob", "grep", "report_intent", "view",
  "permission:read", "web_fetch", "permission:url",
]);

function isCopilotToolAllowed(toolName: string): boolean {
  return ALLOWED_TOOLS_SET.has(toolName) || COPILOT_EXTRA_ALLOWED.has(toolName);
}

// ─────────────────────────────────────────────────────────────
// Driver factory
// ─────────────────────────────────────────────────────────────

export function createCopilotDriver(config: CopilotAdapterConfig): ProviderDriver {
  let client: CopilotClientInterface | null = null;
  let clientInitPromise: Promise<void> | null = null;
  let initError: Error | null = null;
  let currentClientCwd: string | null = null;

  // Correlate tool events when toolName/input is missing in completion events.
  // Module-scoped: shared across runs (matches today's adapter behavior).
  const toolCallIndex = new Map<
    string,
    { toolName: string; input?: unknown; startedAt?: number }
  >();

  // Per-run usage accumulator.
  const usageAccumulator = new Map<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      totalCostUsd: number;
      numTurns: number;
      model: string;
      modelUsage: Record<string, { costUSD: number; inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number }>;
    }
  >();

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

  // ─────────────────────────────────────────────────────────────
  // Permission & tool approval handlers (per-run closures)
  // ─────────────────────────────────────────────────────────────

  function approveAllPermissions(): { kind: string } {
    return { kind: "approved" };
  }

  function buildPermissionHandler(runId: string) {
    return async (
      request: { kind: string; toolCallId?: string; [key: string]: any },
    ): Promise<{ kind: string; rules?: unknown[] }> => {
      if (request.kind === "read" || request.kind === "shell" || request.kind === "task" || request.kind === "ask_user") {
        return { kind: "approved" };
      }

      if (request.kind === "custom-tool" && typeof request.toolName === "string" && request.toolName.startsWith("mcp__mains__")) {
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

  function buildPreToolUseHook(runId: string) {
    return async (
      input: { toolName: string; toolArgs: unknown; timestamp: number; cwd: string },
    ): Promise<{ permissionDecision?: "allow" | "deny" | "ask"; permissionDecisionReason?: string; modifiedArgs?: unknown } | void> => {
      const guardHook = await guardsService.buildCopilotGuardHook();
      if (guardHook) {
        const guardResult = await guardHook(input);
        if (guardResult?.permissionDecision === "deny") {
          return guardResult;
        }
      }

      if (isCopilotToolAllowed(input.toolName)) {
        return { permissionDecision: "allow" };
      }

      if (input.toolName.startsWith("mcp__")) {
        return { permissionDecision: "allow" };
      }

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

  // ─────────────────────────────────────────────────────────────
  // Mains tool registration
  // ─────────────────────────────────────────────────────────────

  function buildMainsTools(workspaceId: string | null, rootPath: string | null = null, runId: string | null = null): CopilotTool[] {
    const ctx: MainsToolContext = { workspaceId, rootPath, runId };

    const unwrap = async (result: { content: Array<{ text: string }>; isError?: boolean }) => {
      const text = result.content[0]?.text ?? "";
      return result.isError ? text : text;
    };

    return [
      {
        name: "mcp__mains__GetWorkspaceDiff",
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
        name: "mcp__mains__SaveReview",
        description: TOOL_DESCRIPTIONS.SaveReview,
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            status: { type: "string", enum: ["open", "in_review", "approved", "rejected"] },
            metadata: { type: "object" },
          },
          required: ["title"],
        },
        handler: async (args: { title: string; summary?: string; status?: string; metadata?: Record<string, unknown> }) =>
          unwrap(await handleSaveReview(args, ctx)),
      },
      {
        name: "mcp__mains__SaveFinding",
        description: TOOL_DESCRIPTIONS.SaveFinding,
        parameters: {
          type: "object",
          properties: {
            reviewId: { type: "string" },
            severity: { type: "string", enum: ["critical", "warning", "info"] },
            file: { type: "string" },
            lineStart: { type: "number" },
            lineEnd: { type: "number" },
            message: { type: "string" },
            reason: { type: "string" },
            suggestion: { type: "string" },
            metadata: { type: "object" },
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
        name: "mcp__mains__SaveFindings",
        description: TOOL_DESCRIPTIONS.SaveFindings,
        parameters: {
          type: "object",
          properties: {
            reviewId: { type: "string" },
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
        name: "mcp__mains__CommitChanges",
        description: TOOL_DESCRIPTIONS.CommitChanges,
        parameters: {
          type: "object",
          properties: {
            message: { type: "string" },
            files: { type: "array", items: { type: "string" } },
          },
        },
        handler: async (args: { message?: string; files?: string[] }) =>
          unwrap(await handleCommitChanges(args, ctx)),
      },
      {
        name: "mcp__mains__CreatePR",
        description: TOOL_DESCRIPTIONS.CreatePR,
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            base: { type: "string" },
            draft: { type: "boolean" },
            labels: { type: "array", items: { type: "string" } },
          },
          required: ["title"],
        },
        handler: async (args: { title: string; body?: string; base?: string; draft?: boolean; labels?: string[] }) =>
          unwrap(await handleCreatePR(args, ctx)),
      },
    ];
  }

  // ─────────────────────────────────────────────────────────────
  // SDK client lifecycle
  // ─────────────────────────────────────────────────────────────

  async function ensureClient(workspaceCwd?: string): Promise<CopilotClientInterface> {
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

    if (workspaceCwd && !currentClientCwd) {
      currentClientCwd = workspaceCwd;
    }

    if (initError) {
      const err = initError;
      initError = null;
      clientInitPromise = null;
      throw err;
    }

    if (client) return client;

    if (clientInitPromise) {
      await clientInitPromise;
      if (client) return client;
      throw initError || new Error("Failed to initialize Copilot client");
    }

    clientInitPromise = (async () => {
      try {
        // ESM-only SDK; dodge Vite's CJS rewrite of import().
        const dynamicImport = new Function("specifier", "return import(specifier)");
        const CopilotSDK = await dynamicImport("@github/copilot-sdk").catch(() => null);

        if (!CopilotSDK) {
          throw new Error(
            "Copilot SDK (@github/copilot-sdk) is not installed. Please install it to use the Copilot provider.",
          );
        }

        const CopilotClient = (CopilotSDK as any).CopilotClient;
        if (!CopilotClient) {
          throw new Error("Could not find CopilotClient in @github/copilot-sdk");
        }

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
        };

        if (config.binary) options.cliPath = config.binary;

        if (config.cliUrl) {
          options.cliUrl = config.cliUrl;
        } else if (config.useStdio === false && config.port) {
          options.port = config.port;
          options.useStdio = false;
        } else {
          options.useStdio = true;
        }

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
              `Copilot CLI binary not found. Please ensure GitHub Copilot CLI is installed and the path is correct. Current path: ${options.cliPath || "default"}`,
            );
          } else if (errorMessage.includes("ECONNREFUSED")) {
            throw new Error(
              `Could not connect to Copilot CLI server. The server may not be running or the port may be blocked. Port: ${options.port || "stdio"}`,
            );
          } else if (errorMessage.includes("EACCES")) {
            throw new Error(
              `Permission denied when trying to start Copilot CLI. Please check file permissions. Binary path: ${options.cliPath || "default"}`,
            );
          } else if (errorMessage.includes("ETIMEDOUT")) {
            throw new Error("Connection timed out while starting Copilot CLI. The service may be unresponsive.");
          } else {
            throw new Error(`Failed to start Copilot CLI: ${errorMessage}`);
          }
        }

        await client.ping("init");
        logInfo("Client initialized successfully");
      } catch (error) {
        initError = error instanceof Error ? error : new Error(String(error));
        logError("Failed to initialize client:", initError.message);
        throw initError;
      }
    })();

    await clientInitPromise;
    if (!client) throw initError || new Error("Failed to initialize Copilot client");
    return client;
  }

  // ─────────────────────────────────────────────────────────────
  // Session config builder (shared by createSession + resumeSession)
  // ─────────────────────────────────────────────────────────────

  function buildBaseSessionConfig(
    runId: string,
    workspace: WorkRunRequest["workspace"],
    permissionMode: string,
  ): Omit<SessionConfig, "sessionId"> {
    const base: Omit<SessionConfig, "sessionId"> = {
      streaming: true,
      cwd: workspace.rootPath,
      onPermissionRequest:
        permissionMode === "bypassPermissions" || permissionMode === "allow"
          ? approveAllPermissions
          : buildPermissionHandler(runId),
      tools: buildMainsTools(workspace.id ?? null, workspace.rootPath, runId),
      skillDirectories: [
        path.join(os.homedir(), ".claude", "skills"),
        path.join(os.homedir(), ".copilot", "skills"),
        path.join(workspace.rootPath, ".github", "skills"),
      ],
    };

    if (permissionMode !== "bypassPermissions" && permissionMode !== "allow") {
      base.hooks = { onPreToolUse: buildPreToolUseHook(runId) };
      base.onUserInputRequest = buildUserInputHandler(runId);
    }

    return base;
  }

  // ─────────────────────────────────────────────────────────────
  // Event mapping: Copilot SDK events → WorkRunEvent
  // ─────────────────────────────────────────────────────────────

  function getPayload(event: SessionEvent): any {
    return (event as any)?.data ?? event;
  }

  function isEphemeral(event: SessionEvent): boolean {
    return Boolean((event as any)?.ephemeral === true);
  }

  function mapSessionEvent(event: SessionEvent, runId: string): WorkRunEvent | null {
    const ts = Date.now();

    if (event.type !== "assistant.usage" && isEphemeral(event)) return null;

    const payload = getPayload(event);

    switch (event.type) {
      case "pending_messages.modified":
      case "assistant.turn_start":
      case "session.usage_info":
        return null;

      case "assistant.turn_end": {
        const acc = usageAccumulator.get(runId);
        if (acc) acc.numTurns++;
        return null;
      }

      case "assistant.usage": {
        if (payload && typeof payload === "object") {
          accumulateUsage(runId, payload as Record<string, unknown>);
        }
        return null;
      }

      case "assistant.message": {
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

      case "tool.execution_start": {
        const toolCallId = String((payload as any)?.toolCallId ?? (event as any)?.id ?? "");
        const toolName = String(
          (payload as any)?.toolName ?? (payload as any)?.name ?? event.toolName ?? "unknown",
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
        const toolCallId = String((payload as any)?.toolCallId ?? (event as any)?.id ?? "");
        const prev = toolCallId ? toolCallIndex.get(toolCallId) : undefined;

        const toolName = String(
          (payload as any)?.toolName ?? prev?.toolName ?? event.toolName ?? "unknown",
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

        if (toolCallId) toolCallIndex.delete(toolCallId);

        return {
          type: "tool_call",
          toolName,
          input,
          output: result,
          error: error ? String(error) : undefined,
          endedAt: ts,
          metadata: {
            phase: event.type === "tool.execution_complete" ? "complete" : "end",
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
        return {
          type: "log",
          message: `[event] ${event.type}: ${safeJson(payload)}`,
          level: "info",
          ts,
        };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Prompt building
  // ─────────────────────────────────────────────────────────────

  function buildStartPrompt(request: WorkRunRequest): string {
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

  function buildContinuePrompt(request: WorkRunContinueRequest): string {
    let prompt = request.message;

    if (request.context && request.context.length > 0) {
      const contextParts = formatContextSection(request.context);
      prompt = `Context:\n${contextParts}\n\n---\n\n${request.message}`;
    }

    return appendPromptSections(prompt, {
      contextIssues: request.contextIssues,
      contextSignals: request.contextSignals,
      contextFiles: request.contextFiles,
      attachments: request.attachments,
      runId: request.runId,
      includeIssueBody: false,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Wire SDK session.on() to push WorkRunEvents through onEvent
  // ─────────────────────────────────────────────────────────────

  function wireSessionListener(
    sdkSession: CopilotSdkSession,
    runId: string,
    onEvent: WorkRunEventHandler,
    signal: AbortSignal,
  ): () => void {
    return sdkSession.on((event: SessionEvent) => {
      if (signal.aborted) return;
      if (event.type !== "assistant.usage" && event.type !== "assistant.turn_end" && isEphemeral(event)) {
        return;
      }

      const mapped = mapSessionEvent(event, runId);
      if (!mapped) return;

      void Promise.resolve(onEvent(mapped)).catch((err) =>
        logError("onEvent threw:", err),
      );

      // Tool-completion events also yield artifact events for written files / patches
      if (event.type === "tool.execution_end" || event.type === "tool.execution_complete") {
        const payload = getPayload(event);
        const toolCallId = String((payload as any)?.toolCallId ?? "");
        const prev = toolCallId ? toolCallIndex.get(toolCallId) : undefined;
        const toolName = String((payload as any)?.toolName ?? prev?.toolName ?? "unknown");
        const toolOutput =
          (payload as any)?.result ??
          (payload as any)?.toolOutput ??
          (payload as any)?.output ??
          (event as any)?.toolOutput;

        if (toolOutput) {
          for (const artEvent of extractArtifactsFromToolOutput(toolName, toolOutput)) {
            void Promise.resolve(onEvent(artEvent)).catch((err) =>
              logError("Error emitting artifact:", err),
            );
          }
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Translate sendAndWait result + signal state → DriverOutcome
  // ─────────────────────────────────────────────────────────────

  function buildSuccessOutcome(
    result: SessionEvent | undefined,
    runId: string,
  ): DriverOutcome {
    const finalText =
      (result as any)?.content ??
      (result as any)?.output ??
      (result as any)?.data?.content ??
      (result as any)?.data?.output ??
      "";
    return {
      status: "succeeded",
      summary: finalText || "Completed successfully",
      usage: flushUsage(runId),
    };
  }

  function buildErrorOutcome(
    err: unknown,
    runId: string,
    timeoutMs: number,
    signal: AbortSignal,
  ): DriverOutcome {
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (signal.aborted) {
      return {
        status: "canceled",
        summary: "Run was aborted",
        usage: flushUsage(runId),
      };
    }

    if (errorMessage.includes("timed out") || errorMessage.toLowerCase().includes("timeout")) {
      return {
        status: "failed",
        summary: `Request timed out after ${timeoutMs / 1000} seconds.`,
        usage: flushUsage(runId),
      };
    }

    if (errorMessage.includes("aborted") || errorMessage.includes("abort")) {
      return {
        status: "canceled",
        summary: "Run was aborted",
        usage: flushUsage(runId),
      };
    }

    return {
      status: "failed",
      summary: errorMessage,
      usage: flushUsage(runId),
    };
  }

  /** Emit phase=complete events for any tool calls still pending when an error fires. */
  async function emitPendingToolInterruptions(onEvent: WorkRunEventHandler): Promise<void> {
    const ts = Date.now();
    for (const [toolCallId, toolInfo] of toolCallIndex) {
      await onEvent({
        type: "tool_call",
        toolName: toolInfo.toolName,
        input: toolInfo.input as Record<string, unknown> | undefined,
        error: "Interrupted",
        endedAt: ts,
        metadata: { phase: "complete", toolCallId, interrupted: true },
      });
    }
    toolCallIndex.clear();
  }

  // ─────────────────────────────────────────────────────────────
  // ProviderDriver implementation
  // ─────────────────────────────────────────────────────────────

  return {
    async createSession(request: WorkRunRequest): Promise<AcquiredSession> {
      const { runId, model, systemPrompt } = request;

      const copilotClient = await ensureClient(request.workspace.rootPath);

      const overrides = (request.configSnapshot ?? {}) as Record<string, unknown>;
      const permissionMode =
        (typeof overrides.permissionMode === "string" && overrides.permissionMode) ||
        config.permissionMode ||
        "default";

      const sessionConfig: SessionConfig = {
        sessionId: runId,
        ...buildBaseSessionConfig(runId, request.workspace, permissionMode),
      };

      if (model || config.defaultModel) {
        sessionConfig.model = model || config.defaultModel;
      }

      const overrideEffort =
        typeof overrides.modelReasoningEffort === "string"
          ? overrides.modelReasoningEffort
          : typeof overrides.effortLevel === "string" && overrides.effortLevel
            ? overrides.effortLevel
            : undefined;
      const reasoningEffort = (overrideEffort ?? (config as any).modelReasoningEffort) as
        | ReasoningEffort
        | undefined;
      if (reasoningEffort) {
        sessionConfig.reasoningEffort = reasoningEffort;
      }

      const commitInstruction =
        "\nIMPORTANT: Never commit changes using Bash (git add, git commit). If the user asks you to commit, always use the CommitChanges tool from the mains MCP server to stage and commit changes. Similarly, never create pull requests using Bash (gh pr create). Always use the CreatePR tool from the mains MCP server instead.";
      const workspaceContext = `You are working in the directory: ${request.workspace.rootPath}\nAll file operations should be relative to this workspace root.`;
      sessionConfig.systemMessage = {
        content: systemPrompt
          ? `${workspaceContext}\n\n${systemPrompt}${commitInstruction}`
          : `${workspaceContext}${commitInstruction}`,
      };

      const sdkSession = await copilotClient.createSession(sessionConfig);
      logInfo(`Created Copilot session for run ${runId} (model: ${sessionConfig.model || "default"})`);

      const session: CopilotSession = { runId, sdkSession };
      return { session, prompt: buildStartPrompt(request) };
    },

    async resumeSession(request: WorkRunContinueRequest): Promise<AcquiredSession> {
      const { runId } = request;

      const copilotClient = await ensureClient(request.workspace.rootPath);
      const permissionMode = config.permissionMode || "default";

      const resumeConfig: Omit<SessionConfig, "sessionId"> = {
        ...buildBaseSessionConfig(runId, request.workspace, permissionMode),
      };

      const resumeModel = request.model || config.defaultModel;
      if (resumeModel) resumeConfig.model = resumeModel;

      const resumeReasoningEffort = (config as any).modelReasoningEffort as
        | ReasoningEffort
        | undefined;
      if (resumeReasoningEffort) resumeConfig.reasoningEffort = resumeReasoningEffort;

      const sdkSession = await copilotClient.resumeSession(runId, resumeConfig);
      logInfo(`Resumed Copilot session for run ${runId}`);

      const session: CopilotSession = { runId, sdkSession };
      return { session, prompt: buildContinuePrompt(request) };
    },

    async executePrompt(
      session,
      prompt,
      onEvent,
      signal,
    ): Promise<DriverOutcome> {
      const cs = session as CopilotSession;
      const timeout = config.timeout ?? 300000;

      // Wire abort: when signal fires, ask SDK to abort
      const onAbort = () => {
        cs.sdkSession.abort().catch((err) => logError("Error aborting session:", err));
      };
      signal.addEventListener("abort", onAbort, { once: true });

      // Wire SDK event stream
      cs.unsubscribe = wireSessionListener(cs.sdkSession, cs.runId, onEvent, signal);

      try {
        const result = await cs.sdkSession.sendAndWait({ prompt }, timeout);

        if (!result) {
          await onEvent({
            type: "log",
            message: "No response received from Copilot",
            level: "warn",
            ts: Date.now(),
          });
        }

        return buildSuccessOutcome(result, cs.runId);
      } catch (error) {
        await emitPendingToolInterruptions(onEvent);
        return buildErrorOutcome(error, cs.runId, timeout, signal);
      } finally {
        signal.removeEventListener("abort", onAbort);
        try {
          cs.unsubscribe?.();
        } catch {
          /* ignore */
        }
      }
    },

    async cleanup(session): Promise<void> {
      const cs = session as CopilotSession;
      try {
        await cs.sdkSession.disconnect();
      } catch (err) {
        logError("Error disconnecting session:", err);
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

    async shutdown(): Promise<void> {
      toolCallIndex.clear();
      usageAccumulator.clear();

      if (client) {
        try {
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

    async generateTitle(goal: string, context?: WorkRunContextItem[]): Promise<string> {
      const copilotClient = await ensureClient();

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
        "TASK: Generate a short title (3-5 words) for the following coding task.",
        "RULES: Reply with ONLY the title (title case — capitalize each word). No quotes, no explanation, no punctuation at the end, no prefixes like 'Title:'.",
        "",
        `User's request: ${goal}`,
        contextSnippet ? `\nContext:\n${contextSnippet}` : "",
        "",
        "Title:",
      ]
        .filter(Boolean)
        .join("\n");

      // Note: previously hardcoded to "gpt-4.1-nano" for cheap title generation, but
      // GitHub deprecated that model and the SDK now rejects with "Model ... is not
      // available". Omit the model field so the SDK falls back to the user's configured
      // default (or whatever Copilot picks).
      const session = await copilotClient.createSession({
        systemMessage: {
          content:
            "You are a title generator. Output ONLY a short title (3-5 words) in title case (capitalize the first letter of each word). Never explain, never use tools, never write code.",
        },
        onPermissionRequest: approveAllPermissions,
      });

      try {
        const result = await session.sendAndWait({ prompt: titlePrompt }, 15000);

        const titleText = String(
          (result as any)?.content ?? (result as any)?.data?.content ?? "",
        );

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
      } finally {
        try {
          await session.disconnect();
        } catch {
          /* ignore */
        }
      }
    },

    async listModels(): Promise<ModelInfo[]> {
      try {
        const copilotClient = await ensureClient();
        const models = await copilotClient.listModels();

        if (!models || !Array.isArray(models)) {
          logWarn("Invalid models response");
          return [];
        }

        return models.map(
          (model): ModelInfo => ({
            id: model.id,
            displayName: model.name || model.id,
            isDefault: model.id === config.defaultModel,
            capabilities: { vision: model.capabilities?.supports?.vision },
            contextWindow: model.capabilities?.limits?.max_context_window_tokens,
            supportsEffort: model.capabilities?.supports?.reasoningEffort ?? false,
            supportedEffortLevels: model.supportedReasoningEfforts,
          }),
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (/not authenticated|gh auth login/i.test(msg)) {
          throw error;
        }
        logError("Failed to list models:", error);
        return [];
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Pure helpers exported for testing
// ─────────────────────────────────────────────────────────────

/**
 * Translate copilot's error/result into a DriverOutcome. Pure: no SDK access,
 * exposed for tests.
 */
export function classifyOutcome(args: {
  hasError: boolean;
  errorMessage?: string;
  signalAborted: boolean;
  finalText?: string;
  timeoutMs: number;
}): { status: DriverOutcome["status"]; summary: string } {
  const { hasError, errorMessage, signalAborted, finalText, timeoutMs } = args;

  if (!hasError) {
    return { status: "succeeded", summary: finalText || "Completed successfully" };
  }

  if (signalAborted) {
    return { status: "canceled", summary: "Run was aborted" };
  }

  const msg = errorMessage ?? "";
  if (msg.includes("timed out") || msg.toLowerCase().includes("timeout")) {
    return {
      status: "failed",
      summary: `Request timed out after ${timeoutMs / 1000} seconds.`,
    };
  }

  if (msg.includes("aborted") || msg.includes("abort")) {
    return { status: "canceled", summary: "Run was aborted" };
  }

  return { status: "failed", summary: msg };
}
