// ─────────────────────────────────────────────────────────────
// OpenAI Codex SDK Adapter
// Implements WorkRunAdapter using @openai/codex-sdk
// ─────────────────────────────────────────────────────────────

import type {
  WorkRunAdapter,
  WorkRunRequest,
  WorkRunContinueRequest,
  WorkRunResult,
  WorkRunUsage,
  WorkRunEventHandler,
  WorkRunEvent,
  CodexAdapterConfig,
  ModelInfo,
} from "./adapter.types";
import {
  cancelPendingRequests,
} from "../../runs/user-input-broker";
import {
  createLogger,
  safeJson,
  extractArtifactsFromToolOutput,
  formatContextSection,
  appendPromptSections,
  emitUserPromptArtifact,
  saveAttachments,
} from "./adapter.shared";

// ─────────────────────────────────────────────────────────────
// SDK types (from @openai/codex-sdk/dist/index.d.ts)
// Using local stubs to allow compilation without SDK installed
// ─────────────────────────────────────────────────────────────

interface CodexOptions {
  codexPathOverride?: string;
  baseUrl?: string;
  apiKey?: string;
  config?: Record<string, unknown>;
  env?: Record<string, string>;
}

interface ThreadOptions {
  model?: string;
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
  workingDirectory?: string;
  skipGitRepoCheck?: boolean;
  approvalPolicy?: "never" | "on-request" | "on-failure" | "untrusted";
  modelReasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
  networkAccessEnabled?: boolean;
  webSearchMode?: "disabled" | "cached" | "live";
  webSearchEnabled?: boolean;
  additionalDirectories?: string[];
}

interface TurnOptions {
  outputSchema?: unknown;
  signal?: AbortSignal;
}

/** SDK ThreadEvent discriminated union */
interface ThreadEvent {
  type: string;
  [key: string]: unknown;
}

/** SDK ThreadItem (union of all item types) */
interface ThreadItem {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface Usage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
}

interface StreamedTurn {
  events: AsyncGenerator<ThreadEvent>;
}

interface CodexThread {
  id: string | null;
  run(input: string | Array<{ type: string; text?: string; path?: string }>, options?: TurnOptions): Promise<{ items: ThreadItem[]; finalResponse: string; usage: Usage | null }>;
  runStreamed(input: string | Array<{ type: string; text?: string; path?: string }>, options?: TurnOptions): Promise<StreamedTurn>;
}

interface CodexClient {
  startThread(options?: ThreadOptions): CodexThread;
  resumeThread(id: string, options?: ThreadOptions): CodexThread;
}

// ─────────────────────────────────────────────────────────────
// Active run tracking
// ─────────────────────────────────────────────────────────────

const activeRuns = new Map<string, { thread: CodexThread; aborted: boolean; abortController?: AbortController }>();

// Session ID mapping: runId → threadId (for resume support)
const sessionIdMap = new Map<string, string>();

const { info: logInfo, error: logError } = createLogger("[CodexAdapter]");

// ─────────────────────────────────────────────────────────────
// Approval mode mapping
// ─────────────────────────────────────────────────────────────

function mapPermissionMode(mode?: string): "untrusted" | "on-request" | "on-failure" | "never" {
  switch (mode) {
    case "bypassPermissions": return "never";
    case "acceptEdits": return "on-failure";
    // "on-request" requires an interactive TTY which is unavailable in Electron
    // subprocess context. Default to "on-failure" for a safe non-interactive mode.
    default: return "on-failure";
  }
}

/**
 * Creates an OpenAI Codex SDK adapter instance.
 * The SDK spawns the Codex CLI as a subprocess and communicates via JSONL over stdin/stdout.
 */
