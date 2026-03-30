// ─────────────────────────────────────────────────────────────
// OpenAI Codex App-Server Adapter
// Implements WorkRunAdapter using `codex app-server` JSON-RPC over stdio
// ─────────────────────────────────────────────────────────────

import { spawn, type ChildProcess } from "node:child_process";
import { type Interface as ReadlineInterface } from "node:readline";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  WorkRunAdapter,
  WorkRunRequest,
  WorkRunContinueRequest,
  WorkRunForkRequest,
  WorkRunResult,
  WorkRunUsage,
  WorkRunEventHandler,
  WorkRunEvent,
  CodexAdapterConfig,
  ModelInfo,
  PluginListResponse,
  PluginInfo,
  PluginDetail,
  MarketplaceInfo,
  CodexAccountInfo,
} from "./adapter.types";
import {
  cancelPendingRequests,
  requestToolApproval,
} from "../../runs/user-input-broker";
import { runsRepo } from "../../runs/runs.repo";
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
// Thread item types (mirroring SDK types for event mapping)
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Approval mode mapping
// ─────────────────────────────────────────────────────────────

function mapPermissionMode(mode?: string): "untrusted" | "on-request" | "on-failure" | "never" {
  switch (mode) {
    case "bypassPermissions": return "never";
    case "acceptEdits": return "on-failure";
    default: return "on-failure";
  }
}

function mapSandboxMode(mode?: string): "read-only" | "workspace-write" | "danger-full-access" {
  return (mode as "read-only" | "workspace-write" | "danger-full-access") ?? "workspace-write";
}

// ─────────────────────────────────────────────────────────────
// Active run tracking
// ─────────────────────────────────────────────────────────────

const activeRuns = new Map<string, {
  threadId: string | null;
  turnId: string | null;
  aborted: boolean;
  /** Current agent message item being accumulated */
  currentMessageItemId: string | null;
  /** Accumulated text for the current agent message item */
  agentMessageBuffer: string;
  /** Pending events to emit (flushed message artifacts) */
  pendingFlush: WorkRunEvent[];
}>();

// Session ID mapping: runId → threadId (for resume support)
const sessionIdMap = new Map<string, string>();

const { info: logInfo, error: logError, warn: logWarn } = createLogger("[CodexAdapter]");

// ─────────────────────────────────────────────────────────────
// App Server Process Manager
// ─────────────────────────────────────────────────────────────

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

class CodexAppServer {
  private child: ChildProcess | null = null;
  private output: ReadlineInterface | null = null;
  private nextId = 1;
  private pendingRequests = new Map<number | string, PendingRequest>();
  private notificationHandler: ((method: string, params: unknown) => void) | null = null;
  private backgroundHandler: ((method: string, params: unknown) => void) | null = null;
  private serverRequestHandler: ((id: number | string, method: string, params: unknown) => void) | null = null;
  private onClose: (() => void) | null = null;
  private stderrBuffer = "";
  private jsonBuffer = "";

