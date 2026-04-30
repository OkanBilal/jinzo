// ─────────────────────────────────────────────────────────────
// Cursor ACP Adapter
// Implements WorkRunAdapter using `cursor acp` JSON-RPC 2.0 over stdio
// ─────────────────────────────────────────────────────────────

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  WorkRunAdapter,
  WorkRunRequest,
  WorkRunContinueRequest,
  WorkRunResult,
  WorkRunUsage,
  WorkRunEventHandler,
  WorkRunEvent,
  CursorAdapterConfig,
  ModelInfo,
} from "./adapter.types";
import {
  cancelPendingRequests,
  requestToolApproval,
} from "../../runs/user-input-broker";
import { runsRepo } from "../../runs/runs.repo";
import {
  createLogger,
  appendPromptSections,
  emitUserPromptArtifact,
  saveAttachments,
  formatContextSection,
} from "./adapter.shared";
import { MainsMcpStdioServer } from "./mains-mcp-server";
import type { MainsToolContext } from "./mains-tools.core";

// ─────────────────────────────────────────────────────────────
// JSON-RPC Types
// ─────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc?: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

interface JsonRpcNotification {
  jsonrpc?: "2.0";
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc?: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function isServerRequest(msg: unknown): msg is JsonRpcRequest {
  return typeof msg === "object" && msg !== null && "method" in msg && "id" in msg;
}

function isServerNotification(msg: unknown): msg is JsonRpcNotification {
  return typeof msg === "object" && msg !== null && "method" in msg && !("id" in msg);
}

function isResponse(msg: unknown): msg is JsonRpcResponse {
  return typeof msg === "object" && msg !== null && "id" in msg && !("method" in msg);
}

// ─────────────────────────────────────────────────────────────
// Active run state
// ─────────────────────────────────────────────────────────────

interface RunState {
  sessionId: string | null;
  aborted: boolean;
  agentMessageBuffer: string;
  /** Accumulated Cursor agent_thought_chunk text — streamed ephemerally only (not persisted). */
  agentThoughtBuffer: string;
  currentStreamId: string | null;
  pendingFlush: WorkRunEvent[];
}

const activeRuns = new Map<string, RunState>();

// Session ID mapping: runId → cursor sessionId (for resume)
const sessionIdMap = new Map<string, string>();

const { info: logInfo, error: logError, warn: logWarn } = createLogger("[CursorAdapter]");

// ─────────────────────────────────────────────────────────────
// ACP Server Process Manager
// ─────────────────────────────────────────────────────────────

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

class CursorAcpServer {
  private child: ChildProcess | null = null;
  private nextId = 1;
  private pendingRequests = new Map<number | string, PendingRequest>();
  private notificationHandler: ((method: string, params: unknown) => void) | null = null;
  private serverRequestHandler: ((id: number | string, method: string, params: unknown) => void) | null = null;
  private onClose: (() => void) | null = null;
  private stderrBuffer = "";
  private jsonBuffer = "";

  async start(binaryPath: string, env?: Record<string, string>): Promise<void> {
    if (this.child) return;

    const spawnEnv: Record<string, string | undefined> = {
      ...process.env,
      ...env,
    };

    this.child = spawn(binaryPath, ["acp"], {
      env: spawnEnv,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    if (!this.child.stdout || !this.child.stdin) {
      throw new Error("Failed to get stdio pipes from cursor acp");
    }

    this.child.stdout.on("data", (chunk: Buffer) => {
      this.jsonBuffer += chunk.toString();
      this.drainJsonBuffer();
      // Guard: cap unbounded buffer growth on malformed output.
      if (this.jsonBuffer.length > 32 * 1024 * 1024) {
        logError(
          `jsonBuffer exceeded 32MB (${this.jsonBuffer.length} bytes), resetting`,
        );
        this.jsonBuffer = "";
      }
    });

    this.child.stderr?.on("data", (data: Buffer) => {
      this.stderrBuffer += data.toString();
      if (this.stderrBuffer.length > 2048) {
        this.stderrBuffer = this.stderrBuffer.slice(-2048);
      }
    });

    this.child.on("close", (code, signal) => {
      const tail = this.stderrBuffer.trim();
      logInfo(`ACP process exited code=${code} signal=${signal ?? "none"}${tail ? ` stderr:\n${tail}` : " (no stderr)"}`);
      for (const [, pending] of this.pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`ACP server exited (code=${code}, signal=${signal ?? "none"})`));
      }
      this.pendingRequests.clear();
      this.cleanup();
      this.onClose?.();
    });

    this.child.on("error", (err) => {
      logError("ACP process error:", err.message);
      this.cleanup();
    });
  }

  setNotificationHandler(handler: (method: string, params: unknown) => void): void {
    this.notificationHandler = handler;
  }

  setServerRequestHandler(handler: (id: number | string, method: string, params: unknown) => void): void {
    this.serverRequestHandler = handler;
  }

  setOnClose(handler: () => void): void {
    this.onClose = handler;
  }

