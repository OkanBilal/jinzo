// ─────────────────────────────────────────────────────────────
// Claude Agent SDK Adapter
// Implements WorkRunAdapter using Claude Agent SDK (stable API)
// ─────────────────────────────────────────────────────────────

import path from "node:path";
import type {
  WorkRunAdapter,
  WorkRunRequest,
  WorkRunContinueRequest,
  WorkRunResult,
  WorkRunEventHandler,
  WorkRunEvent,
  ClaudeCodeAdapterConfig,
  ModelInfo,
} from "./adapter.types";
import { B } from "node_modules/@linear/sdk/dist/index-BBxdiqQK.mjs";

/**
 * NOTE: This adapter uses @anthropic-ai/claude-agent-sdk package.
 * The SDK spawns the Claude Code CLI as a subprocess.
 */

// SDK types (from @anthropic-ai/claude-agent-sdk)
interface SDKOptions {
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
  agents?: Record<string, AgentDefinition>[];
  maxTurns?: number;
  systemPrompt?: string | { type: "preset"; preset: "claude_code"; append?: string };
}

type AgentDefinition = {
  description: string;
  tools?: string[];
  prompt: string;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
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
    content: Array<{ type: string; text?: string }>;
  };
  parent_tool_use_id: string | null;
}

interface SDKResultMessage {
  type: "result";
  subtype: "success" | "error_during_execution" | "error_max_turns" | "error_max_budget_usd";
  uuid: string;
  session_id: string;
  duration_ms: number;
  is_error: boolean;
  num_turns: number;
  result?: string;
  total_cost_usd: number;
  errors?: string[];
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

type SDKMessage = SDKAssistantMessage | SDKUserMessage | SDKResultMessage | SDKSystemMessage | {
  type: string;
  session_id?: string;
  [key: string]: unknown;
};

interface SDKQuery extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  supportedModels(): Promise<Array<{ value: string; displayName: string; description: string }>>;
  accountInfo(): Promise<{ email?: string; organization?: string }>;
}

// Active run tracking for abort support
const activeRuns = new Map<
  string,
  { abortController: AbortController; aborted: boolean; sessionId?: string }
>();

// Session ID tracking for resume capability
const sessionIdMap = new Map<string, string>();

// Cached CLI path
let cachedCliPath: string | null = null;

/**
 * Find the Claude CLI binary path
 * The SDK needs the path to the installed `claude` command
 */