  async start(binaryPath: string, cwd: string, env?: Record<string, string>): Promise<void> {
    if (this.child) return;

    const spawnEnv: Record<string, string | undefined> = {
      ...process.env,
      ...env,
    };

    this.child = spawn(binaryPath, ["app-server"], {
      cwd,
      env: spawnEnv,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    if (!this.child.stdout || !this.child.stdin) {
      throw new Error("Failed to get stdio pipes from codex app-server");
    }

    // Use raw data handler instead of readline to handle JSON messages
    // that contain literal newlines in string values (e.g. plugin descriptions).
    // We buffer incoming data and try to parse complete JSON objects.
    this.child.stdout.on("data", (chunk: Buffer) => {
      this.jsonBuffer += chunk.toString();
      this.drainJsonBuffer();
    });

    this.child.stderr?.on("data", (data: Buffer) => {
      this.stderrBuffer += data.toString();
      // Keep only last 2KB of stderr
      if (this.stderrBuffer.length > 2048) {
        this.stderrBuffer = this.stderrBuffer.slice(-2048);
      }
    });

    this.child.on("close", (code) => {
      logInfo(`App-server process exited with code ${code}`);
      this.cleanup();
      this.onClose?.();
    });

    this.child.on("error", (err) => {
      logError("App-server process error:", err.message);
      this.cleanup();
    });
  }

  setNotificationHandler(handler: (method: string, params: unknown) => void): void {
    this.notificationHandler = handler;
  }

  /** Persistent handler that runs for ALL notifications (even after turn completes) */
  setBackgroundHandler(handler: (method: string, params: unknown) => void): void {
    this.backgroundHandler = handler;
  }

  setServerRequestHandler(handler: (id: number | string, method: string, params: unknown) => void): void {
    this.serverRequestHandler = handler;
  }

  setOnClose(handler: () => void): void {
    this.onClose = handler;
  }

  async sendRequest(method: string, params?: unknown, timeoutMs = 30000): Promise<unknown> {
    if (!this.child?.stdin) {
      throw new Error("App-server not running");
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

  sendNotification(method: string, params?: unknown): void {
    this.writeMessage({ jsonrpc: "2.0", method, ...(params !== undefined ? { params } : {}) });
  }

  respondToRequestError(id: number | string, code: number, message: string): void {
    this.writeMessage({ jsonrpc: "2.0", id, error: { code, message } });
  }

  get isRunning(): boolean {
    return this.child !== null && this.child.exitCode === null;
  }

  async stop(): Promise<void> {
    if (!this.child) return;

    // Reject all pending requests
    for (const [_id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("App-server stopping"));
    }
    this.pendingRequests.clear();

    const child = this.child;
    this.cleanup();

    // Graceful shutdown: close stdin, then kill after timeout
    try {
      child.stdin?.end();
      await new Promise<void>((resolve) => {
        const killTimer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 3000);
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
      // Not JSON — might be log output, ignore
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
      this.backgroundHandler?.(parsed.method, parsed.params);
    }
  }

  /**
   * Drain the JSON buffer: try to extract complete JSON objects.
   * The app-server sends newline-delimited JSON, but some JSON values
   * contain literal newlines (e.g. plugin long descriptions), so we
   * can't rely on line boundaries. Instead, we try parsing progressively
   * larger chunks until we get valid JSON.
   */
  private drainJsonBuffer(): void {
    while (this.jsonBuffer.length > 0) {
      // Skip leading whitespace/newlines
      const trimStart = this.jsonBuffer.search(/\S/);
      if (trimStart === -1) {
        this.jsonBuffer = "";
        return;
      }
      if (trimStart > 0) {
        this.jsonBuffer = this.jsonBuffer.slice(trimStart);
      }

      // Must start with '{' for a JSON object
      if (this.jsonBuffer[0] !== "{") {
        // Skip to next '{' — might be garbage/log output
        const nextBrace = this.jsonBuffer.indexOf("{", 1);
        if (nextBrace === -1) {
          this.jsonBuffer = "";
          return;
        }
        this.jsonBuffer = this.jsonBuffer.slice(nextBrace);
        continue;
      }

      // Try to parse from the start. Use a brace-depth counter for efficiency.
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
        // Incomplete JSON — wait for more data
        return;
      }

      const jsonStr = this.jsonBuffer.slice(0, endIdx + 1);
      this.jsonBuffer = this.jsonBuffer.slice(endIdx + 1);

      this.handleLine(jsonStr);
    }
  }

  private cleanup(): void {
    this.output?.close();
    this.output = null;
    this.child = null;
    this.jsonBuffer = "";
  }
}

// ─────────────────────────────────────────────────────────────
// Adapter factory
// ─────────────────────────────────────────────────────────────

/** Convert a local file path to a data URL. Returns undefined if the file doesn't exist. */
function fileToDataUrl(filePath: string | undefined | null): string | undefined {
  if (!filePath) return undefined;
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const mime = ext === "svg" ? "image/svg+xml"
      : ext === "png" ? "image/png"
      : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "gif" ? "image/gif"
      : ext === "webp" ? "image/webp"
      : "application/octet-stream";
    return `data:${mime};base64,${data.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/**
 * Creates a Codex adapter using `codex app-server` JSON-RPC protocol.
 * This approach spawns `codex app-server` as a subprocess and communicates
 * via newline-delimited JSON-RPC over stdin/stdout.
 *
 * Key advantage over @openai/codex-sdk: model selection works per-turn,
 * bypassing ~/.codex/config.toml precedence issues.
 */
export function createCodexAdapter(config: CodexAdapterConfig): WorkRunAdapter {
  let appServer: CodexAppServer | null = null;

  // Marketplace path cache: marketplace name → path
  const marketplacePathCache = new Map<string, string>();

  // Usage accumulation per run
  const usageAccumulator = new Map<string, {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    cacheWriteTokens: number;
    totalCostUsd: number;
    numTurns: number;
    model: string;
    modelUsage: Record<string, { costUSD: number; inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number }>;
  }>();

  function getOrCreateUsage(runId: string) {
    if (!usageAccumulator.has(runId)) {
      usageAccumulator.set(runId, {
        inputTokens: 0,
        outputTokens: 0,
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
        totalCostUsd: 0,
        numTurns: 0,
        model: "",
        modelUsage: {},
      });
    }
    return usageAccumulator.get(runId)!;
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
   * Track usage from turn/completed notification
   */
  function trackUsage(runId: string, params: unknown, model?: string): void {
    const p = params as Record<string, unknown> | undefined;
    if (!p) return;

    // Usage can be at params.usage or params.turn.usage
    const turnObj = p.turn as Record<string, unknown> | undefined;
    const usage = (turnObj?.usage ?? p.usage) as Usage | undefined;
    if (!usage) return;

    const acc = getOrCreateUsage(runId);
    const input = usage.input_tokens ?? 0;
    const output = usage.output_tokens ?? 0;
    const cacheRead = usage.cached_input_tokens ?? 0;

    acc.inputTokens += input;
    acc.outputTokens += output;
    acc.cachedInputTokens += cacheRead;
    acc.numTurns++;

    const modelName = model || config.defaultModel || "codex";
    acc.model = modelName;
    if (!acc.modelUsage[modelName]) {
      acc.modelUsage[modelName] = { costUSD: 0, inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };
    }
    acc.modelUsage[modelName].inputTokens += input;
    acc.modelUsage[modelName].outputTokens += output;
    acc.modelUsage[modelName].cacheReadInputTokens += cacheRead;
  }

  // ─────────────────────────────────────────────────────────────
  // Find codex binary
  // ─────────────────────────────────────────────────────────────

  function findCodexBinary(): string {
    if (config.binary) return config.binary;

    // Check PATH
    const { execSync } = require("child_process");
    try {
      const result = execSync("which codex", { encoding: "utf-8", timeout: 5000 }).trim();
      if (result) return result;
    } catch {
      // not found in PATH
    }

    // Check common locations
    const homedir = os.homedir();
    const candidates = [
      path.join(homedir, ".codex", "bin", "codex"),
      "/usr/local/bin/codex",
      // nvm-managed global installs
      ...(() => {
        try {
          const nvmDir = process.env.NVM_DIR || path.join(homedir, ".nvm");
          const nodeVersions = fs.readdirSync(path.join(nvmDir, "versions", "node"));
          return nodeVersions.map((v: string) => path.join(nvmDir, "versions", "node", v, "bin", "codex"));
        } catch { return []; }
      })(),
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
      "Codex CLI not found. Please install Codex and ensure `codex` is in your PATH, " +
      "or set config.binary to the full path of the codex executable."
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Ensure app-server is running
  // ─────────────────────────────────────────────────────────────

  async function ensureServer(cwd?: string): Promise<CodexAppServer> {
    if (appServer?.isRunning) return appServer;

    const binaryPath = findCodexBinary();
    const spawnCwd = cwd ?? os.homedir();
    logInfo(`Starting app-server: ${binaryPath} app-server (cwd: ${spawnCwd}, HOME=${process.env.HOME}, homedir=${os.homedir()})`);

    const server = new CodexAppServer();
    const env: Record<string, string> = {};

    // Ensure HOME is set correctly for packaged app
    env.HOME = os.homedir();

    // Extend PATH with nvm and common bin dirs for packaged app
    const homedir = os.homedir();
    const extraPaths = [
      path.dirname(binaryPath),
      path.join(homedir, ".nvm", "versions", "node"),
      "/usr/local/bin",
      "/opt/homebrew/bin",
    ];
    // Find active node version bin dir
    try {
      const nvmDir = process.env.NVM_DIR || path.join(homedir, ".nvm");
      const nodeVersions = fs.readdirSync(path.join(nvmDir, "versions", "node"));
      for (const v of nodeVersions) {
        extraPaths.push(path.join(nvmDir, "versions", "node", v, "bin"));
      }
    } catch { /* no nvm */ }
    env.PATH = [...extraPaths, process.env.PATH || ""].join(":");

    if (config.apiKey) {
      env.OPENAI_API_KEY = config.apiKey;
    } else if (process.env.OPENAI_API_KEY) {
      env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    } else if (process.env.CODEX_API_KEY) {
      env.CODEX_API_KEY = process.env.CODEX_API_KEY;
    }

    await server.start(binaryPath, spawnCwd, env);
    appServer = server;

    server.setOnClose(() => {
      if (appServer === server) {
        appServer = null;
      }
    });

    // Handshake: initialize → initialized (required before any other RPC)
    await server.sendRequest("initialize", {
      clientInfo: {
        name: "jinzo",
        title: "Jinzo Desktop",
        version: "1.0.0",
      },
      capabilities: {
        experimentalApi: true,
      },
    });
    server.sendNotification("initialized");

    // Background handler: captures notifications that arrive after turn completes
    // (e.g. thread/name/updated for auto-generated titles)
    server.setBackgroundHandler((method, params) => {
      if (method === "thread/name/updated" || method === "thread/nameUpdated") {
        const p = params as Record<string, unknown> | undefined;
        const threadName = p?.threadName as string | undefined;
        const threadId = p?.threadId as string | undefined;
        if (threadName && threadId) {
          // Find runId by threadId and update title
          for (const [runId, tid] of sessionIdMap) {
            if (tid === threadId) {
              runsRepo.updateRun(runId, { title: threadName }).catch((err) =>
                logError("Failed to update run title:", err),
              );
              break;
            }
          }
        }
      }
    });

    logInfo("App-server initialized successfully");
    return server;
  }

  // ─────────────────────────────────────────────────────────────
  // Event mapping: app-server notifications → WorkRunEvent
  // ─────────────────────────────────────────────────────────────

  function mapNotification(method: string, params: unknown, runId: string, model?: string): WorkRunEvent[] {
    const ts = Date.now();
    const events: WorkRunEvent[] = [];
    const p = params as Record<string, unknown> | undefined;

    switch (method) {
      case "thread/started": {
        const thread = p?.thread as Record<string, unknown> | undefined;
        const threadId = (thread?.id ?? p?.threadId) as string | undefined;
        if (threadId) {
          sessionIdMap.set(runId, threadId);
          const runState = activeRuns.get(runId);
          if (runState) runState.threadId = threadId;
        }
        break;
      }

      case "turn/started": {
        const turn = p?.turn as Record<string, unknown> | undefined;
        const turnId = (turn?.id ?? p?.turnId) as string | undefined;
        if (turnId) {
          const runState = activeRuns.get(runId);
          if (runState) runState.turnId = turnId;
        }
        break;
      }

      case "turn/completed": {
        trackUsage(runId, p, model);

        // Flush any remaining agent message buffer
        const runState = activeRuns.get(runId);
        if (runState) {
          // Emit any pending flushed messages first
          events.push(...runState.pendingFlush);
          runState.pendingFlush = [];

          // Emit remaining buffer
          if (runState.agentMessageBuffer.trim()) {
            events.push({
              type: "artifact",
              kind: "report",
              content: runState.agentMessageBuffer.trim(),
              metadata: { source: "agent_message", itemId: runState.currentMessageItemId },
            });
            runState.agentMessageBuffer = "";
            runState.currentMessageItemId = null;
          }
        }

        const turn = p?.turn as Record<string, unknown> | undefined;
        const status = (turn?.status ?? p?.status) as string | undefined;
        const error = turn?.error as { message?: string } | undefined;
        if (status === "failed" && error?.message) {
          events.push({ type: "log", message: `Codex turn failed: ${error.message}`, level: "error", ts });
        }
        break;
      }

      case "turn/failed": {
        const error = (p?.error as { message?: string })?.message ?? "Unknown error";
        events.push({ type: "log", message: `Codex turn failed: ${error}`, level: "error", ts });
        break;
      }

      case "item/started":
      case "item/updated":
      case "item/completed": {
        // Flush agent message buffer before tool events (preserves order)
        const rsItem = activeRuns.get(runId);
        if (rsItem && rsItem.agentMessageBuffer.trim()) {
          events.push({
            type: "artifact",
            kind: "report",
            content: rsItem.agentMessageBuffer.trim(),
            metadata: { source: "agent_message", itemId: rsItem.currentMessageItemId },
          });
          rsItem.agentMessageBuffer = "";
          rsItem.currentMessageItemId = null;
        }

        const item = (p?.item ?? p) as ThreadItem | undefined;
        if (item?.type) {
          events.push(...mapThreadItem(item, method, ts));
        }
        break;
      }

      // Streaming delta: accumulate agent message text per itemId
      case "item/agentMessage/delta": {
        const delta = p?.delta as string | undefined;
        const itemId = p?.itemId as string | undefined;
        if (delta) {
          const runState = activeRuns.get(runId);
          if (runState) {
            // New message item started — flush previous one
            if (itemId && runState.currentMessageItemId && itemId !== runState.currentMessageItemId) {
              const text = runState.agentMessageBuffer.trim();
              if (text) {
                runState.pendingFlush.push({
                  type: "artifact",
                  kind: "report",
                  content: text,
                  metadata: { source: "agent_message", itemId: runState.currentMessageItemId },
                });
              }
              runState.agentMessageBuffer = "";
            }
            runState.currentMessageItemId = itemId ?? runState.currentMessageItemId;
            runState.agentMessageBuffer += delta;

            // Emit ephemeral event with accumulated text so far (for streaming UI)
            events.push({
              type: "artifact",
              kind: "report",
              content: runState.agentMessageBuffer,
              metadata: { source: "agent_message_streaming" },
              ephemeral: true,
              streamId: `codex-msg-${runId}-${runState.currentMessageItemId ?? "default"}`,
            });
          }
        }
        break;
      }

      // Other streaming deltas — ignore (reasoning summaries, command output, etc.)
      case "item/commandExecution/output/delta":
      case "item/commandExecution/outputDelta":
      case "item/commandExecution/terminalInteraction":
      case "item/fileChange/output/delta":
      case "item/fileChange/outputDelta":
      case "item/reasoning/delta":
      case "item/reasoning/summaryPartAdded":
      case "item/reasoning/summaryTextDelta":
      case "item/reasoning/textDelta":
      case "item/plan/delta":
      case "item/plan/updated":
      case "item/mcpToolCall/progress":
        break;

      case "error": {
        const msg = (p?.error as { message?: string })?.message ?? p?.message ?? "unknown";
        events.push({ type: "log", message: `Codex error: ${msg}`, level: "error", ts });
        break;
      }

      case "account/rateLimits/updated":
        // Rate limit info — internal, no UI event
        break;

      case "thread/tokenUsage/updated":
        // Usage tracked via turn/completed, ignore this
        break;

      case "thread/status/changed":
      case "thread/name/updated": {
        // Codex CLI auto-generates a thread title
        const threadName = p?.threadName as string | undefined;
        if (threadName) {
          events.push({
            type: "log",
            message: threadName,
            level: "sdk-user",
            ts,
            metadata: { threadTitle: threadName },
          });
        }
        break;
      }

      case "thread/closed":
        // Thread lifecycle — internal, no UI event
        break;

      default:
        // Ignore all streaming deltas, internal lifecycle, and noisy notifications
        if (
          method.startsWith("thread/") ||
          method.startsWith("turn/") ||
          method.startsWith("account/") ||
          method.startsWith("skills/") ||
          method.startsWith("config/") ||
          method.startsWith("plugin/") ||
          method.includes("Delta") ||
          method.includes("delta") ||
          method.includes("progress") ||
          method.includes("terminalInteraction") ||
          method.includes("guardian")
        ) {
          break;
        }
        events.push({ type: "log", message: `[codex:${method}] ${safeJson(p)}`, level: "info", ts });
        break;
    }

    return events;
  }

  /**
   * Map Codex ThreadItem to WorkRunEvents.
   * Matches the app-server's item schema (same structure as SDK ThreadItem).
   */
  function mapThreadItem(item: ThreadItem, eventMethod: string, ts: number): WorkRunEvent[] {
    const events: WorkRunEvent[] = [];
    const phase = eventMethod.endsWith("/started") ? "start" :
                  eventMethod.endsWith("/completed") ? "complete" : "update";

    switch (item.type) {
      case "agent_message":
      case "agentMessage":
      case "userMessage":
        // Agent message text is accumulated via item/agentMessage/delta and emitted at turn/completed
        // User message is internal — no UI event needed
        break;

      case "reasoning": {
        const text = typeof item.text === "string" ? item.text : "";
        if (text && phase === "complete") {
          events.push({ type: "log", message: `[reasoning] ${text}`, level: "info", ts });
        }
        break;
      }

      case "command_execution":
      case "commandExecution": {
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

      case "file_change":
      case "fileChange": {
        const changes = item.changes as Array<{ path: string; kind: string }> | undefined;
        const patchStatus = item.status as string | undefined;

        if (phase === "complete" && changes && changes.length > 0) {
          for (const change of changes) {
            const toolName = change.kind === "delete" ? "Delete" : change.kind === "add" ? "Write" : "Edit";
            events.push({
              type: "tool_call",
              toolName,
              input: { path: change.path },
              startedAt: ts,
              metadata: { phase: "start", itemId: `${item.id}-${change.path}`, changeType: change.kind, codexItemType: "file_change" },
            });
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

      case "mcp_tool_call":
      case "mcpToolCall": {
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

      case "web_search":
      case "webSearch": {
        const query = typeof item.query === "string" ? item.query : "";
        if (phase === "complete" && query) {
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

      case "todo_list":
      case "todoList": {
        if (phase === "complete") {
          const todos = item.items as Array<{ text: string; completed: boolean }> | undefined;
          if (todos) {
            const summary = todos.map((t) => `${t.completed ? "[x]" : "[ ]"} ${t.text}`).join("\n");
            events.push({ type: "log", message: `[todo]\n${summary}`, level: "info", ts, metadata: { itemId: item.id } });
          }
        }
        break;
      }

      case "error": {
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

  // ─────────────────────────────────────────────────────────────
  // Input building
  // ─────────────────────────────────────────────────────────────

  type TurnInput = Array<
    | { type: "text"; text: string; text_elements: [] }
    | { type: "localImage"; path: string }
  >;

  function buildTurnInput(request: WorkRunRequest): TurnInput {
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

    const input: TurnInput = [{ type: "text", text: prompt, text_elements: [] }];

    // Handle image attachments
    if (request.attachments && request.attachments.length > 0) {
      const { savedPaths, inlineTexts } = saveAttachments(request.attachments, request.runId);

      if (inlineTexts.length > 0 && input[0].type === "text") {
        input[0].text = `${prompt}\n\n---\n\nAttached documents:\n${inlineTexts.join("\n\n")}`;
      }

      const imagePaths = savedPaths.filter((p) => {
        const ext = p.toLowerCase();
        return ext.endsWith(".png") || ext.endsWith(".jpg") || ext.endsWith(".jpeg") ||
               ext.endsWith(".gif") || ext.endsWith(".webp") || ext.endsWith(".bmp");
      });

      for (const imgPath of imagePaths) {
        input.push({ type: "localImage", path: imgPath });
      }
    }

    return input;
  }

  function buildContinueTurnInput(message: string, request: WorkRunContinueRequest): TurnInput {
    let prompt = message;

    prompt = appendPromptSections(prompt, {
      contextIssues: request.contextIssues,
      contextSignals: request.contextSignals,
      contextFiles: request.contextFiles,
      runId: request.runId,
    });

    const input: TurnInput = [{ type: "text", text: prompt, text_elements: [] }];

    if (request.attachments && request.attachments.length > 0) {
      const { savedPaths, inlineTexts } = saveAttachments(request.attachments, request.runId);

      if (inlineTexts.length > 0 && input[0].type === "text") {
        input[0].text = `${prompt}\n\n---\n\nAttached documents:\n${inlineTexts.join("\n\n")}`;
      }

      const imagePaths = savedPaths.filter((p) => {
        const ext = p.toLowerCase();
        return ext.endsWith(".png") || ext.endsWith(".jpg") || ext.endsWith(".jpeg") ||
               ext.endsWith(".gif") || ext.endsWith(".webp") || ext.endsWith(".bmp");
      });

      for (const imgPath of imagePaths) {
        input.push({ type: "localImage", path: imgPath });
      }
    }

    return input;
  }

  // ─────────────────────────────────────────────────────────────
  // Run execution helper
  // ─────────────────────────────────────────────────────────────

  /**
   * Set up notification/request handlers for a run, wait for turn completion.
   * Returns a promise that resolves when the turn is done.
   */
  function waitForTurnCompletion(
    server: CodexAppServer,
    runId: string,
    model: string | undefined,
    onEvent: WorkRunEventHandler,
    collectedArtifacts: Array<{ kind: string; path?: string }>,
    timeout: number,
  ): Promise<{ status: "succeeded" | "failed" | "canceled"; error?: string }> {
    return new Promise((resolve) => {
      let resolved = false;
      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ status: "failed", error: `Codex run timed out after ${timeout}ms` });
        }
      }, timeout);

      const handleNotification = async (method: string, params: unknown) => {
        const runState = activeRuns.get(runId);
        if (runState?.aborted) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutTimer);
            resolve({ status: "canceled" });
          }
          return;
        }

        // Emit any pending flushed messages (from itemId changes in agentMessage/delta)
        const currentRunState = activeRuns.get(runId);
        if (currentRunState && currentRunState.pendingFlush.length > 0) {
          const flushed = currentRunState.pendingFlush.splice(0);
          for (const evt of flushed) {
            await onEvent(evt);
            if (evt.type === "artifact") {
              collectedArtifacts.push({ kind: evt.kind, path: evt.path });
            }
          }
        }

        const mappedEvents = mapNotification(method, params, runId, model);
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

        // Check for turn completion
        if (method === "turn/completed") {
          const p = params as Record<string, unknown> | undefined;
          const turn = p?.turn as Record<string, unknown> | undefined;
          const status = (turn?.status ?? p?.status) as string | undefined;

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutTimer);
            resolve({
              status: status === "failed" ? "failed" : "succeeded",
              error: status === "failed" ? ((turn?.error as { message?: string })?.message ?? "Turn failed") : undefined,
            });
          }
        } else if (method === "turn/failed") {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutTimer);
            const p = params as Record<string, unknown> | undefined;
            const msg = (p?.error as { message?: string })?.message ?? "Turn failed";
            resolve({ status: "failed", error: msg });
          }
        } else if (method === "error") {
          const p = params as Record<string, unknown> | undefined;
          const willRetry = (p as any)?.willRetry as boolean | undefined;
          if (!willRetry && !resolved) {
            resolved = true;
            clearTimeout(timeoutTimer);
            const msg = (p?.error as { message?: string })?.message ?? (p?.message as string) ?? "Error";
            resolve({ status: "failed", error: msg });
          }
        }
      };

      // Handle server requests — approval, user input, auth tokens
      const handleServerRequest = async (id: number | string, method: string, params: unknown) => {
        const p = params as Record<string, unknown> | undefined;
        switch (method) {
          // Approval requests — auto-approve or broker
          case "item/commandExecution/requestApproval":
          case "item/fileRead/requestApproval":
          case "item/fileChange/requestApproval":
          case "item/permissions/requestApproval": {
            const permissionMode = config.permissionMode || "default";
            if (permissionMode === "bypassPermissions") {
              server.respondToRequest(id, { decision: "accept" });
            } else {
              // Route through approval broker for interactive UI
              const toolName = method.includes("command") ? "Bash" :
                              method.includes("fileRead") ? "Read" :
                              method.includes("fileChange") ? "Edit" : "Permission";
              const command = (p?.command as string) ?? (p?.path as string) ?? (p?.reason as string) ?? "";
              try {
                const result = await requestToolApproval({
                  requestId: String(id),
                  runId,
                  toolName,
                  toolInput: { command },
                  kind: "tool_approval",
                  timestamp: Date.now(),
                });
                const decision = !result.approved ? "decline"
                  : result.answer === "acceptForSession" ? "acceptForSession"
                  : "accept";
                server.respondToRequest(id, { decision });
              } catch {
                server.respondToRequest(id, { decision: "decline" });
              }
            }
            break;
          }

          // User input requests — OAuth flows, MCP elicitations
          case "item/tool/requestUserInput": {
            const questions = p?.questions as Array<Record<string, unknown>> | undefined;
            if (questions && questions.length > 0) {
              // Build question text for the UI
              const questionTexts = questions.map((q) => {
                const text = (q.text as string) ?? (q.description as string) ?? "";
                const options = q.options as Array<Record<string, unknown>> | undefined;
                if (options && options.length > 0) {
                  return `${text}\nOptions: ${options.map(o => o.label ?? o.description ?? "").join(", ")}`;
                }
                return text;
              });

              try {
                const result = await requestToolApproval({
                  requestId: String(id),
                  runId,
                  toolName: "UserInput",
                  kind: "ask_user",
                  question: questionTexts.join("\n\n"),
                  timestamp: Date.now(),
                });

                // Build answers in the format Codex expects
                const answers: Record<string, { answers: string[] }> = {};
                for (const q of questions) {
                  const qId = (q.id as string) ?? (q.questionId as string);
                  if (qId) {
                    if (result.approved) {
                      // If user provided an answer, use it; otherwise pick first option
                      const userAnswer = result.answer || "";
                      const options = q.options as Array<Record<string, unknown>> | undefined;
                      const firstOption = options?.[0]?.label as string ?? options?.[0]?.description as string ?? "";
                      answers[qId] = { answers: [userAnswer || firstOption || "yes"] };
                    } else {
                      answers[qId] = { answers: [] };
                    }
                  }
                }
                server.respondToRequest(id, { answers });
              } catch {
                // Timeout/error — send empty answers
                const answers: Record<string, { answers: string[] }> = {};
                for (const q of questions) {
                  const qId = (q.id as string) ?? (q.questionId as string);
                  if (qId) answers[qId] = { answers: [] };
                }
                server.respondToRequest(id, { answers });
              }
            } else {
              server.respondToRequest(id, { answers: {} });
            }
            break;
          }

          // Auth token refresh — the server asks the client to supply fresh tokens.
          // We can't supply them directly, but responding with an empty result
          // allows the server to fall back to its own refresh flow (via auth.json).
          case "account/chatgptAuthTokens/refresh": {
            logInfo("Auth token refresh requested by app-server");
            server.respondToRequest(id, {});
            break;
          }

          // Dynamic tool calls — not supported
          case "item/tool/call": {
            server.respondToRequestError(id, -32601, "Dynamic tool calls not supported");
            break;
          }

          // Unknown — error
          default: {
            logWarn(`Unsupported server request: ${method}`);
            server.respondToRequestError(id, -32601, `Unsupported server request: ${method}`);
            break;
          }
        }
      };

      server.setNotificationHandler(handleNotification);
      server.setServerRequestHandler(handleServerRequest);
    });
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

        const server = await ensureServer();

        const approvalPolicy = config.approvalMode ?? mapPermissionMode(config.permissionMode);
        const sandbox = mapSandboxMode(config.sandboxMode);

        // Start thread (cwd passed per-thread, not per-server)
        const networkAccess = config.networkAccessEnabled !== false;
        const threadStartParams: Record<string, unknown> = {
          cwd: request.workspace.rootPath,
          approvalPolicy,
          sandbox,
          ...(resolvedModel ? { model: resolvedModel } : {}),
          config: {
            ...(networkAccess ? { sandbox_network_access: true } : {}),
          },
        };

        logInfo(`Starting thread (model: ${resolvedModel || "default"}, cwd: ${request.workspace.rootPath})`);
        const threadResult = await server.sendRequest("thread/start", threadStartParams) as Record<string, unknown>;
        const thread = threadResult?.thread as Record<string, unknown> | undefined;
        const threadId = (thread?.id ?? threadResult?.threadId) as string | undefined;

        if (threadId) {
          sessionIdMap.set(runId, threadId);
          // Persist to DB for resume after app restart
          runsRepo.updateRun(runId, { sessionId: threadId }).catch((err) =>
            logError("Failed to persist session ID:", err),
          );
        }

        activeRuns.set(runId, { threadId: threadId ?? null, turnId: null, aborted: false, currentMessageItemId: null, agentMessageBuffer: "", pendingFlush: [] });

        // Emit user prompt artifact
        await emitUserPromptArtifact(onEvent, request.goal, {
          attachments: request.attachments,
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
        });

        // 2. Start turn
        const turnInput = buildTurnInput(request);
        const turnStartParams: Record<string, unknown> = {
          threadId: threadId ?? "",
          input: turnInput,
          ...(resolvedModel ? { model: resolvedModel } : {}),
          ...(config.modelReasoningEffort ? { effort: config.modelReasoningEffort } : {}),
        };

        await server.sendRequest("turn/start", turnStartParams);

        // 3. Wait for turn completion (events flow via notification handler)
        const result = await waitForTurnCompletion(server, runId, resolvedModel, onEvent, collectedArtifacts, timeout);

        const usage = flushUsage(runId);

        await onEvent({ type: "status", status: result.status, error: result.error, ts: Date.now() });

        return {
          status: result.status,
          summary: result.error,
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
      const { runId, message } = request;
      const resolvedModel = request.model || config.defaultModel || undefined;
      const timeout = config.timeout ?? 600000;
      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });

        const server = await ensureServer();

        let threadId = sessionIdMap.get(runId);
        if (!threadId) {
          // DB fallback: session may have been lost from memory (app restart)
          const run = await runsRepo.findRunById(runId);
          if (run?.sessionId) {
            threadId = run.sessionId;
            sessionIdMap.set(runId, threadId);
          }
        }
        if (!threadId) {
          throw new Error(`No session found for run ${runId}. Cannot resume.`);
        }

        const approvalPolicy = config.approvalMode ?? mapPermissionMode(config.permissionMode);
        const sandbox = mapSandboxMode(config.sandboxMode);

        // 1. Resume thread
        try {
          await server.sendRequest("thread/resume", {
            threadId,
            cwd: request.workspace.rootPath,
            approvalPolicy,
            sandbox,
            ...(resolvedModel ? { model: resolvedModel } : {}),
          });
        } catch (resumeError) {
          const errMsg = resumeError instanceof Error ? resumeError.message : String(resumeError);
          // If resume fails with "not found", start a new thread
          if (/not found|missing thread|unknown thread|does not exist/i.test(errMsg)) {
            logWarn(`Thread resume failed (${errMsg}), starting new thread`);
            const threadResult = await server.sendRequest("thread/start", {
              cwd: request.workspace.rootPath,
              approvalPolicy,
              sandbox,
              ...(resolvedModel ? { model: resolvedModel } : {}),
            }) as Record<string, unknown>;
            const newThreadId = (threadResult?.thread as Record<string, unknown>)?.id as string ??
                               threadResult?.threadId as string;
            if (newThreadId) sessionIdMap.set(runId, newThreadId);
          } else {
            throw resumeError;
          }
        }

        activeRuns.set(runId, { threadId, turnId: null, aborted: false, currentMessageItemId: null, agentMessageBuffer: "", pendingFlush: [] });

        await emitUserPromptArtifact(onEvent, message, {
          attachments: request.attachments,
          contextIssues: request.contextIssues,
          contextSignals: request.contextSignals,
          contextFiles: request.contextFiles,
        });

        // 2. Start turn with the follow-up message
        const currentThreadId = sessionIdMap.get(runId) ?? threadId;
        const turnInput = buildContinueTurnInput(message, request);

        await server.sendRequest("turn/start", {
          threadId: currentThreadId,
          input: turnInput,
          ...(resolvedModel ? { model: resolvedModel } : {}),
          ...(config.modelReasoningEffort ? { effort: config.modelReasoningEffort } : {}),
        });

        // 3. Wait for turn completion
        const result = await waitForTurnCompletion(server, runId, resolvedModel, onEvent, collectedArtifacts, timeout);

        const usage = flushUsage(runId);

        await onEvent({ type: "status", status: result.status, error: result.error, ts: Date.now() });

        return {
          status: result.status,
          summary: result.error,
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

    async forkRun(
      request: WorkRunForkRequest,
      onEvent: WorkRunEventHandler,
    ): Promise<WorkRunResult> {
      const { runId, sourceRunId, message } = request;
      const resolvedModel = request.model || config.defaultModel || undefined;
      const timeout = config.timeout ?? 600000;
      const collectedArtifacts: Array<{ kind: string; path?: string }> = [];

      try {
        await onEvent({ type: "status", status: "running", ts: Date.now() });
        logInfo(`Forking session from run ${sourceRunId} into new run ${runId}`);

        const server = await ensureServer();

        // Resolve source thread ID
        let sourceThreadId = sessionIdMap.get(sourceRunId);
        if (!sourceThreadId) {
          const sourceRun = await runsRepo.findRunById(sourceRunId);
          if (sourceRun?.sessionId) {
            sourceThreadId = sourceRun.sessionId;
            sessionIdMap.set(sourceRunId, sourceThreadId);
          }
        }
        if (!sourceThreadId) {
          throw new Error(`No session found for source run ${sourceRunId}. Cannot fork.`);
        }

        const approvalPolicy = config.approvalMode ?? mapPermissionMode(config.permissionMode);
        const sandbox = mapSandboxMode(config.sandboxMode);

        // 1. Fork thread via thread/fork
        const forkResult = await server.sendRequest("thread/fork", {
          threadId: sourceThreadId,
          cwd: request.workspace.rootPath,
          approvalPolicy,
          sandbox,
          ...(resolvedModel ? { model: resolvedModel } : {}),
        }) as Record<string, unknown>;

        const forkedThread = forkResult?.thread as Record<string, unknown> | undefined;
        const forkedThreadId = (forkedThread?.id ?? forkResult?.threadId) as string | undefined;

        if (!forkedThreadId) {
          throw new Error("thread/fork did not return a new thread ID");
        }

        sessionIdMap.set(runId, forkedThreadId);
        runsRepo.updateRun(runId, { sessionId: forkedThreadId }).catch((err) =>
          logError("Failed to persist forked session ID:", err),
        );

        activeRuns.set(runId, {
          threadId: forkedThreadId,
          turnId: null,
          aborted: false,
          currentMessageItemId: null,
          agentMessageBuffer: "",
          pendingFlush: [],
        });

        // Emit user prompt artifact
        await emitUserPromptArtifact(onEvent, message, {
          attachments: request.attachments,
        });

        // 2. Start turn on the forked thread
        const turnInput = buildContinueTurnInput(message, {
          runId,
          message,
          workspace: request.workspace,
          attachments: request.attachments,
        } as WorkRunContinueRequest);

        await server.sendRequest("turn/start", {
          threadId: forkedThreadId,
          input: turnInput,
          ...(resolvedModel ? { model: resolvedModel } : {}),
          ...(config.modelReasoningEffort ? { effort: config.modelReasoningEffort } : {}),
        });

        // 3. Wait for turn completion
        const result = await waitForTurnCompletion(server, runId, resolvedModel, onEvent, collectedArtifacts, timeout);

        const usage = flushUsage(runId);

        await onEvent({ type: "status", status: result.status, error: result.error, ts: Date.now() });

        return {
          status: result.status,
          summary: result.error,
          artifacts: collectedArtifacts,
          usage,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logError("forkRun failed:", msg);
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

      if (appServer?.isRunning && runState.threadId && runState.turnId) {
        try {
          await appServer.sendRequest("turn/interrupt", {
            threadId: runState.threadId,
            turnId: runState.turnId,
          });
        } catch (err) {
          logError("Failed to interrupt turn:", err);
        }
      }
    },

    async canResumeSession(runId: string): Promise<boolean> {
      if (sessionIdMap.has(runId)) return true;
      // DB fallback
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
      // Abort all active runs
      for (const [runId, state] of activeRuns) {
        state.aborted = true;
        cancelPendingRequests(runId);
      }
      activeRuns.clear();
      sessionIdMap.clear();
      usageAccumulator.clear();

      if (appServer) {
        await appServer.stop();
        appServer = null;
      }

      logInfo("Shutdown complete");
    },

    async listModels(): Promise<ModelInfo[]> {
      try {
        // Use existing server or start with homedir (neutral CWD that won't trigger restart)
        const server = await ensureServer();

        const result = await server.sendRequest("model/list", {}) as Record<string, unknown>;
        const data = result?.data as Array<Record<string, unknown>> | undefined;

        if (!data || !Array.isArray(data)) {
          logWarn("Invalid models response from app-server");
          return [];
        }

        return data
          .filter((m) => !m.hidden)
          .map((m): ModelInfo => {
            const inputModalities = m.inputModalities as string[] | undefined;
            const effortOptions = m.supportedReasoningEfforts as Array<{ reasoningEffort: string }> | undefined;
            const effortLevels = effortOptions?.map((e) => e.reasoningEffort) as ("low" | "medium" | "high" | "xhigh")[] | undefined;

            const rawName = (m.displayName as string) || (m.id as string);
            // Format display name: "gpt-5.4" → "GPT-5.4", "gpt-5.1-codex-mini" → "GPT-5.1 Codex Mini"
            const displayName = rawName
              .replace(/^gpt-/i, "GPT-")
              .replace(/-codex/i, " Codex")
              .replace(/-mini$/i, " Mini")
              .replace(/-max$/i, " Max")
              .replace(/-spark$/i, " Spark");

            return {
              id: m.id as string,
              displayName,
              isDefault: (m.isDefault as boolean) || (m.id as string) === config.defaultModel,
              description: m.description as string | undefined,
              capabilities: {
                vision: inputModalities?.includes("image"),
              },
              supportsEffort: (effortLevels && effortLevels.length > 0) ?? false,
              supportedEffortLevels: effortLevels,
            };
          });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (/not authenticated/i.test(msg)) throw error;
        logError("Failed to list models:", error);
        return [];
      }
    },

    async getAccountInfo(): Promise<import("./adapter.types").CodexAccountInfo> {
      try {
        const server = await ensureServer();
        const result = await server.sendRequest("account/read", {}) as Record<string, unknown>;
        return {
          account: result.account as CodexAccountInfo["account"],
          requiresOpenaiAuth: (result.requiresOpenaiAuth as boolean) ?? false,
        };
      } catch (error) {
        logError("Failed to read account:", error);
        return { account: null, requiresOpenaiAuth: true };
      }
    },

    async getRateLimits(): Promise<import("./adapter.types").RateLimitInfo | null> {
      try {
        if (!appServer?.isRunning) return null;
        const result = await appServer.sendRequest("account/rateLimits/read", {}) as Record<string, unknown>;
        const rl = result?.rateLimits as Record<string, unknown> | undefined;
        if (!rl) return null;

        const primary = rl.primary as Record<string, unknown> | undefined;
        const secondary = rl.secondary as Record<string, unknown> | undefined;
        const credits = rl.credits as Record<string, unknown> | undefined;

        return {
          planType: rl.planType as string | undefined,
          primary: primary ? {
            usedPercent: primary.usedPercent as number,
            windowDurationMins: primary.windowDurationMins as number | undefined,
            resetsAt: primary.resetsAt as number | undefined,
          } : undefined,
          secondary: secondary ? {
            usedPercent: secondary.usedPercent as number,
            windowDurationMins: secondary.windowDurationMins as number | undefined,
            resetsAt: secondary.resetsAt as number | undefined,
          } : undefined,
          credits: credits ? {
            hasCredits: credits.hasCredits as boolean,
            balance: credits.balance as string | undefined,
            unlimited: credits.unlimited as boolean,
          } : undefined,
        };
      } catch (error) {
        logError("Failed to get rate limits:", error);
        return null;
      }
    },

    async listSkills(): Promise<import("./adapter.types").SkillInfo[]> {
      try {
        const server = await ensureServer();
        const result = await server.sendRequest("skills/list", { forceReload: true }) as Record<string, unknown>;
        const entries = result?.data as Array<Record<string, unknown>> | undefined;

        const skills: import("./adapter.types").SkillInfo[] = [];
        if (entries && Array.isArray(entries)) {
          for (const entry of entries) {
            const entrySkills = entry.skills as Array<Record<string, unknown>> | undefined;
            if (!entrySkills) continue;
            for (const s of entrySkills) {
              if (!s.enabled) continue;
              const iface = s.interface as Record<string, unknown> | undefined;
              skills.push({
                name: s.name as string,
                description: (iface?.shortDescription as string) || (s.shortDescription as string) || (s.description as string) || "",
                source: (s.scope === "user" ? "user" : s.scope === "repo" ? "project" : undefined) as "user" | "project" | undefined,
                path: s.path as string | undefined,
                userInvokable: true,
              });
            }
          }
        }

        return skills;
      } catch (error) {
        logError("Failed to list skills:", error);
        return [];
      }
    },

    async generateTitle(goal: string): Promise<string> {
      return goal.slice(0, 50);
    },

    async listPlugins(): Promise<PluginListResponse> {
      try {
        const server = await ensureServer();

        const result = await server.sendRequest("plugin/list", {}, 30000) as Record<string, unknown>;

        const rawMarketplaces = result?.marketplaces as Array<Record<string, unknown>> | undefined;
        if (!rawMarketplaces || !Array.isArray(rawMarketplaces)) {
          return { marketplaces: [], marketplaceLoadErrors: [], remoteSyncError: null, featuredPluginIds: [] };
        }

        const marketplaces: MarketplaceInfo[] = rawMarketplaces.map((mp) => {
          const rawPlugins = mp.plugins as Array<Record<string, unknown>> | undefined;
          const plugins: PluginInfo[] = (rawPlugins ?? []).map((p) => ({
            id: p.id as string,
            name: p.name as string,
            source: (p.source as { type: string; path: string }) ?? { type: "local", path: "" },
            installed: (p.installed as boolean) ?? false,
            enabled: (p.enabled as boolean) ?? false,
            installPolicy: (p.installPolicy as PluginInfo["installPolicy"]) ?? "AVAILABLE",
            authPolicy: (p.authPolicy as PluginInfo["authPolicy"]) ?? "ON_INSTALL",
            interface: p.interface ? {
              displayName: (p.interface as any).displayName ?? undefined,
              shortDescription: (p.interface as any).shortDescription ?? undefined,
              longDescription: (p.interface as any).longDescription ?? undefined,
              developerName: (p.interface as any).developerName ?? undefined,
              category: (p.interface as any).category ?? undefined,
              capabilities: (p.interface as any).capabilities ?? [],
              websiteUrl: (p.interface as any).websiteUrl ?? undefined,
              defaultPrompt: (p.interface as any).defaultPrompt ?? undefined,
              brandColor: (p.interface as any).brandColor ?? undefined,
              composerIcon: fileToDataUrl((p.interface as any).composerIcon),
              logo: fileToDataUrl((p.interface as any).logo),
              screenshots: ((p.interface as any).screenshots ?? []).map((s: string) => fileToDataUrl(s)).filter(Boolean) as string[],
              privacyPolicyUrl: (p.interface as any).privacyPolicyUrl ?? undefined,
              termsOfServiceUrl: (p.interface as any).termsOfServiceUrl ?? undefined,
            } : null,
          }));

          return {
            name: mp.name as string,
            path: mp.path as string,
            interface: mp.interface as { displayName?: string } | null,
            plugins,
          };
        });

        // Cache marketplace paths for install/uninstall
        for (const mp of marketplaces) {
          marketplacePathCache.set(mp.name, mp.path);
        }

        return {
          marketplaces,
          marketplaceLoadErrors: (result.marketplaceLoadErrors as any[]) ?? [],
          remoteSyncError: (result.remoteSyncError as string) ?? null,
          featuredPluginIds: (result.featuredPluginIds as string[]) ?? [],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logError("Failed to list plugins:", msg);
        // If the endpoint doesn't exist, return empty gracefully
        if (/method not found|unknown method|not supported/i.test(msg)) {
          logWarn("plugin/list not supported by this Codex version");
        }
        return { marketplaces: [], marketplaceLoadErrors: [], remoteSyncError: msg, featuredPluginIds: [] };
      }
    },

    async readPlugin(pluginName: string, marketplacePath: string): Promise<PluginDetail> {
      const server = await ensureServer();
      const result = await server.sendRequest("plugin/read", { pluginName, marketplacePath }, 15000) as Record<string, unknown>;
      const p = result?.plugin as Record<string, unknown>;
      if (!p) throw new Error("plugin/read returned no plugin data");

      const summary = p.summary as Record<string, unknown>;
      const iface = summary?.interface as Record<string, unknown> | undefined;
      const skills = (p.skills as Array<Record<string, unknown>>) ?? [];
      const apps = (p.apps as Array<Record<string, unknown>>) ?? [];

      return {
        marketplaceName: p.marketplaceName as string,
        marketplacePath: p.marketplacePath as string,
        summary: {
          id: summary.id as string,
          name: summary.name as string,
          source: (summary.source as { type: string; path: string }) ?? { type: "local", path: "" },
          installed: (summary.installed as boolean) ?? false,
          enabled: (summary.enabled as boolean) ?? false,
          installPolicy: (summary.installPolicy as PluginInfo["installPolicy"]) ?? "AVAILABLE",
          authPolicy: (summary.authPolicy as PluginInfo["authPolicy"]) ?? "ON_INSTALL",
          interface: iface ? {
            displayName: iface.displayName as string | undefined,
            shortDescription: iface.shortDescription as string | undefined,
            longDescription: iface.longDescription as string | undefined,
            developerName: iface.developerName as string | undefined,
            category: iface.category as string | undefined,
            capabilities: (iface.capabilities as string[]) ?? [],
            websiteUrl: iface.websiteUrl as string | undefined,
            defaultPrompt: iface.defaultPrompt as string[] | undefined,
            brandColor: iface.brandColor as string | undefined,
            composerIcon: fileToDataUrl(iface.composerIcon as string | undefined),
            logo: fileToDataUrl(iface.logo as string | undefined),
            screenshots: ((iface.screenshots as string[]) ?? []).map((s) => fileToDataUrl(s)).filter(Boolean) as string[],
            privacyPolicyUrl: iface.privacyPolicyUrl as string | undefined,
            termsOfServiceUrl: iface.termsOfServiceUrl as string | undefined,
          } : null,
        },
        description: (p.description as string) ?? null,
        skills: skills.map((s) => {
          const sIface = s.interface as Record<string, unknown> | undefined;
          return {
            name: s.name as string,
            displayName: (sIface?.displayName as string | undefined) ?? undefined,
            path: s.path as string | undefined,
            description: (sIface?.longDescription as string | undefined) ?? (s.description as string | undefined),
            shortDescription: (sIface?.shortDescription as string | undefined) ?? (s.shortDescription as string | undefined),
            enabled: (s.enabled as boolean) ?? false,
          };
        }),
        apps: apps.map((a) => ({
          id: a.id as string,
          name: a.name as string,
          needsAuth: (a.needsAuth as boolean) ?? false,
          description: a.description as string | undefined,
          installUrl: a.installUrl as string | undefined,
          isAccessible: a.isAccessible as boolean | undefined,
          isEnabled: a.isEnabled as boolean | undefined,
        })),
        mcpServers: (p.mcpServers as string[]) ?? [],
      };
    },

    async installPlugin(pluginId: string): Promise<void> {
      const server = await ensureServer();
      // pluginId format: "name@marketplace" e.g. "github@openai-curated"
      const atIdx = pluginId.lastIndexOf("@");
      const marketplaceName = atIdx !== -1 ? pluginId.slice(atIdx + 1) : "";
      const marketplacePath = marketplacePathCache.get(marketplaceName);
      if (!marketplacePath) {
        throw new Error(`Marketplace path not found for "${marketplaceName}". Try browsing plugins first.`);
      }
      const pluginName = atIdx !== -1 ? pluginId.slice(0, atIdx) : pluginId;
      await server.sendRequest("plugin/install", { pluginName, marketplacePath });

      // Enable the plugin after install via config
      try {
        await server.sendRequest("config/value/write", {
          keyPath: `plugins.${pluginId}.enabled`,
          value: true,
          mergeStrategy: "replace",
        });
      } catch (err) {
        logWarn("Failed to auto-enable plugin via config:", err);
      }

      logInfo(`Plugin installed and enabled: ${pluginId}`);
    },

    async uninstallPlugin(pluginId: string): Promise<void> {
      const server = await ensureServer();
      const atIdx = pluginId.lastIndexOf("@");
      const marketplaceName = atIdx !== -1 ? pluginId.slice(atIdx + 1) : "";
      const marketplacePath = marketplacePathCache.get(marketplaceName);
      if (!marketplacePath) {
        throw new Error(`Marketplace path not found for "${marketplaceName}". Try browsing plugins first.`);
      }
      await server.sendRequest("plugin/uninstall", { pluginId, marketplacePath });
      logInfo(`Plugin uninstalled: ${pluginId}`);
    },
  };
}