  async sendRequest(method: string, params?: unknown, timeoutMs = 30000): Promise<unknown> {
    if (!this.child?.stdin) {
      throw new Error("ACP server not running");
    }

    const reqId = this.nextId++;
    const message: JsonRpcRequest = { jsonrpc: "2.0", id: reqId, method, ...(params !== undefined ? { params } : {}) };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error(`RPC timeout: ${method} (${timeoutMs}ms)`));
      }, timeoutMs);

      this.pendingRequests.set(reqId, { resolve, reject, timer });
      this.writeMessage(message);
    });
  }

  respondToRequest(id: number | string, result: unknown): void {
    this.writeMessage({ jsonrpc: "2.0", id, result });
  }

  respondToRequestError(id: number | string, code: number, message: string): void {
    this.writeMessage({ jsonrpc: "2.0", id, error: { code, message } });
  }

  sendNotification(method: string, params?: unknown): void {
    this.writeMessage({ jsonrpc: "2.0", method, ...(params !== undefined ? { params } : {}) });
  }

  get isRunning(): boolean {
    return this.child !== null && this.child.exitCode === null;
  }

  async stop(): Promise<void> {
    if (!this.child) return;

    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("ACP server stopping"));
    }
    this.pendingRequests.clear();

    const child = this.child;
    this.cleanup();

    try {
      child.stdin?.end();
      try { child.kill("SIGTERM"); } catch { /* already exited */ }
      await new Promise<void>((resolve) => {
        const killTimer = setTimeout(() => {
          try { child.kill("SIGKILL"); } catch { /* already exited */ }
          resolve();
        }, 500);
        child.on("close", () => {
          clearTimeout(killTimer);
          resolve();
        });
      });
    } catch {
      child.kill("SIGKILL");
    }
  }

  private writeMessage(message: unknown): void {
    if (!this.child?.stdin) return;
    const encoded = JSON.stringify(message);
    this.child.stdin.write(`${encoded}\n`);
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }

    if (isResponse(parsed)) {
      const pending = this.pendingRequests.get(parsed.id);
      if (pending) {
        this.pendingRequests.delete(parsed.id);
        clearTimeout(pending.timer);
        if (parsed.error) {
          pending.reject(new Error(`${parsed.error.message} (code: ${parsed.error.code})`));
        } else {
          pending.resolve(parsed.result);
        }
      }
    } else if (isServerRequest(parsed)) {
      this.serverRequestHandler?.(parsed.id, parsed.method, parsed.params);
    } else if (isServerNotification(parsed)) {
      this.notificationHandler?.(parsed.method, parsed.params);
    }
  }

  /**
   * Drain the JSON buffer: extract complete JSON objects using brace-depth counting.
   */
  private drainJsonBuffer(): void {
    while (this.jsonBuffer.length > 0) {
      const trimStart = this.jsonBuffer.search(/\S/);
      if (trimStart === -1) {
        this.jsonBuffer = "";
        return;
      }
      if (trimStart > 0) {
        this.jsonBuffer = this.jsonBuffer.slice(trimStart);
      }

      if (this.jsonBuffer[0] !== "{") {
        const nextBrace = this.jsonBuffer.indexOf("{", 1);
        if (nextBrace === -1) {
          this.jsonBuffer = "";
          return;
        }
        this.jsonBuffer = this.jsonBuffer.slice(nextBrace);
        continue;
      }

      let depth = 0;
      let inString = false;
      let escaped = false;
      let endIdx = -1;

      for (let i = 0; i < this.jsonBuffer.length; i++) {
        const ch = this.jsonBuffer[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          if (inString) escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }

      if (endIdx === -1) {
        return;
      }

      const jsonStr = this.jsonBuffer.slice(0, endIdx + 1);
      this.jsonBuffer = this.jsonBuffer.slice(endIdx + 1);

      this.handleLine(jsonStr);
    }
  }

  private cleanup(): void {
    this.child = null;
    this.jsonBuffer = "";
  }
}

// ─────────────────────────────────────────────────────────────
// Adapter factory
// ─────────────────────────────────────────────────────────────