export function createCodexAdapter(config: CodexAdapterConfig): WorkRunAdapter {
  let codexClient: CodexClient | null = null;
  let clientInitPromise: Promise<void> | null = null;
  let initError: Error | null = null;

  // Usage accumulation per run
  const usageAccumulator = new Map<string, {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
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
        cachedInputTokens: 0,
        numTurns: 0,
        model: "",
        modelUsage: {},
      };
      usageAccumulator.set(runId, acc);
    }
    return acc;
  }

  function flushUsage(runId: string): WorkRunUsage | undefined {
    const acc = usageAccumulator.get(runId);
    usageAccumulator.delete(runId);
    if (!acc || (acc.inputTokens === 0 && acc.outputTokens === 0)) {
      return undefined;
    }
    return {
      inputTokens: acc.inputTokens,
      outputTokens: acc.outputTokens,
      cacheReadTokens: acc.cachedInputTokens,
      numTurns: acc.numTurns,
      model: acc.model || undefined,
      modelUsage: Object.keys(acc.modelUsage).length > 0 ? acc.modelUsage : undefined,
    };
  }

  /**
   * Lazily initialize the Codex client
   */
  async function ensureClient(): Promise<CodexClient> {
    if (initError) {
      const err = initError;
      initError = null;
      clientInitPromise = null;
      throw err;
    }

    if (codexClient) return codexClient;

    if (clientInitPromise) {
      await clientInitPromise;
      if (codexClient) return codexClient;
      throw initError || new Error("Failed to initialize Codex client");
    }

    clientInitPromise = (async () => {
      try {
        // Use new Function to prevent Vite from transforming import() to require() in CJS output
        // This is necessary because @openai/codex-sdk is ESM-only (no "require" export condition)
        const dynamicImport = new Function(
          "specifier",
          "return import(specifier)",
        );
        const CodexSDK = await dynamicImport("@openai/codex-sdk").catch(
          () => null,
        );

        if (!CodexSDK) {
          throw new Error(
            "Codex SDK (@openai/codex-sdk) is not installed. " +
            "Please install it to use the Codex provider: npm install @openai/codex-sdk"
          );
        }

        const CodexConstructor = (CodexSDK as any).Codex ?? (CodexSDK as any).default;
        if (!CodexConstructor) {
          throw new Error("Could not find Codex constructor in @openai/codex-sdk");
        }

        const options: CodexOptions = {};

        if (config.binary) {
          options.codexPathOverride = config.binary;
        }

        if (config.baseUrl) {
          options.baseUrl = config.baseUrl;
        }

        // API key is optional — if omitted, the SDK inherits process.env
        // and the Codex CLI uses cached auth from ~/.codex/auth.json
        // (set via `codex` browser login or `codex login --device-auth`).
        if (config.apiKey) {
          options.apiKey = config.apiKey;
        } else if (process.env.OPENAI_API_KEY) {
          options.apiKey = process.env.OPENAI_API_KEY;
        } else if (process.env.CODEX_API_KEY) {
          options.apiKey = process.env.CODEX_API_KEY;
        }
        // If none of the above: no apiKey set → CLI resolves auth from ~/.codex/auth.json

        if (config.config) {
          options.config = config.config;
        }

        codexClient = new CodexConstructor(options) as CodexClient;
        logInfo("Client initialized successfully");
      } catch (error) {
        initError = error instanceof Error ? error : new Error(String(error));
        logError("Failed to initialize client:", initError.message);
        throw initError;
      }
    })();

    await clientInitPromise;
    if (!codexClient) {
      throw initError || new Error("Failed to initialize Codex client");
    }
    return codexClient;
  }

  // ─────────────────────────────────────────────────────────────
  // Event mapping: Codex ThreadEvent → WorkRunEvent
  // ─────────────────────────────────────────────────────────────

  function mapThreadEvent(event: ThreadEvent, runId: string): WorkRunEvent[] {
    const ts = Date.now();
    const events: WorkRunEvent[] = [];

    switch (event.type) {
      case "thread.started": {
        const threadId = event.thread_id as string | undefined;
        if (threadId) {
          sessionIdMap.set(runId, threadId);
        }
        // No UI log — thread lifecycle is internal
        break;
      }

      case "turn.started":
        // No UI log — turn lifecycle is tracked via usage/status
        break;

      case "turn.completed": {
        const usage = event.usage as Usage | undefined;
        if (usage) {
          const acc = getOrCreateUsage(runId);
          acc.inputTokens += usage.input_tokens ?? 0;
          acc.outputTokens += usage.output_tokens ?? 0;
          acc.cachedInputTokens += usage.cached_input_tokens ?? 0;
          acc.numTurns++;

          const model = config.defaultModel || "codex";
          acc.model = model;
          if (!acc.modelUsage[model]) {
            acc.modelUsage[model] = { costUSD: 0, inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };
          }
          acc.modelUsage[model].inputTokens += usage.input_tokens ?? 0;
          acc.modelUsage[model].outputTokens += usage.output_tokens ?? 0;
          acc.modelUsage[model].cacheReadInputTokens += usage.cached_input_tokens ?? 0;
        }
        // No UI log — usage is tracked internally
        break;
      }

      case "turn.failed": {
        const error = (event.error as { message?: string })?.message ?? "Unknown error";
        events.push({ type: "log", message: `Codex turn failed: ${error}`, level: "error", ts });
        break;
      }

      case "item.started":
      case "item.updated":
      case "item.completed": {
        const item = event.item as ThreadItem | undefined;
        if (item) {
          events.push(...mapThreadItem(item, event.type as string, ts));
        }
        break;
      }

      case "error":
        events.push({ type: "log", message: `Codex error: ${event.message ?? "unknown"}`, level: "error", ts });
        break;

      default:
        events.push({ type: "log", message: `[codex:${event.type}] ${safeJson(event)}`, level: "info", ts });
        break;
    }

    return events;
  }

  /**
   * Map Codex ThreadItem to WorkRunEvents.
   * Field names match the real SDK types from @openai/codex-sdk.
   */
  function mapThreadItem(item: ThreadItem, eventType: string, ts: number): WorkRunEvent[] {
    const events: WorkRunEvent[] = [];
    const phase = eventType === "item.started" ? "start" : eventType === "item.completed" ? "complete" : "update";

    switch (item.type) {
      // ─── Agent text response ───
      case "agent_message": {
        // SDK: AgentMessageItem { text: string }
        const text = typeof item.text === "string" ? item.text : "";
        if (text && phase === "complete") {
          events.push({
            type: "artifact",
            kind: "report",
            content: text,
            metadata: { source: "agent_message", itemId: item.id },
          });
        }
        break;
      }

      // ─── Reasoning summary ───
      case "reasoning": {
        // SDK: ReasoningItem { text: string }
        const text = typeof item.text === "string" ? item.text : "";
        if (text && phase === "complete") {
          events.push({ type: "log", message: `[reasoning] ${text}`, level: "info", ts });
        }
        break;
      }

      // ─── Shell command execution ───
      case "command_execution": {
        // SDK: CommandExecutionItem { command, aggregated_output, exit_code?, status }
        const command = typeof item.command === "string" ? item.command : safeJson(item.command);
        const exitCode = item.exit_code as number | undefined;
        const output = typeof item.aggregated_output === "string" ? item.aggregated_output : undefined;
        const status = item.status as string | undefined;

        if (phase === "start") {
          events.push({
            type: "tool_call",
            toolName: "Bash",
            input: { command },
            startedAt: ts,
            metadata: { phase: "start", itemId: item.id, codexItemType: "command_execution" },
          });
        } else if (phase === "complete") {
          events.push({
            type: "tool_call",
            toolName: "Bash",
            input: { command },
            output: output ?? `exit code: ${exitCode ?? "unknown"}`,
            error: status === "failed" ? `Command failed with exit code ${exitCode}` : undefined,
            endedAt: ts,
            metadata: { phase: "complete", itemId: item.id, exitCode, codexItemType: "command_execution" },
          });
        }
        break;
      }

      // ─── File changes (patch) ───
      case "file_change": {
        // SDK: FileChangeItem { changes: FileUpdateChange[], status: "completed"|"failed" }
        // Note: Codex only emits item.completed for file_change (no item.started).
        // We emit both start + complete so runs.service can insert then update the tool_call row.
        const changes = item.changes as Array<{ path: string; kind: string }> | undefined;
        const patchStatus = item.status as string | undefined;

        if (phase === "complete" && changes && changes.length > 0) {
          for (const change of changes) {
            const toolName = change.kind === "delete" ? "Delete" : change.kind === "add" ? "Write" : "Edit";
            // Emit start (insert row)
            events.push({
              type: "tool_call",
              toolName,
              input: { path: change.path },
              startedAt: ts,
              metadata: { phase: "start", itemId: `${item.id}-${change.path}`, changeType: change.kind, codexItemType: "file_change" },
            });
            // Emit complete (update row)
            events.push({
              type: "tool_call",
              toolName,
              input: { path: change.path },
              output: `File ${change.kind}: ${change.path}`,
              error: patchStatus === "failed" ? "Patch failed" : undefined,
              endedAt: ts,
              metadata: { phase: "complete", itemId: `${item.id}-${change.path}`, changeType: change.kind, codexItemType: "file_change" },
            });
          }
        }
        break;
      }

      // ─── MCP tool calls ───
      case "mcp_tool_call": {
        // SDK: McpToolCallItem { server, tool, arguments, result?, error?, status }
        const server = typeof item.server === "string" ? item.server : "unknown";
        const tool = typeof item.tool === "string" ? item.tool : "unknown";
        const toolName = `mcp__${server}__${tool}`;
        const args = item.arguments as Record<string, unknown> | undefined;
        const result = item.result as unknown;
        const error = (item.error as { message?: string } | undefined)?.message;

        if (phase === "start") {
          events.push({
            type: "tool_call",
            toolName,
            input: args,
            startedAt: ts,
            metadata: { phase: "start", itemId: item.id, codexItemType: "mcp_tool_call" },
          });
        } else if (phase === "complete") {
          events.push({
            type: "tool_call",
            toolName,
            input: args,
            output: result,
            error,
            endedAt: ts,
            metadata: { phase: "complete", itemId: item.id, codexItemType: "mcp_tool_call" },
          });
        }
        break;
      }

      // ─── Web search ───
      case "web_search": {
        // SDK: WebSearchItem { id, type, query }
        // Codex only emits item.completed for web_search (no item.started).
        const query = typeof item.query === "string" ? item.query : "";
        if (phase === "complete" && query) {
          // Emit start + complete pair so runs.service inserts a tool_call row
          events.push({
            type: "tool_call",
            toolName: "WebSearch",
            input: { query },
            startedAt: ts,
            metadata: { phase: "start", itemId: item.id, codexItemType: "web_search" },
          });
          events.push({
            type: "tool_call",
            toolName: "WebSearch",
            input: { query },
            output: `Searched: ${query}`,
            endedAt: ts,
            metadata: { phase: "complete", itemId: item.id, codexItemType: "web_search" },
          });
        }
        break;
      }

      // ─── To-do list ───
      case "todo_list": {
        // SDK: TodoListItem { items: Array<{ text, completed }> }
        if (phase === "complete") {
          const todos = item.items as Array<{ text: string; completed: boolean }> | undefined;
          if (todos) {
            const summary = todos.map((t) => `${t.completed ? "[x]" : "[ ]"} ${t.text}`).join("\n");
            events.push({ type: "log", message: `[todo]\n${summary}`, level: "info", ts, metadata: { itemId: item.id } });
          }
        }
        break;
      }

      // ─── Error item ───
      case "error": {
        // SDK: ErrorItem { message }
        events.push({ type: "log", message: `[item_error] ${item.message ?? safeJson(item)}`, level: "error", ts, metadata: { itemId: item.id } });
        break;
      }

      default:
        if (phase === "complete") {
          events.push({ type: "log", message: `[codex:item:${item.type}] ${safeJson(item)}`, level: "info", ts });
        }
        break;
    }

    return events;
  }

  /** SDK input type: string or array of text/image items */
  type CodexInput = string | Array<{ type: "text"; text: string } | { type: "local_image"; path: string }>;

  /**
   * Build SDK input with context. Returns string when no images,
   * or UserInput[] when image attachments are present.
   */
  function buildInput(request: WorkRunRequest): CodexInput {
    const workspaceInfo = `Working directory: ${request.workspace.rootPath}`;
    let prompt: string;

    if (request.context && request.context.length > 0) {
      const contextParts = formatContextSection(request.context);
      prompt = `${workspaceInfo}\n\nContext:\n${contextParts}\n\n---\n\nGoal: ${request.goal}`;
    } else {
      prompt = `${workspaceInfo}\n\nGoal: ${request.goal}`;
    }

    // Append text-based sections (issues, signals, files, document attachments)
    prompt = appendPromptSections(prompt, {
      contextIssues: request.contextIssues,
      contextSignals: request.contextSignals,
      contextFiles: request.contextFiles,
      // Don't pass attachments here — we handle images natively below
      runId: request.runId,
    });

    // Extract image paths from attachments
    if (request.attachments && request.attachments.length > 0) {
      const { savedPaths, inlineTexts } = saveAttachments(request.attachments, request.runId);

      // Append inline text documents to prompt
      if (inlineTexts.length > 0) {
        prompt = `${prompt}\n\n---\n\nAttached documents:\n${inlineTexts.join("\n\n")}`;
      }

      // If we have saved image files, return UserInput[] format
      const imagePaths = savedPaths.filter((p) => {
        const ext = p.toLowerCase();
        return ext.endsWith(".png") || ext.endsWith(".jpg") || ext.endsWith(".jpeg") ||
               ext.endsWith(".gif") || ext.endsWith(".webp") || ext.endsWith(".bmp");
      });

      if (imagePaths.length > 0) {
        const input: CodexInput = [{ type: "text", text: prompt }];
        for (const imgPath of imagePaths) {
          input.push({ type: "local_image", path: imgPath });
        }
        return input;
      }
    }

    return prompt;
  }

  /**
   * Shared event processing loop for streamed turns
   */
  async function processStreamedEvents(
    streamed: StreamedTurn,
    runId: string,
    onEvent: WorkRunEventHandler,
    collectedArtifacts: Array<{ kind: string; path?: string }>,
  ): Promise<void> {
    for await (const event of streamed.events) {
      const runState = activeRuns.get(runId);
      if (runState?.aborted) break;

      const mappedEvents = mapThreadEvent(event, runId);
      for (const mapped of mappedEvents) {
        await onEvent(mapped);

        if (mapped.type === "artifact" && mapped.kind !== "user-prompt") {
          collectedArtifacts.push({ kind: mapped.kind, path: mapped.path });
        }

        if (mapped.type === "tool_call" && mapped.output && mapped.metadata?.phase === "complete") {
          const extracted = extractArtifactsFromToolOutput(mapped.toolName, mapped.output);
          for (const art of extracted) {
            await onEvent(art);
            if (art.type === "artifact") {
              collectedArtifacts.push({ kind: art.kind, path: art.path });
            }
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // WorkRunAdapter implementation
  // ─────────────────────────────────────────────────────────────

  return {
    async startRun(
      request: WorkRunRequest,
      onEvent: WorkRunEventHandler,
    ): Promise<WorkRunResult> {
      const { runId, model } = request;
      const timeout = config.timeout ?? 600000;
      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });

        const client = await ensureClient();

        const approvalPolicy = config.approvalMode ?? mapPermissionMode(config.permissionMode);
        const sandboxMode = config.sandboxMode ?? "workspace-write";

        const threadOptions: ThreadOptions = {
          workingDirectory: request.workspace.rootPath,
          model: model || config.defaultModel || undefined,
          approvalPolicy,
          sandboxMode,
          modelReasoningEffort: config.modelReasoningEffort,
          networkAccessEnabled: config.networkAccessEnabled,
          webSearchMode: config.webSearchMode,
          skipGitRepoCheck: config.skipGitRepoCheck,
          additionalDirectories: config.additionalDirectories,
        };

        const thread = client.startThread(threadOptions);
        const abortController = new AbortController();
        activeRuns.set(runId, { thread, aborted: false, abortController });

        await emitUserPromptArtifact(onEvent, request.goal, {
          attachments: request.attachments,
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
        });

        const prompt = buildInput(request);

        // Resolve structured output schema if configured
        const selectedSchemaId = (config as any).structuredOutputsSelectedId as string | undefined;
        const outputSchema = selectedSchemaId
          ? ((config as any).structuredOutputs as Record<string, { schema: Record<string, unknown> }> | undefined)?.[selectedSchemaId]?.schema
          : undefined;

        // runStreamed returns a Promise<StreamedTurn>
        const streamed = await thread.runStreamed(prompt, { signal: abortController.signal, outputSchema });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Codex run timed out after ${timeout}ms`)), timeout),
        );

        await Promise.race([
          processStreamedEvents(streamed, runId, onEvent, collectedArtifacts),
          timeoutPromise,
        ]);

        const aborted = activeRuns.get(runId)?.aborted ?? false;
        activeRuns.delete(runId);

        if (aborted) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });
          return { status: "canceled", artifacts: collectedArtifacts, usage: flushUsage(runId) };
        }

        await onEvent({ type: "status", status: "succeeded", ts: Date.now() });
        return {
          status: "succeeded",
          stopReason: "end_turn",
          artifacts: collectedArtifacts,
          usage: flushUsage(runId),
        };
      } catch (error) {
        activeRuns.delete(runId);
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(`Run ${runId} failed:`, errorMessage);

        await onEvent({ type: "log", message: `Codex run failed: ${errorMessage}`, level: "error", ts: Date.now() });
        await onEvent({ type: "status", status: "failed", error: errorMessage, ts: Date.now() });
        cancelPendingRequests(runId);

        return { status: "failed", summary: errorMessage, artifacts: collectedArtifacts, usage: flushUsage(runId) };
      }
    },

    async continueRun(
      request: WorkRunContinueRequest,
      onEvent: WorkRunEventHandler,
    ): Promise<WorkRunResult> {
      const { runId, message } = request;
      const timeout = config.timeout ?? 600000;
      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });

        const client = await ensureClient();

        const threadId = sessionIdMap.get(runId);
        if (!threadId) {
          throw new Error(`No session found for run ${runId}. Cannot resume.`);
        }

        const approvalPolicy = config.approvalMode ?? mapPermissionMode(config.permissionMode);
        const sandboxMode = config.sandboxMode ?? "workspace-write";

        const thread = client.resumeThread(threadId, {
          workingDirectory: request.workspace.rootPath,
          approvalPolicy,
          sandboxMode,
          modelReasoningEffort: config.modelReasoningEffort,
          networkAccessEnabled: config.networkAccessEnabled,
          webSearchMode: config.webSearchMode,
          skipGitRepoCheck: config.skipGitRepoCheck,
          additionalDirectories: config.additionalDirectories,
        });

        const abortController = new AbortController();
        activeRuns.set(runId, { thread, aborted: false, abortController });

        await emitUserPromptArtifact(onEvent, message, {
          attachments: request.attachments,
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
        });

        // Build input with image support for continue
        let continueInput: CodexInput = appendPromptSections(message, {
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
          runId: request.runId,
        });

        if (request.attachments && request.attachments.length > 0) {
          const { savedPaths, inlineTexts } = saveAttachments(request.attachments, request.runId);
          if (inlineTexts.length > 0) {
            continueInput = `${continueInput}\n\n---\n\nAttached documents:\n${inlineTexts.join("\n\n")}`;
          }
          const imagePaths = savedPaths.filter((p) => {
            const ext = p.toLowerCase();
            return ext.endsWith(".png") || ext.endsWith(".jpg") || ext.endsWith(".jpeg") ||
                   ext.endsWith(".gif") || ext.endsWith(".webp") || ext.endsWith(".bmp");
          });
          if (imagePaths.length > 0) {
            const arr: Array<{ type: "text"; text: string } | { type: "local_image"; path: string }> = [
              { type: "text", text: continueInput as string },
            ];
            for (const imgPath of imagePaths) {
              arr.push({ type: "local_image", path: imgPath });
            }
            continueInput = arr;
          }
        }

        // Resolve structured output schema if configured
        const selectedSchemaId = (config as any).structuredOutputsSelectedId as string | undefined;
        const outputSchema = selectedSchemaId
          ? ((config as any).structuredOutputs as Record<string, { schema: Record<string, unknown> }> | undefined)?.[selectedSchemaId]?.schema
          : undefined;

        const streamed = await thread.runStreamed(continueInput, { signal: abortController.signal, outputSchema });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Codex continuation timed out after ${timeout}ms`)), timeout),
        );

        await Promise.race([
          processStreamedEvents(streamed, runId, onEvent, collectedArtifacts),
          timeoutPromise,
        ]);

        const aborted = activeRuns.get(runId)?.aborted ?? false;
        activeRuns.delete(runId);

        if (aborted) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });
          return { status: "canceled", artifacts: collectedArtifacts, usage: flushUsage(runId) };
        }

        await onEvent({ type: "status", status: "succeeded", ts: Date.now() });
        return { status: "succeeded", stopReason: "end_turn", artifacts: collectedArtifacts, usage: flushUsage(runId) };
      } catch (error) {
        activeRuns.delete(runId);
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(`Continue run ${runId} failed:`, errorMessage);
        await onEvent({ type: "status", status: "failed", error: errorMessage, ts: Date.now() });
        cancelPendingRequests(runId);
        return { status: "failed", summary: errorMessage, artifacts: collectedArtifacts, usage: flushUsage(runId) };
      }
    },

    async abortRun(runId: string): Promise<void> {
      const runState = activeRuns.get(runId);
      if (runState) {
        runState.aborted = true;
        runState.abortController?.abort();
        logInfo(`Aborting run ${runId}`);
      }
      cancelPendingRequests(runId);
    },

    async canResumeSession(runId: string): Promise<boolean> {
      return sessionIdMap.has(runId);
    },

    async deleteSession(runId: string): Promise<void> {
      sessionIdMap.delete(runId);
    },

    async shutdown(): Promise<void> {
      activeRuns.clear();
      sessionIdMap.clear();
      usageAccumulator.clear();
      codexClient = null;
      clientInitPromise = null;
      initError = null;
      logInfo("Adapter shut down");
    },

    async listModels(): Promise<ModelInfo[]> {
      // Codex SDK doesn't expose a model listing API.
      // These models were verified by testing against the Codex CLI with ChatGPT auth.
      const codexEffortLevels: ("minimal" | "low" | "medium" | "high" | "xhigh")[] = [
        "minimal", "low", "medium", "high", "xhigh",
      ];

      const models: ModelInfo[] = [
        {
          id: "gpt-5.4",
          displayName: "GPT-5.4",
          isDefault: true,
          capabilities: { streaming: true, functionCalling: true, reasoning: true },
          supportsEffort: true,
          supportedEffortLevels: codexEffortLevels,
          description: "Flagship model — strongest reasoning and agentic workflows",
        },
        {
          id: "gpt-5.4-mini",
          displayName: "GPT-5.4 Mini",
          capabilities: { streaming: true, functionCalling: true, reasoning: true },
          supportsEffort: true,
          supportedEffortLevels: codexEffortLevels,
          description: "Fast mini model for responsive coding",
        },
        {
          id: "gpt-5.3-codex",
          displayName: "GPT-5.3 Codex",
          capabilities: { streaming: true, functionCalling: true, reasoning: true },
          supportsEffort: true,
          supportedEffortLevels: codexEffortLevels,
          description: "Optimized for complex software engineering",
        },
        {
          id: "gpt-5.2-codex",
          displayName: "GPT-5.2 Codex",
          capabilities: { streaming: true, functionCalling: true, reasoning: true },
          supportsEffort: true,
          supportedEffortLevels: codexEffortLevels,
          description: "Code-focused model",
        },
        {
          id: "gpt-5.2",
          displayName: "GPT-5.2",
          capabilities: { streaming: true, functionCalling: true, reasoning: true },
          supportsEffort: true,
          supportedEffortLevels: codexEffortLevels,
          description: "General-purpose model",
        },
        {
          id: "gpt-5.1-codex-max",
          displayName: "GPT-5.1 Codex Max",
          capabilities: { streaming: true, functionCalling: true, reasoning: true },
          supportsEffort: true,
          supportedEffortLevels: codexEffortLevels,
          description: "Extended reasoning code model",
        },
        {
          id: "gpt-5.1-codex-mini",
          displayName: "GPT-5.1 Codex Mini",
          capabilities: { streaming: true, functionCalling: true, reasoning: true },
          supportsEffort: true,
          supportedEffortLevels: codexEffortLevels,
          description: "Lightweight code-focused model",
        },
      ];

      // Mark the configured default
      if (config.defaultModel) {
        for (const m of models) {
          m.isDefault = m.id === config.defaultModel;
        }
      }

      return models;
    },

    async generateTitle(goal: string, context?: import("./adapter.types").WorkRunContextItem[]): Promise<string> {
      try {
        const client = await ensureClient();

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
          "RULES: Reply with ONLY the title. No quotes, no explanation, no punctuation at the end, no prefixes like 'Title:'.",
          "",
          `User's request: ${goal}`,
          contextSnippet ? `\nContext:\n${contextSnippet}` : "",
          "",
          "Title:",
        ].filter(Boolean).join("\n");

        const thread = client.startThread({
          model: "gpt-5.4-mini",
          approvalPolicy: "never",
          sandboxMode: "read-only",
        });

        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), 15000);

        try {
          const turn = await thread.run(titlePrompt, { signal: abortController.signal });
          clearTimeout(timeout);

          const titleText = turn.finalResponse || "";
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
        } catch {
          clearTimeout(timeout);
          throw new Error("Title generation failed");
        }
      } catch (error) {
        logError("generateTitle failed:", error);
        // Fallback: truncate goal
        return goal.length > 40 ? `${goal.substring(0, 37)}...` : goal;
      }
    },
  };
}
