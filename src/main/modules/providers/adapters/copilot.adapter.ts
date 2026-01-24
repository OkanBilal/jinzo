// ─────────────────────────────────────────────────────────────
// Copilot SDK Adapter
// Implements WorkRunAdapter using GitHub Copilot SDK
// ─────────────────────────────────────────────────────────────

import type {
  WorkRunAdapter,
  WorkRunRequest,
  WorkRunResult,
  WorkRunEventHandler,
  WorkRunEvent,
  CopilotAdapterConfig,
} from "./adapter.types";

/**
 * NOTE: This adapter is designed for the @github/copilot-sdk package.
 * The SDK API is based on the technical preview documentation.
 * Some types and interfaces may need adjustment when the actual package is integrated.
 *
 * The implementation below uses dynamic imports and type assertions
 * to allow the code to compile without the actual SDK installed.
 */

// Types inferred from Copilot SDK documentation
interface CopilotClientOptions {
  cliPath?: string;
  cliArgs?: string[];
  cliUrl?: string;
  port?: number;
  useStdio?: boolean;
  logLevel?: "debug" | "info" | "error" | "none" | "warning" | "all";
  autoStart?: boolean;
  autoRestart?: boolean;
}

interface SessionConfig {
  sessionId?: string;
  model?: string;
  systemMessage?: { content: string };
  streaming?: boolean;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

interface CopilotClientInterface {
  start(): Promise<void>;
  stop(): Promise<Error[]>;
  forceStop(): Promise<void>;
  createSession(config?: SessionConfig): Promise<CopilotSession>;
  ping(message?: string): Promise<{ message: string; timestamp: number }>;
}

// Active run tracking for abort support
const activeRuns = new Map<
  string,
  { session: CopilotSession; aborted: boolean }
>();

/**
 * Creates a Copilot SDK adapter instance
 */
export function createCopilotAdapter(
  config: CopilotAdapterConfig,
): WorkRunAdapter {
  let client: CopilotClientInterface | null = null;
  let clientInitPromise: Promise<void> | null = null;
  let initError: Error | null = null;

  // Correlate tool events when toolName/input is missing in completion events
  const toolCallIndex = new Map<
    string,
    { toolName: string; input?: unknown; startedAt?: number }
  >();

  /**
   * Lazily initialize the Copilot client
   */
  async function ensureClient(): Promise<CopilotClientInterface> {
    if (initError) {
      throw initError;
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
        const CopilotSDK = await import("@github/copilot-sdk").catch(
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

        const options: CopilotClientOptions = {
          autoStart: true,
          autoRestart: config.autoRestart ?? true,
          logLevel: config.logLevel ?? "info",
        } satisfies CopilotClientOptions;

        if (config.binary) {
          options.cliPath = config.binary;
        }

        if (config.cliUrl) {
          options.cliUrl = config.cliUrl;
        } else if (config.transport === "tcp" && config.port) {
          options.port = config.port;
          options.useStdio = false;
        } else {
          options.useStdio = true;
        }

        client = new CopilotClient(options) as CopilotClientInterface;
        await client.start();

        // Verify connectivity
        await client.ping("init");

        console.log("[CopilotAdapter] Client initialized successfully");
      } catch (error) {
        initError = error instanceof Error ? error : new Error(String(error));
        console.error(
          "[CopilotAdapter] Failed to initialize client:",
          initError.message,
        );
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

    if (isEphemeral(event)) return null;

    const payload = getPayload(event);

    switch (event.type) {
      // ─────────────── Ignore noisy flow markers
      case "pending_messages.modified":
      case "assistant.turn_start":
      case "assistant.turn_end":
      case "session.usage_info":
        return null;

      // ─────────────── Usage telemetry (keep debug)
      case "assistant.usage":
        return {
          type: "log",
          message: `[usage] ${safeJson(payload)}`,
          level: "info",
          ts,
        };

      // ─────────────── Assistant content (best-effort)
      case "assistant.message":
        // Treat as a report artifact to ensure we actually persist "final" output
        return {
          type: "artifact",
          kind: "report",
          content: String((payload as any)?.content ?? event.content ?? ""),
          metadata: { source: "assistant.message" },
        };

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
          event.toolInput;

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
          prev?.input ??
          event.toolInput;

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
        // Reduce spam: debug log only, keep payload for future mapping
        return {
          type: "log",
          message: `[event] ${event.type}: ${safeJson(payload)}`,
          level: "warn",
          ts,
        };
    }
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
      toolName === "write_file" ||
      toolName === "edit_file" ||
      toolName === "create_file"
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

    // Handle shell/command tools (Copilot often returns {content, displayContent})
    if (
      toolName === "shell" ||
      toolName === "terminal" ||
      toolName === "run_command" ||
      toolName === "execute_shell" ||
      toolName === "bash" ||
      toolName === "command_result"
    ) {
      const out = output as any;

      const text =
        typeof out?.displayContent === "string"
          ? out.displayContent
          : typeof out?.content === "string"
            ? out.content
            : typeof out === "string"
              ? out
              : undefined;

      // try to parse exit code from common suffix
      const exitCode =
        typeof out?.exitCode === "number" ? out.exitCode : parseExitCode(text);

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
      const { runId, model, systemPrompt } = request;
      const timeout = config.timeout ?? 300000; // 5 minutes default

      let session: CopilotSession | null = null;
      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });
        await onEvent({
          type: "log",
          message: `Starting Copilot run: ${runId}`,
          level: "info",
          ts: Date.now(),
        });

        const copilotClient = await ensureClient();

        const sessionConfig: SessionConfig = {
          sessionId: runId,
          streaming: true,
        };

        if (model || config.defaultModel) {
          sessionConfig.model = model || config.defaultModel;
        }

        if (systemPrompt) {
          sessionConfig.systemMessage = { content: systemPrompt };
        }

        session = await copilotClient.createSession(sessionConfig);
        activeRuns.set(runId, { session, aborted: false });

        const unsubscribe = session.on((event: SessionEvent) => {
          const runState = activeRuns.get(runId);
          if (runState?.aborted) return;

          if (isEphemeral(event)) return;

          const mappedEvent = mapSessionEvent(event, runId);
          if (mappedEvent) {
            Promise.resolve(onEvent(mappedEvent)).catch((err) => {
              console.error("[CopilotAdapter] Error in event handler:", err);
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
                    console.error(
                      "[CopilotAdapter] Error emitting artifact:",
                      err,
                    );
                  });

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
        });

        const prompt = buildPrompt(request);

        await onEvent({
          type: "log",
          message: `Sending prompt to Copilot (${prompt.length} chars)`,
          level: "info",
          ts: Date.now(),
        });

        const result = await session.sendAndWait({ prompt }, timeout);

        unsubscribe();

        const runState = activeRuns.get(runId);
        if (runState?.aborted) {
          await onEvent({ type: "status", status: "canceled", ts: Date.now() });

          return {
            status: "canceled",
            summary: "Run was aborted by user",
            artifacts: collectedArtifacts,
          };
        }

        // Emit a best-effort final report artifact from sendAndWait result
        const finalText =
          (result as any)?.content ??
          (result as any)?.output ??
          (result as any)?.data?.content ??
          (result as any)?.data?.output ??
          "";

        if (finalText) {
          await onEvent({
            type: "artifact",
            kind: "report",
            content: String(finalText),
            metadata: { source: "sendAndWait" },
          });
          collectedArtifacts.push({ kind: "report" });
        }

        await onEvent({ type: "status", status: "succeeded", ts: Date.now() });

        return {
          status: "succeeded",
          summary: finalText || "Completed successfully",
          artifacts: collectedArtifacts,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

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

        if (session) {
          try {
            await session.destroy();
          } catch (err) {
            console.error("[CopilotAdapter] Error destroying session:", err);
          }
        }
      }
    },

    async abortRun(runId: string): Promise<void> {
      const runState = activeRuns.get(runId);
      if (runState) {
        runState.aborted = true;
        try {
          await runState.session.abort();
        } catch (err) {
          console.error("[CopilotAdapter] Error aborting session:", err);
        }
      }
    },

    async shutdown(): Promise<void> {
      for (const [runId, state] of activeRuns) {
        state.aborted = true;
        try {
          await state.session.abort();
          await state.session.destroy();
        } catch (err) {
          console.error(
            `[CopilotAdapter] Error cleaning up run ${runId}:`,
            err,
          );
        }
      }
      activeRuns.clear();
      toolCallIndex.clear();

      if (client) {
        try {
          await client.stop();
        } catch (err) {
          console.error("[CopilotAdapter] Error stopping client:", err);
          try {
            await client.forceStop();
          } catch (forceErr) {
            console.error(
              "[CopilotAdapter] Error force stopping client:",
              forceErr,
            );
          }
        }
        client = null;
      }

      clientInitPromise = null;
      initError = null;
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

function parseExitCode(text?: string): number | undefined {
  if (!text) return undefined;
  const m = text.match(/exited with exit code\s+(\d+)/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}