export function createCursorAdapter(config: CursorAdapterConfig): WorkRunAdapter {
  let acpServer: CursorAcpServer | null = null;
  let mcpServer: MainsMcpStdioServer | null = null;

  /**
   * Set up the MCP server (bridge + config file).
   * ACP does not need to be restarted: `session/new` carries the mcpServers
   * config per-session, and the .cursor/mcp.json file is only needed for
   * the user-runs-cursor-manually auto-discovery path.
   */
  async function ensureMcpServer(ctx: MainsToolContext): Promise<typeof mcpServer> {
    if (mcpServer?.isRunning) {
      await mcpServer.stop();
    }
    mcpServer = new MainsMcpStdioServer(ctx);
    await mcpServer.start();
    logInfo(`Mains MCP stdio bridge started`);
    return mcpServer;
  }

  // Usage accumulation per run
  const usageAccumulator = new Map<string, {
    inputTokens: number;
    outputTokens: number;
    numTurns: number;
    model: string;
  }>();


  function flushUsage(runId: string): WorkRunUsage | undefined {
    const acc = usageAccumulator.get(runId);
    usageAccumulator.delete(runId);
    if (!acc || (acc.inputTokens === 0 && acc.outputTokens === 0)) {
      return undefined;
    }
    return {
      inputTokens: acc.inputTokens,
      outputTokens: acc.outputTokens,
      numTurns: acc.numTurns,
      model: acc.model || undefined,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Find Cursor Agent CLI binary
  // The Cursor CLI binary is called "agent" (not "cursor").
  // It is installed via: curl https://cursor.com/install -fsS | bash
  // ─────────────────────────────────────────────────────────────

  function findCursorBinary(): string {
    if (config.binary) return config.binary;

    const { execSync } = require("child_process");
    try {
      const result = execSync("which agent", { encoding: "utf-8", timeout: 5000 }).trim();
      if (result) return result;
    } catch {
      // not found in PATH
    }

    // Check common locations
    const homedir = os.homedir();
    const candidates = [
      path.join(homedir, ".local", "bin", "agent"),
      "/usr/local/bin/agent",
      "/opt/homebrew/bin/agent",
      path.join(homedir, ".cursor", "bin", "agent"),
    ];
    for (const c of candidates) {
      try {
        fs.accessSync(c, fs.constants.X_OK);
        return c;
      } catch {
        // not executable
      }
    }

    throw new Error(
      "Cursor Agent CLI not found. Install it with: curl https://cursor.com/install -fsS | bash\n" +
      "Or set config.binary to the full path of the `agent` executable."
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Ensure ACP server is running
  // ─────────────────────────────────────────────────────────────

  async function ensureServer(): Promise<CursorAcpServer> {
    if (acpServer?.isRunning) return acpServer;

    const binaryPath = findCursorBinary();
    logInfo(`Starting ACP server: ${binaryPath} acp`);

    const server = new CursorAcpServer();
    const env: Record<string, string> = {};

    env.HOME = os.homedir();

    const extraPaths = [
      path.dirname(binaryPath),
      path.join(os.homedir(), ".local", "bin"),
      "/usr/local/bin",
      "/opt/homebrew/bin",
    ];
    env.PATH = [...extraPaths, process.env.PATH || ""].join(":");

    if (config.apiKey) {
      env.CURSOR_API_KEY = config.apiKey;
    } else if (process.env.CURSOR_API_KEY) {
      env.CURSOR_API_KEY = process.env.CURSOR_API_KEY;
    }

    await server.start(binaryPath, env);
    acpServer = server;

    server.setOnClose(() => {
      if (acpServer === server) {
        acpServer = null;
      }
    });

    // ACP handshake: initialize → initialized → authenticate
    const initResult = await server.sendRequest("initialize", {
      protocolVersion: 1,
      clientInfo: {
        name: "mains",
        title: "Mains Desktop",
        version: "1.0.0",
      },
      clientCapabilities: {
        cursorExtensions: {
          askQuestion: true,
          createPlan: true,
          updateTodos: true,
          task: true,
          generateImage: true,
        },
      },
    }) as Record<string, unknown>;
    server.sendNotification("initialized");

    // Authenticate using the first available auth method
    const authMethods = initResult?.authMethods as Array<{ id: string }> | undefined;
    if (authMethods && authMethods.length > 0) {
      const methodId = authMethods[0].id;
      logInfo(`Authenticating with method: ${methodId}`);
      await server.sendRequest("authenticate", { methodId });
    }

    logInfo("ACP server initialized and authenticated");
    return server;
  }

  // ─────────────────────────────────────────────────────────────
  // Event mapping: ACP session/update notifications → WorkRunEvent
  // ─────────────────────────────────────────────────────────────

  /**
   * Normalize ACP tool_call data into the format the UI expects.
   * ACP sends minimal rawInput (often empty {}), with context in title/locations.
   * The UI renderers expect specific fields like file_path, command, pattern, etc.
   */
  function normalizeToolCall(
    kind: string | undefined,
    title: string | undefined,
    rawInput: Record<string, unknown> | undefined,
    locations: Array<{ path?: string; line?: number }> | undefined,
  ): { toolName: string; input: Record<string, unknown> } {
    const input: Record<string, unknown> = { ...rawInput };
    const firstPath = locations?.[0]?.path;

    // ACP provides very little in rawInput (usually empty {}).
    // Always set _title so the UI can fall back to it when specific fields are missing.
    if (title) input._title = title;

    switch (kind) {
      case "read": {
        if (firstPath) input.file_path = firstPath;
        if (!input.file_path && title) {
          const m = title.match(/(?:Read(?:ing)?(?:\s+File)?)\s+(.+)/i);
          if (m) input.file_path = m[1].trim();
        }
        return { toolName: "Read", input };
      }
      case "edit": {
        if (firstPath) input.file_path = firstPath;
        if (!input.file_path && title) {
          const m = title.match(/(?:Edit(?:ing)?(?:\s+File)?)\s+(.+)/i);
          if (m) input.file_path = m[1].trim();
        }
        return { toolName: "Edit", input };
      }
      case "delete": {
        if (firstPath) input.file_path = firstPath;
        return { toolName: "Delete", input };
      }
      case "execute": {
        if (!input.command && title) {
          const m = title.match(/(?:Execut(?:e|ing)|Running?)[:\s]+(.+)/i);
          if (m) input.command = m[1].trim();
          else input.command = title;
        }
        return { toolName: "Bash", input };
      }
      case "search": {
        if (!input.pattern && title) {
          const m = title.match(/(?:Search(?:ing)?(?:\s+for)?|Grep)\s+['"]?([^'"]+)['"]?/i);
          if (m) input.pattern = m[1].trim();
        }
        if (firstPath) input.path = firstPath;
        return { toolName: "Grep", input };
      }
      case "fetch": {
        if (!input.url && title) {
          const m = title.match(/https?:\/\/\S+/);
          if (m) input.url = m[0];
        }
        return { toolName: "WebFetch", input };
      }
      case "think": {
        return { toolName: title ?? "Think", input };
      }
      default: {
        if (firstPath) input.file_path = firstPath;
        // Clean up MCP tool names: "mains-CommitChanges: CommitChanges" → "CommitChanges"
        let name = title ?? kind ?? "Tool";
        const mcpMatch = name.match(/^mains[-_](\w+)(?::\s*\w+)?$/i);
        if (mcpMatch) {
          name = mcpMatch[1];
          delete input._title;
        }
        return { toolName: name, input };
      }
    }
  }

  function mapNotification(method: string, params: unknown, runId: string): WorkRunEvent[] {
    const ts = Date.now();
    const events: WorkRunEvent[] = [];
    const p = params as Record<string, unknown> | undefined;

    // ── Cursor extension notifications (fire-and-forget) ──

    if (method === "cursor/update_todos") {
      const todos = p?.todos as Array<{ id: string; content: string; status: string }> | undefined;
      const merge = p?.merge as boolean ?? false;
      if (todos && todos.length > 0) {
        const statusIcon = (s: string) =>
          s === "completed" ? "\u2705" : s === "in_progress" ? "\u23f3" : s === "cancelled" ? "\u274c" : "\u2b1c";
        const todosText = todos
          .map((t) => `${statusIcon(t.status)} ${t.content}`)
          .join("\n");
        events.push({
          type: "tool_call",
          toolName: "Todos",
          input: { todos: todosText, merge },
          output: todosText,
          startedAt: ts,
          endedAt: ts,
          metadata: {
            phase: "complete",
            cursorExtension: "update_todos",
            merge,
            todoItems: todos,
          },
        });
      }
      return events;
    }

    if (method === "cursor/task") {
      const description = p?.description as string ?? "Subagent task";
      const prompt = p?.prompt as string | undefined;
      const subagentType = p?.subagentType as string | { custom: string } | undefined;
      const model = p?.model as string | undefined;
      const agentId = p?.agentId as string | undefined;
      const durationMs = p?.durationMs as number | undefined;

      const typeLabel = typeof subagentType === "object" && subagentType !== null
        ? (subagentType as { custom: string }).custom
        : (subagentType as string) ?? "unspecified";
      const durationSuffix = durationMs ? ` (${(durationMs / 1000).toFixed(1)}s)` : "";

      events.push({
        type: "log",
        message: `[task:${typeLabel}] ${description}${durationSuffix}`,
        level: "info",
        ts,
        metadata: {
          cursorExtension: "task",
          description,
          prompt,
          subagentType: typeLabel,
          model,
          agentId,
          durationMs,
        },
      });
      return events;
    }

    if (method === "cursor/generate_image") {
      const description = p?.description as string ?? "Generated image";
      const filePath = p?.filePath as string | undefined;
      const referenceImagePaths = p?.referenceImagePaths as string[] | undefined;

      events.push({
        type: "artifact",
        kind: "file",
        path: filePath,
        content: description,
        metadata: {
          cursorExtension: "generate_image",
          filePath,
          referenceImagePaths,
        },
      });
      return events;
    }

    if (method !== "session/update") {
      // Ignore other non-session notifications silently
      return events;
    }

    const update = p?.update as Record<string, unknown> | undefined;
    if (!update) return events;

    const updateType = update.sessionUpdate as string | undefined;

    switch (updateType) {
      case "agent_message_chunk": {
        const content = update.content as Record<string, unknown> | undefined;
        const text = content?.text as string | undefined;
        if (text) {
          const runState = activeRuns.get(runId);
          if (runState) {
            runState.agentMessageBuffer += text;
            events.push({
              type: "artifact",
              kind: "report",
              content: runState.agentMessageBuffer,
              metadata: { source: "agent_message_streaming" },
              ephemeral: true,
              streamId: `cursor-msg-${runId}`,
            });
          }
        }
        break;
      }

      case "agent_thought_chunk": {
        const content = update.content as Record<string, unknown> | undefined;
        const text = content?.text as string | undefined;
        if (text) {
          const runState = activeRuns.get(runId);
          if (runState) {
            runState.agentThoughtBuffer += text;
            events.push({
              type: "artifact",
              kind: "report",
              content: runState.agentThoughtBuffer,
              metadata: { source: "agent_thought_streaming" },
              ephemeral: true,
              streamId: `cursor-think-${runId}`,
            });
          }
        }
        break;
      }

      case "tool_call": {
        // Flush agent message buffer before tool events (preserves interleaved order)
        const rsToolCall = activeRuns.get(runId);
        if (rsToolCall && rsToolCall.agentMessageBuffer.trim()) {
          events.push({
            type: "artifact",
            kind: "report",
            content: rsToolCall.agentMessageBuffer.trim(),
            metadata: { source: "agent_message" },
          });
          rsToolCall.agentMessageBuffer = "";
        }

        const toolCallId = update.toolCallId as string | undefined;
        const title = update.title as string | undefined;
        const kind = update.kind as string | undefined;
        const status = update.status as string | undefined;
        const rawInput = update.rawInput as Record<string, unknown> | undefined;
        const locations = update.locations as Array<{ path?: string; line?: number }> | undefined;

        // Skip plan-related tool_call updates — handled by cursor/create_plan server request
        if (kind === "create_plan" || kind === "plan" || /create\s*plan/i.test(title ?? "")) break;

        // Skip MCP tool_call events — the bridge emits proper events with real tool names
        if (kind === "mcp_tool_call" || /mcp/i.test(kind ?? "") || /mcp/i.test(title ?? "") || /^mains[-_]/i.test(title ?? "")) break;

        const { toolName, input: normalizedInput } = normalizeToolCall(kind, title, rawInput, locations);

        if (status === "pending" || status === "in_progress") {
          if (rsToolCall) {
            rsToolCall.agentThoughtBuffer = "";
            events.push({
              type: "artifact",
              kind: "report",
              content: "",
              metadata: { source: "agent_thought_streaming" },
              ephemeral: true,
              streamId: `cursor-think-${runId}`,
            });
          }
          events.push({
            type: "tool_call",
            toolName,
            input: normalizedInput,
            startedAt: ts,
            metadata: { phase: "start", toolCallId, title, kind },
          });
        }
        break;
      }

      case "tool_call_update": {
        const toolCallId = update.toolCallId as string | undefined;
        const title = update.title as string | undefined;
        const kind = update.kind as string | undefined;
        const status = update.status as string | undefined;
        const rawOutput = update.rawOutput as unknown;
        const rawInput = update.rawInput as Record<string, unknown> | undefined;
        const locations = update.locations as Array<{ path?: string; line?: number }> | undefined;
        const content = update.content as Array<Record<string, unknown>> | undefined;

        // Skip plan-related tool_call updates — handled by cursor/create_plan server request
        if (kind === "create_plan" || kind === "plan" || /create\s*plan/i.test(title ?? "")) break;

        // Skip MCP tool_call updates — the bridge emits proper events with real tool names
        if (kind === "mcp_tool_call" || /mcp/i.test(kind ?? "") || /mcp/i.test(title ?? "") || /^mains[-_]/i.test(title ?? "")) break;

        const { toolName, input: normalizedInput } = normalizeToolCall(kind, title, rawInput, locations);

        if (status === "completed" || status === "failed") {
          // Extract diff block (ACP sends edit results as content: [{type:"diff", path, oldText, newText}])
          const diffBlock = content?.find((c) => c.type === "diff");
          if (diffBlock) {
            if (typeof diffBlock.path === "string") normalizedInput.file_path = diffBlock.path;
            if (typeof diffBlock.oldText === "string") normalizedInput.old_string = diffBlock.oldText;
            if (typeof diffBlock.newText === "string") normalizedInput.new_string = diffBlock.newText;
          }

          // Extract output: try content blocks → rawOutput.content string → rawOutput itself
          let outputText: unknown;
          if (content && content.length > 0) {
            const textParts = content
              .filter((c) => c.type === "text")
              .map((c) => c.text as string);
            outputText = textParts.length > 0 ? textParts.join("\n") : diffBlock ? "" : undefined;
          }
          if (outputText === undefined) {
            if (rawOutput && typeof rawOutput === "object" && (rawOutput as any).content) {
              outputText = (rawOutput as any).content;
            } else {
              outputText = rawOutput;
            }
          }

          events.push({
            type: "tool_call",
            toolName,
            input: normalizedInput,
            output: outputText,
            error: status === "failed" ? (title ?? "Tool call failed") : undefined,
            endedAt: ts,
            metadata: { phase: "complete", toolCallId, title, kind },
          });
        }
        break;
      }

      case "plan": {
        const planContent = update.content as Array<Record<string, unknown>> | undefined;
        if (planContent) {
          const planText = planContent
            .filter((c) => c.type === "text")
            .map((c) => c.text as string)
            .join("\n");
          if (planText) {
            events.push({
              type: "tool_call",
              toolName: "Plan",
              input: { plan: planText },
              output: { planStatus: "pending" },
              startedAt: ts,
              endedAt: ts,
              metadata: { phase: "complete" },
            });
          }
        }
        break;
      }

      case "session_info_update": {
        const title = update.title as string | undefined;
        if (title) {
          events.push({
            type: "log",
            message: title,
            level: "sdk-user",
            ts,
            metadata: { sessionTitle: title },
          });
          // Persist title to run
          const runState = activeRuns.get(runId);
          if (runState?.sessionId) {
            runsRepo.updateRun(runId, { title }).catch((err) =>
              logError("Failed to update run title:", err),
            );
          }
        }
        break;
      }

      case "available_commands_update":
      case "current_mode_update":
      case "config_option_update":
      case "user_message_chunk":
        // Internal/UI state — no user-visible event needed
        break;

      default:
        logInfo(`[ACP] Unhandled sessionUpdate type: ${updateType}`);
        break;
    }

    return events;
  }

  // ─────────────────────────────────────────────────────────────
  // Run execution helper
  // ─────────────────────────────────────────────────────────────

  /**
   * Set up notification/request handlers for streaming events during a prompt.
   * The prompt itself completes via the session/prompt RPC response (stopReason),
   * so this only handles side-effects (UI events, permission brokering).
   */
  function setupSessionHandlers(
    server: CursorAcpServer,
    runId: string,
    onEvent: WorkRunEventHandler,
    collectedArtifacts: Array<{ kind: string; path?: string }>,
  ): void {
    const handleNotification = async (method: string, params: unknown) => {
      const p = params as Record<string, unknown> | undefined;
      const sessionId = p?.sessionId as string | undefined;

      // Only process updates for our session
      const runState = activeRuns.get(runId);
      if (!runState || (sessionId && sessionId !== runState.sessionId)) return;

      const mappedEvents = mapNotification(method, params, runId);
      for (const mapped of mappedEvents) {
        await onEvent(mapped);

        if (mapped.type === "artifact" && mapped.kind !== "user-prompt" && !mapped.ephemeral) {
          collectedArtifacts.push({ kind: mapped.kind, path: mapped.path });
        }
      }
    };

    // Handle server requests — permission approvals (ACP session/request_permission)
    const handleServerRequest = async (id: number | string, method: string, params: unknown) => {
      const p = params as Record<string, unknown> | undefined;

      switch (method) {
        case "session/request_permission": {

          // Extract permission options from the request
          const options = p?.options as Array<Record<string, unknown>> | undefined;
          const allowOnceId = options?.find((o) => o.kind === "allow_once")?.optionId as string ?? "allow-once";
          const allowAlwaysId = options?.find((o) => o.kind === "allow_always")?.optionId as string ?? "allow-always";
          const rejectOnceId = options?.find((o) => o.kind === "reject_once")?.optionId as string ?? "reject-once";

          const toolCall = p?.toolCall as Record<string, unknown> | undefined;
          const acpKind = toolCall?.kind as string | undefined;
          const acpTitle = toolCall?.title as string | undefined;
          const acpLocations = toolCall?.locations as Array<{ path?: string }> | undefined;

          // Auto-approve Mains MCP tools (CommitChanges, CreatePR, etc.)
          if (acpTitle && /^mains[-_]/i.test(acpTitle)) {
            server.respondToRequest(id, { outcome: { outcome: "selected", optionId: allowAlwaysId } });
            break;
          }

          // Map ACP kind to UI-friendly tool name and build structured input
          const { toolName: approvalToolName, input: approvalInput } = normalizeToolCall(
            acpKind, acpTitle, undefined, acpLocations,
          );

          try {
            const result = await requestToolApproval({
              requestId: String(id),
              runId,
              toolName: approvalToolName,
              toolInput: approvalInput,
              kind: "tool_approval",
              timestamp: Date.now(),
            });

            if (!result.approved) {
              server.respondToRequest(id, { outcome: { outcome: "selected", optionId: rejectOnceId } });
            } else if (result.answer === "acceptForSession") {
              server.respondToRequest(id, { outcome: { outcome: "selected", optionId: allowAlwaysId } });
            } else {
              server.respondToRequest(id, { outcome: { outcome: "selected", optionId: allowOnceId } });
            }
          } catch {
            server.respondToRequest(id, { outcome: { outcome: "cancelled" } });
          }
          break;
        }

        case "cursor/ask_question": {
          const questions = p?.questions as Array<Record<string, unknown>> | undefined;
          const title = p?.title as string | undefined;

          if (!questions || questions.length === 0) {
            server.respondToRequest(id, { outcome: { outcome: "skipped", reason: "No questions provided" } });
            break;
          }

          // Map the first question to the existing ask_user broker
          // (ACP sends an array but typically a single question per request)
          const q = questions[0];
          const qId = q.id as string;
          const prompt = q.prompt as string ?? title ?? "Question from Cursor";
          const qOptions = q.options as Array<{ id: string; label: string }> | undefined;
          const allowMultiple = q.allowMultiple as boolean ?? false;

          try {
            const result = await requestToolApproval({
              requestId: String(id),
              runId,
              toolName: title ?? "Question",
              toolInput: {},
              kind: "ask_user",
              question: prompt,
              options: qOptions?.map((o) => ({ label: o.label, description: undefined })),
              multiSelect: allowMultiple,
              timestamp: Date.now(),
            });

            if (!result.approved) {
              server.respondToRequest(id, { outcome: { outcome: "cancelled" } });
            } else if (result.answer) {
              // Map the answer back to ACP format: match selected labels to option IDs
              const answerLabels = result.answer.split(", ");
              const selectedOptionIds = qOptions
                ? answerLabels
                    .map((label) => qOptions.find((o) => o.label === label)?.id)
                    .filter(Boolean) as string[]
                : [];

              // If no option IDs matched (free text answer), use the answer as-is
              if (selectedOptionIds.length === 0 && qOptions && qOptions.length > 0) {
                // Try exact match on id as fallback
                const byId = qOptions.find((o) => answerLabels.includes(o.id));
                if (byId) selectedOptionIds.push(byId.id);
              }

              if (selectedOptionIds.length > 0) {
                server.respondToRequest(id, {
                  outcome: {
                    outcome: "answered",
                    answers: [{ questionId: qId, selectedOptionIds }],
                  },
                });
              } else {
                // Free text — pick closest option or skip
                server.respondToRequest(id, { outcome: { outcome: "skipped", reason: result.answer } });
              }
            } else {
              server.respondToRequest(id, { outcome: { outcome: "skipped" } });
            }
          } catch {
            server.respondToRequest(id, { outcome: { outcome: "cancelled" } });
          }
          break;
        }

        case "cursor/create_plan": {
          const planName = p?.name as string | undefined;
          const planOverview = p?.overview as string | undefined;
          const planMarkdown = p?.plan as string | undefined;
          const planTodos = p?.todos as Array<{ id: string; content: string; status: string }> | undefined;
          const planPhases = p?.phases as Array<{ name: string; todos: Array<{ id: string; content: string; status: string }> }> | undefined;
          const isProject = p?.isProject as boolean ?? false;

          // Build a rich plan display: header + overview + markdown + todos/phases
          const sections: string[] = [];
          if (planName) sections.push(`## ${planName}`);
          if (planOverview) sections.push(planOverview);
          if (planMarkdown) sections.push(planMarkdown);

          const statusIcon = (s: string) =>
            s === "completed" ? "\u2705" : s === "in_progress" ? "\u23f3" : s === "cancelled" ? "\u274c" : "\u2b1c";

          if (planPhases && planPhases.length > 0) {
            for (const phase of planPhases) {
              sections.push(`\n### ${phase.name}`);
              for (const t of phase.todos) {
                sections.push(`${statusIcon(t.status)} ${t.content}`);
              }
            }
          } else if (planTodos && planTodos.length > 0) {
            sections.push("");
            for (const t of planTodos) {
              sections.push(`${statusIcon(t.status)} ${t.content}`);
            }
          }

          const content = sections.join("\n").trim();

          // Emit plan with toolName "Plan" and planStatus "pending" so PlanDisplay
          // renders with Apply/Dismiss buttons. The session/update "plan" notification
          // may not always fire, so this is the canonical source.
          if (content) {
            const planToolCallId = (p?.toolCallId as string | undefined) ?? `cursor-plan-${Date.now()}`;
            const startedAt = Date.now();
            await onEvent({
              type: "tool_call",
              toolName: "Plan",
              input: { plan: content },
              startedAt,
              metadata: { phase: "start", toolCallId: planToolCallId, isProject, cursorExtension: "create_plan" },
            });
            await onEvent({
              type: "tool_call",
              toolName: "Plan",
              input: { plan: content },
              output: { planStatus: "pending" },
              startedAt,
              endedAt: Date.now(),
              metadata: { phase: "complete", toolCallId: planToolCallId, isProject, cursorExtension: "create_plan" },
            });
          }

          // Auto-accept so the agent proceeds with execution.
          server.respondToRequest(id, { outcome: { outcome: "accepted" } });
          break;
        }

        default: {
          logWarn(`Unsupported ACP server request: ${method}`);
          server.respondToRequestError(id, -32601, `Unsupported: ${method}`);
          break;
        }
      }
    };

    server.setNotificationHandler(handleNotification);
    server.setServerRequestHandler(handleServerRequest);
  }

  // ─────────────────────────────────────────────────────────────
  // Input building
  // ─────────────────────────────────────────────────────────────

  function buildPrompt(request: WorkRunRequest): string {
    const workspaceInfo = `Working directory: ${request.workspace.rootPath}`;
    let prompt: string;

    if (request.context && request.context.length > 0) {
      const contextParts = formatContextSection(request.context);
      prompt = `${workspaceInfo}\n\nContext:\n${contextParts}\n\n---\n\nGoal: ${request.goal}`;
    } else {
      prompt = `${workspaceInfo}\n\nGoal: ${request.goal}`;
    }

    prompt = appendPromptSections(prompt, {
      contextIssues: request.contextIssues,
      contextSignals: request.contextSignals,
      contextFiles: request.contextFiles,
      runId: request.runId,
    });

    // Instruct the agent to use Mains MCP tools instead of Bash for commits/PRs
    prompt += "\n\nIMPORTANT: Never commit changes using Bash (git add, git commit). If the user asks you to commit, always use the CommitChanges tool from the mains MCP server to stage and commit changes. Similarly, never create pull requests using Bash (gh pr create). Always use the CreatePR tool from the mains MCP server instead. Before running any package install command (npm install, pip install, cargo add, etc.), you MUST call the CheckPackage tool first to verify package safety.";

    // Handle attachments
    if (request.attachments && request.attachments.length > 0) {
      const { savedPaths, inlineTexts } = saveAttachments(request.attachments, request.runId);
      if (inlineTexts.length > 0) {
        prompt = `${prompt}\n\n---\n\nAttached documents:\n${inlineTexts.join("\n\n")}`;
      }
      if (savedPaths.length > 0) {
        prompt = `${prompt}\n\n---\n\nAttached files:\n${savedPaths.map((p) => `- ${p}`).join("\n")}`;
      }
    }

    return prompt;
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
      const resolvedModel = model || config.defaultModel || undefined;
      const timeout = config.timeout ?? 600000;
      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });

        // Set up MCP FIRST so .cursor/mcp.json exists before ACP starts.
        // If ACP was already running, ensureMcpServer() restarts it.
        const mainsCtx: MainsToolContext = {
          workspaceId: request.workspace.id,
          rootPath: request.workspace.rootPath,
          runId,
        };
        const mainsMcp = await ensureMcpServer(mainsCtx);

        const server = await ensureServer();

        // 1. Create session via session/new
        logInfo(`Creating session (model: ${resolvedModel || "default"}, cwd: ${request.workspace.rootPath})`);
        const sessionResult = await server.sendRequest("session/new", {
          cwd: request.workspace.rootPath,
          mcpServers: mainsMcp ? [mainsMcp.mcpConfig] : [],
        }) as Record<string, unknown>;
        const sessionId = sessionResult?.sessionId as string | undefined;

        if (sessionId) {
          sessionIdMap.set(runId, sessionId);
          runsRepo.updateRun(runId, { sessionId }).catch((err) =>
            logError("Failed to persist session ID:", err),
          );
        }

        // Set model if specified via session/set_config_option
        if (resolvedModel && sessionId) {
          try {
            await server.sendRequest("session/set_config_option", {
              sessionId,
              configId: "model",
              value: resolvedModel,
            });
          } catch {
            logWarn(`Failed to set model to ${resolvedModel}, using default`);
          }
        }

        // Set mode if configured
        if (config.mode && config.mode !== "agent" && sessionId) {
          try {
            await server.sendRequest("session/set_mode", {
              sessionId,
              modeId: config.mode,
            });
          } catch {
            logWarn(`Failed to set mode to ${config.mode}`);
          }
        }

        activeRuns.set(runId, {
          sessionId: sessionId ?? null,
          aborted: false,
          agentMessageBuffer: "",
          agentThoughtBuffer: "",
          currentStreamId: null,
          pendingFlush: [],
        });

        // Set up streaming event handlers
        setupSessionHandlers(server, runId, onEvent, collectedArtifacts);

        // Wire MCP bridge events to the run's event handler
        if (mcpServer) {
          mcpServer.setEventHandler(onEvent);
        }

        // Emit user prompt artifact
        await emitUserPromptArtifact(onEvent, request.goal, {
          attachments: request.attachments,
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
          contextSkills: request.skills,
        });

        // 2. Send prompt via session/prompt (blocks until completion)
        const prompt = buildPrompt(request);
        const promptResult = await server.sendRequest("session/prompt", {
          sessionId: sessionId ?? "",
          prompt: [{ type: "text", text: prompt }],
        }, timeout) as Record<string, unknown>;

        const stopReason = promptResult?.stopReason as string | undefined;

        // Flush remaining agent message buffer
        const runState = activeRuns.get(runId);
        if (runState && runState.agentMessageBuffer.trim()) {
          await onEvent({
            type: "artifact",
            kind: "report",
            content: runState.agentMessageBuffer.trim(),
            metadata: { source: "agent_message" },
          });
          collectedArtifacts.push({ kind: "report" });
          runState.agentMessageBuffer = "";
        }
        if (runState) {
          runState.agentThoughtBuffer = "";
          await onEvent({
            type: "artifact",
            kind: "report",
            content: "",
            metadata: { source: "agent_thought_streaming" },
            ephemeral: true,
            streamId: `cursor-think-${runId}`,
          });
        }

        const usage = flushUsage(runId);
        const status = stopReason === "cancelled" ? "canceled"
          : stopReason === "refusal" ? "failed"
          : "succeeded";
        const error = stopReason === "refusal" ? "Agent refused the request"
          : stopReason === "max_tokens" ? "Response truncated (max tokens)"
          : undefined;

        await onEvent({ type: "status", status, error, ts: Date.now() });

        return {
          status,
          summary: error,
          artifacts: collectedArtifacts,
          usage,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logError("startRun failed:", msg);
        await onEvent({ type: "status", status: "failed", error: msg, ts: Date.now() });
        flushUsage(runId);
        return { status: "failed", summary: msg };
      } finally {
        activeRuns.delete(runId);
        cancelPendingRequests(runId);
      }
    },

    async continueRun(
      request: WorkRunContinueRequest,
      onEvent: WorkRunEventHandler,
    ): Promise<WorkRunResult> {
      const { runId, message, model: continueModel } = request;
      const resolvedContinueModel = continueModel || config.defaultModel || undefined;
      const timeout = config.timeout ?? 600000;
      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });

        // MCP must be ensured before ACP so the first-run restart path
        // (ensureMcpServer stops ACP if it was started without MCP config)
        // doesn't invalidate the server handle we're about to use.
        const mainsCtx: MainsToolContext = {
          workspaceId: request.workspace.id,
          rootPath: request.workspace.rootPath,
          runId,
        };
        const mainsMcp = await ensureMcpServer(mainsCtx);
        const mcpServersConfig = mainsMcp ? [mainsMcp.mcpConfig] : [];

        const server = await ensureServer();

        let sessionId = sessionIdMap.get(runId);
        if (!sessionId) {
          const run = await runsRepo.findRunById(runId);
          if (run?.sessionId) {
            sessionId = run.sessionId;
            sessionIdMap.set(runId, sessionId);
          }
        }
        if (!sessionId) {
          throw new Error(`No session found for run ${runId}. Cannot resume.`);
        }

        // Load (resume) the session — replays history then allows new prompts
        try {
          await server.sendRequest("session/load", {
            sessionId,
            cwd: request.workspace.rootPath,
            mcpServers: mcpServersConfig,
          }, 30000);
        } catch (loadErr) {
          const errMsg = loadErr instanceof Error ? loadErr.message : String(loadErr);
          // If load fails, create a new session instead
          if (/not found|unknown|does not exist/i.test(errMsg)) {
            logWarn(`Session load failed (${errMsg}), creating new session`);
            const newResult = await server.sendRequest("session/new", {
              cwd: request.workspace.rootPath,
              mcpServers: mcpServersConfig,
            }) as Record<string, unknown>;
            const newId = newResult?.sessionId as string | undefined;
            if (newId) {
              sessionId = newId;
              sessionIdMap.set(runId, newId);
            }
          } else {
            throw loadErr;
          }
        }

        // Re-apply model + agent mode after load — session keeps prior ACP settings otherwise,
        // so toolbar changes mid-run only affected startRun, not continueRun.
        if (resolvedContinueModel && sessionId) {
          try {
            await server.sendRequest("session/set_config_option", {
              sessionId,
              configId: "model",
              value: resolvedContinueModel,
            });
          } catch {
            logWarn(`Failed to set model to ${resolvedContinueModel} on resume, using session default`);
          }
        }
        if (sessionId && config.mode) {
          try {
            await server.sendRequest("session/set_mode", {
              sessionId,
              modeId: config.mode,
            });
          } catch {
            logWarn(`Failed to set mode to ${config.mode} on resume`);
          }
        }

        activeRuns.set(runId, {
          sessionId,
          aborted: false,
          agentMessageBuffer: "",
          agentThoughtBuffer: "",
          currentStreamId: null,
          pendingFlush: [],
        });

        // Set up streaming event handlers
        setupSessionHandlers(server, runId, onEvent, collectedArtifacts);

        if (mcpServer) {
          mcpServer.setEventHandler(onEvent);
        }

        await emitUserPromptArtifact(onEvent, message, {
          attachments: request.attachments,
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
          contextSkills: request.skills,
        });

        // Build follow-up prompt
        let prompt = message;
        prompt = appendPromptSections(prompt, {
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
          runId: request.runId,
        });

        if (request.attachments && request.attachments.length > 0) {
          const { savedPaths, inlineTexts } = saveAttachments(request.attachments, request.runId);
          if (inlineTexts.length > 0) {
            prompt = `${prompt}\n\n---\n\nAttached documents:\n${inlineTexts.join("\n\n")}`;
          }
          if (savedPaths.length > 0) {
            prompt = `${prompt}\n\n---\n\nAttached files:\n${savedPaths.map((p) => `- ${p}`).join("\n")}`;
          }
        }

        // Send follow-up prompt to resumed session
        const promptResult = await server.sendRequest("session/prompt", {
          sessionId,
          prompt: [{ type: "text", text: prompt }],
        }, timeout) as Record<string, unknown>;

        const stopReason = promptResult?.stopReason as string | undefined;

        // Flush remaining agent message buffer
        const runState = activeRuns.get(runId);
        if (runState && runState.agentMessageBuffer.trim()) {
          await onEvent({
            type: "artifact",
            kind: "report",
            content: runState.agentMessageBuffer.trim(),
            metadata: { source: "agent_message" },
          });
          collectedArtifacts.push({ kind: "report" });
          runState.agentMessageBuffer = "";
        }
        if (runState) {
          runState.agentThoughtBuffer = "";
          await onEvent({
            type: "artifact",
            kind: "report",
            content: "",
            metadata: { source: "agent_thought_streaming" },
            ephemeral: true,
            streamId: `cursor-think-${runId}`,
          });
        }

        const usage = flushUsage(runId);
        const status = stopReason === "cancelled" ? "canceled"
          : stopReason === "refusal" ? "failed"
          : "succeeded";
        const error = stopReason === "refusal" ? "Agent refused the request" : undefined;

        await onEvent({ type: "status", status, error, ts: Date.now() });

        return {
          status,
          summary: error,
          artifacts: collectedArtifacts,
          usage,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logError("continueRun failed:", msg);
        await onEvent({ type: "status", status: "failed", error: msg, ts: Date.now() });
        flushUsage(runId);
        return { status: "failed", summary: msg };
      } finally {
        activeRuns.delete(runId);
        cancelPendingRequests(runId);
      }
    },

    async abortRun(runId: string): Promise<void> {
      const runState = activeRuns.get(runId);
      if (!runState) return;

      runState.aborted = true;

      // session/cancel is a notification (no response expected)
      if (acpServer?.isRunning && runState.sessionId) {
        try {
          acpServer.sendNotification("session/cancel", {
            sessionId: runState.sessionId,
          });
        } catch (err) {
          logError("Failed to cancel session:", err);
        }
      }
    },

    async canResumeSession(runId: string): Promise<boolean> {
      if (sessionIdMap.has(runId)) return true;
      const run = await runsRepo.findRunById(runId);
      if (run?.sessionId) {
        sessionIdMap.set(runId, run.sessionId);
        return true;
      }
      return false;
    },

    async deleteSession(runId: string): Promise<void> {
      sessionIdMap.delete(runId);
      activeRuns.delete(runId);
      usageAccumulator.delete(runId);
    },

    async shutdown(): Promise<void> {
      for (const [runId, state] of activeRuns) {
        state.aborted = true;
        cancelPendingRequests(runId);
      }
      activeRuns.clear();
      sessionIdMap.clear();
      usageAccumulator.clear();

      if (mcpServer) {
        await mcpServer.stop().catch(() => {});
        mcpServer = null;
      }

      if (acpServer) {
        await acpServer.stop();
        acpServer = null;
      }

      logInfo("Shutdown complete");
    },

    async listModels(): Promise<ModelInfo[]> {
      try {
        // ACP exposes models in session/new response under result.models.availableModels
        const server = await ensureServer();
        const result = await server.sendRequest("session/new", {
          cwd: os.homedir(),
          mcpServers: [],
        }) as Record<string, unknown>;

        const modelsObj = result?.models as Record<string, unknown> | undefined;
        const availableModels = modelsObj?.availableModels as Array<Record<string, unknown>> | undefined;
        const currentModelId = modelsObj?.currentModelId as string | undefined;

        if (!availableModels || !Array.isArray(availableModels)) {
          return [];
        }

        return availableModels.map((m): ModelInfo => ({
          id: m.modelId as string,
          displayName: (m.name as string) || (m.modelId as string),
          isDefault: (m.modelId as string) === (config.defaultModel ?? currentModelId),
        }));
      } catch (error) {
        logError("Failed to list models:", error);
        const msg = error instanceof Error ? error.message : String(error);
        if (/auth|login|unauthorized|token/i.test(msg)) {
          throw new Error('Not authenticated. Run "cursor login" to sign in.');
        }
        return [];
      }
    },

    async generateTitle(goal: string, context?: import("./adapter.types").WorkRunContextItem[]): Promise<string> {
      try {
        const binaryPath = findCursorBinary();

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
          "Generate a concise title (2-5 words) for this task.",
          "Reply with ONLY the title text, nothing else.",
          "No quotes, no punctuation, no prefixes.",
          "",
          `User message: ${goal}`,
          contextSnippet ? `\nContext:\n${contextSnippet}` : "",
        ].filter(Boolean).join("\n");

        const titleText = await new Promise<string>((resolve, reject) => {
          const env: Record<string, string | undefined> = {
            ...process.env,
            HOME: os.homedir(),
            PATH: [path.dirname(binaryPath), path.join(os.homedir(), ".local", "bin"), "/usr/local/bin", "/opt/homebrew/bin", process.env.PATH || ""].join(":"),
          };
          if (config.apiKey) env.CURSOR_API_KEY = config.apiKey;

          const child = spawn(binaryPath, [
            "--print",
            "--mode", "ask",
            "--trust",
            "--output-format", "text",
            titlePrompt,
          ], { env, stdio: ["ignore", "pipe", "pipe"], timeout: 15000 });

          let stdout = "";
          let stderr = "";
          child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
          child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
          child.on("close", (code) => {
            if (code === 0 && stdout.trim()) {
              resolve(stdout.trim());
            } else {
              reject(new Error(stderr.trim() || `Exit code ${code}`));
            }
          });
          child.on("error", reject);
        });

        const title = titleText
          .split("\n")[0]
          .trim()
          .replace(/^(title:\s*)/i, "")
          .replace(/^["'`]|["'`]$/g, "")
          .replace(/[.!?]$/, "")
          .trim();

        if (!title) throw new Error("Empty title generated");

        return title.slice(0, 50);
      } catch (err) {
        logWarn("Title generation failed, using fallback:", err);
        return goal.slice(0, 50);
      }
    },
  };
}