function findClaudeBinary(): string | null {
  if (cachedCliPath) {
    return cachedCliPath;
  }

  const fs = require("fs");
  const os = require("os");
  const homeDir = os.homedir();

  // Check the Anthropic installer's versioned directory first
  // This contains the actual binaries (not symlinks)
  const versionsDir = path.join(homeDir, ".local", "share", "claude", "versions");
  try {
    if (fs.existsSync(versionsDir)) {
      const versions = fs.readdirSync(versionsDir);
      if (versions.length > 0) {
        // Sort versions and get the latest
        const sortedVersions = versions.sort((a: string, b: string) => {
          // Compare version strings numerically
          const aParts = a.split(".").map(Number);
          const bParts = b.split(".").map(Number);
          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aVal = aParts[i] || 0;
            const bVal = bParts[i] || 0;
            if (aVal !== bVal) return bVal - aVal; // Descending order
          }
          return 0;
        });
        const latestVersion = sortedVersions[0];
        const binPath = path.join(versionsDir, latestVersion);
        if (fs.existsSync(binPath)) {
          console.log("[ClaudeAdapter] Found Claude CLI version:", latestVersion, "at:", binPath);
          cachedCliPath = binPath;
          return binPath;
        }
      }
    }
  } catch (e) {
    console.log("[ClaudeAdapter] Error checking versions dir:", e);
  }

  // Common installation locations for Claude CLI
  const possiblePaths = [
    // User's local bin (common for npm global installs and Anthropic installer)
    path.join(homeDir, ".local", "bin", "claude"),
    // macOS Homebrew
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    // Linux
    "/usr/bin/claude",
    // npm global (varies by system)
    path.join(homeDir, ".npm-global", "bin", "claude"),
  ];

  for (const binPath of possiblePaths) {
    try {
      if (fs.existsSync(binPath)) {
        // Resolve symlinks to get the actual binary path
        const realPath = fs.realpathSync(binPath);
        console.log("[ClaudeAdapter] Found Claude CLI at:", binPath, "->", realPath);
        cachedCliPath = realPath;
        return realPath;
      }
    } catch {
      // Continue checking other paths
    }
  }

  console.log("[ClaudeAdapter] Claude CLI not found in common locations");
  return null;
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
  let queryFn: ((options: { prompt: string; options?: SDKOptions }) => SDKQuery) | null = null;

  // Correlate tool events when toolName/input is missing in completion events
  const toolCallIndex = new Map<
    string,
    { toolName: string; input?: unknown; startedAt?: number }
  >();

  /**
   * Lazily load the Claude Agent SDK
   */
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
        console.log("[ClaudeAdapter] SDK not found");
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
      console.log("[ClaudeAdapter] SDK loaded successfully (stable API)");
    } catch (error) {
      loadError = error instanceof Error ? error : new Error(String(error));
      console.error("[ClaudeAdapter] Failed to load SDK:", loadError.message);
      throw loadError;
    }
  }

  /**
   * Get the model to use, with fallback to default
   */
  function getModel(requestModel?: string | null): string {
    return requestModel || config.defaultModel || "claude-sonnet-4-5-20250929";
  }

  /**
   * Build SDK options with proper executable path
   */
  function buildOptions(
    model: string,
    workspacePath?: string,
    abortController?: AbortController,
    resumeSessionId?: string,
  ): SDKOptions {
    const options: SDKOptions = {
      model,
      permissionMode: "acceptEdits", // Auto-accept edits for agent workflows
      abortController,
    };

    // Find the Claude CLI binary
    const binaryPath = config.binary || findClaudeBinary();
    if (binaryPath) {
      options.pathToClaudeCodeExecutable = binaryPath;
      console.log("[ClaudeAdapter] Using Claude CLI at:", binaryPath);
    } else {
      console.warn(
        "[ClaudeAdapter] Claude CLI not found. The SDK will try to find it in PATH.",
      );
    }

    if (workspacePath) {
      options.cwd = workspacePath;
    }

    if (resumeSessionId) {
      options.resume = resumeSessionId;
    }

    return options;
  }

  /**
   * Map Claude SDK messages to our WorkRunEvent type
   */
  function mapSDKMessage(
    msg: SDKMessage,
    runId: string,
  ): WorkRunEvent[] {
    const events: WorkRunEvent[] = [];
    const ts = Date.now();

    switch (msg.type) {
      case "assistant": {
        // Assistant message with content blocks
        const assistantMsg = msg as SDKAssistantMessage;
        if (assistantMsg.message?.content) {
          for (const block of assistantMsg.message.content) {
            if (block.type === "text" && block.text) {
              // Emit text as artifact/report
              events.push({
                type: "artifact",
                kind: "report",
                content: block.text,
                metadata: { source: "assistant.text", session_id: assistantMsg.session_id },
              });
            } else if (block.type === "tool_use" && block.name) {
              // Tool call start
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
                },
              });
            }
          }
        }
        break;
      }

      case "user": {
        // User messages are typically echoed back - log them
        events.push({
          type: "log",
          message: `[user] Message sent`,
          level: "info",
          ts,
        });
        break;
      }

      case "system": {
        const systemMsg = msg as SDKSystemMessage;
        if (systemMsg.subtype === "init") {
          events.push({
            type: "log",
            message: `[system] Session initialized with model: ${systemMsg.model || "unknown"}`,
            level: "info",
            ts,
          });
        }
        break;
      }

      case "result": {
        // Final result - emit as artifact
        const resultMsg = msg as SDKResultMessage;
        if (resultMsg.result) {
          events.push({
            type: "artifact",
            kind: "report",
            content: String(resultMsg.result),
            metadata: {
              source: "result",
              session_id: resultMsg.session_id,
              duration_ms: resultMsg.duration_ms,
              total_cost_usd: resultMsg.total_cost_usd,
            },
          });
        }
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

  /**
   * Extract artifacts from tool outputs
   */
  function extractArtifactsFromToolOutput(
    toolName: string,
    output: unknown,
  ): WorkRunEvent[] {
    const artifacts: WorkRunEvent[] = [];

    // Handle common file-writing tools
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
      const timeout = config.timeout ?? 300000; // 5 minutes default

      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];
      const abortController = new AbortController();

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });
        await onEvent({
          type: "log",
          message: `Starting Claude run in workspace: ${request.workspace.rootPath}`,
          level: "info",
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
        );

        await onEvent({
          type: "log",
          message: `Creating Claude query with model: ${options.model}`,
          level: "info",
          ts: Date.now(),
        });

        activeRuns.set(runId, { abortController, aborted: false });

        const prompt = buildPrompt(request);

        await onEvent({
          type: "log",
          message: `Sending prompt to Claude (${prompt.length} chars)`,
          level: "info",
          ts: Date.now(),
        });

        // Create the query
        const query = queryFn({ prompt, options });

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
                  activeRuns.set(runId, { ...state, sessionId });
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
            artifacts: collectedArtifacts,
          };
        }

        await onEvent({ type: "status", status: "succeeded", ts: Date.now() });

        return {
          status: "succeeded",
          summary: "Completed successfully",
          artifacts: collectedArtifacts,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

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
            artifacts: collectedArtifacts,
          };
        }

        // Check for abort
        if (errorMessage.includes("aborted") || abortController.signal.aborted) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });

          return {
            status: "canceled",
            summary: "Run was aborted",
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
      const timeout = config.timeout ?? 300000;

      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];
      const abortController = new AbortController();

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });
        await onEvent({
          type: "log",
          message: `Resuming Claude session for run: ${runId}`,
          level: "info",
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
        );

        activeRuns.set(runId, { abortController, aborted: false, sessionId });

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

        await onEvent({
          type: "log",
          message: `Sending follow-up message (${prompt.length} chars)`,
          level: "info",
          ts: Date.now(),
        });

        // Create the query with resume
        const query = queryFn({ prompt, options });

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
            artifacts: collectedArtifacts,
          };
        }

        await onEvent({ type: "status", status: "succeeded", ts: Date.now() });

        return {
          status: "succeeded",
          summary: "Completed successfully",
          artifacts: collectedArtifacts,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

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
            artifacts: collectedArtifacts,
          };
        }

        // Check for abort
        if (errorMessage.includes("aborted") || abortController.signal.aborted) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });

          return {
            status: "canceled",
            summary: "Run was aborted",
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
          artifacts: collectedArtifacts,
        };
      } finally {
        activeRuns.delete(runId);
      }
    },

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
          console.error("[ClaudeAdapter] Error aborting run:", err);
        }
        activeRuns.delete(runId);
      }

      console.log(`[ClaudeAdapter] Deleted session tracking for run: ${runId}`);
    },

    async abortRun(runId: string): Promise<void> {
      const runState = activeRuns.get(runId);
      if (runState) {
        runState.aborted = true;
        try {
          runState.abortController.abort();
        } catch (err) {
          console.error("[ClaudeAdapter] Error aborting run:", err);
        }
      }
    },

    async shutdown(): Promise<void> {
      // Mark all runs as aborted first
      for (const [runId, state] of activeRuns) {
        state.aborted = true;
        try {
          state.abortController.abort();
        } catch {
          // Ignore abort errors
        }
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

      console.log("[ClaudeAdapter] Shutdown complete");
    },

    async listModels(): Promise<ModelInfo[]> {
      // Claude models are not dynamically listed from the SDK
      // Return the known models with their capabilities
      return getDefaultModels(config.defaultModel);
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
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
      id: "claude-3-5-sonnet-20241022",
      displayName: "Claude Sonnet 3.5",
      isDefault: defaultModel === "claude-3-5-sonnet-20241022",
      capabilities: {
        streaming: true,
        vision: true,
        functionCalling: true,
      },
      contextWindow: 200000,
    },
    {
      id: "claude-3-5-haiku-20241022",
      displayName: "Claude Haiku 3.5",
      isDefault: defaultModel === "claude-3-5-haiku-20241022",
      capabilities: {
        streaming: true,
        vision: true,
        functionCalling: true,
      },
      contextWindow: 200000,
    },
    {
      id: "claude-3-opus-20240229",
      displayName: "Claude Opus 3.5",
      isDefault: defaultModel === "claude-3-opus-20240229",
      capabilities: {
        streaming: true,
        vision: true,
        functionCalling: true,
      },
      contextWindow: 200000,
    },
  ];

  return models;
}
