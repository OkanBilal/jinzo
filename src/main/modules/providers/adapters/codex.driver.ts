// ─────────────────────────────────────────────────────────────
// OpenAI Codex ProviderDriver
//
// SDK-specific seam for `codex app-server` (JSON-RPC over stdio). Wrapped by
// `createWorkRunAdapter()` in work-run-core.ts to expose the WorkRunAdapter
// interface.
//
// Codex is the only driver that exercises all four acquisition verbs
// (createSession + resumeSession + forkSession + reviewSession). Each acquires
// a thread via `thread/start|resume|fork`; `executePrompt` then sends the
// turn (`turn/start` for chat, `review/start` for review) and awaits
// completion via `waitForTurnCompletion`.
//
// Per-run state (streaming buffers, fileChange tracking, sub-agent metadata)
// stays in the factory-closure `activeRuns` Map keyed by runId — the
// notification handler reads it via runId from the closure. CodexSession is
// a thin wrapper carrying runId + a `startTurn` callback that fires the
// right `turn/start` or `review/start` request.
// ─────────────────────────────────────────────────────────────

import { spawn, type ChildProcess } from "node:child_process";
import { type Interface as ReadlineInterface } from "node:readline";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { shell } from "electron";
import { findCodexBinaryPath } from "../providers.utils";
import { CHANNELS } from "../../../../shared/ipc-kit/channels";
import { emit } from "../../../ipc-kit";
import { PROVIDER_IDS } from "../../../../shared/provider-ids";
import type {
  AcquiredSession,
  CliUpdateResult,
  AccountInfo,
  CodexAdapterConfig,
  DriverOutcome,
  GoalInfo,
  GoalSetParams,
  ModelInfo,
  PluginDetail,
  PluginInfo,
  PluginListResponse,
  ProviderDriver,
  RateLimitInfo,
  WorkRunContextItem,
  WorkRunContinueRequest,
  WorkRunEvent,
  WorkRunEventHandler,
  WorkRunForkRequest,
  WorkRunRequest,
  WorkRunReviewRequest,
  WorkRunUsage,
} from "../../../../shared/adapter.types";
import {
  cancelPendingRequests,
  requestToolApproval,
} from "../../runs/user-input-broker";
import { runsRepo } from "../../runs/runs.repo";
import { logWorkspaceActivity } from "../../workspace";
// Direct repo import — a known driver egress-seam leak (see CONTEXT.md
// "Repos are module-internal"); goes away when review persistence routes
// through the SaveReview/SaveFinding tools.
import { workspaceRepo } from "../../workspace/workspace.repo";
import {
  createLogger,
  safeJson,
  extractArtifactsFromToolOutput,
  formatContextSection,
  appendPromptSections,
  saveAttachments,
} from "./adapter.shared";
import type { MainsToolContext } from "./mains-tools.core";
import {
  toCodexDynamicTools,
  dispatchMainsTool,
} from "./mains-tools.registry";
import { guardsService } from "../../guards/guards.service";

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

export const CODEX_ARCHIVED_CHAT_MESSAGE =
  "This chat is archived in Codex. Unarchive it in Codex to continue, or archive it in Mains to hide it from this workspace.";

function codexErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isCodexArchivedThreadError(error: unknown): boolean {
  return /\b(?:session|thread)\b[^\n]*\bis archived\b/i.test(
    codexErrorMessage(error),
  );
}

function isCodexMissingThreadError(error: unknown): boolean {
  return (
    /\b(?:session|thread)\b[^\n]*\bnot found\b/i.test(
      codexErrorMessage(error),
    ) ||
    /\b(?:missing|unknown) thread\b|\b(?:session|thread)\b[^\n]*\bdoes not exist\b/i.test(
      codexErrorMessage(error),
    )
  );
}

export function isCodexUnavailableThreadError(error: unknown): boolean {
  return (
    isCodexArchivedThreadError(error) ||
    isCodexMissingThreadError(error)
  );
}

export function normalizeCodexResumeError(error: unknown): Error {
  if (isCodexArchivedThreadError(error)) {
    return new Error(CODEX_ARCHIVED_CHAT_MESSAGE);
  }
  return error instanceof Error ? error : new Error(String(error));
}

// ─────────────────────────────────────────────────────────────
// Thread item types (mirroring SDK types for event mapping)
// ─────────────────────────────────────────────────────────────

interface ThreadItem {
  id: string;
  type: string;
  [key: string]: unknown;
}

type ThreadItemPhase = "start" | "update" | "complete";

interface Usage {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
}

// ─────────────────────────────────────────────────────────────
// Approval mode mapping
// ─────────────────────────────────────────────────────────────

const VALID_SANDBOX_MODES = new Set(["read-only", "workspace-write", "danger-full-access"]);

export function mapSandboxMode(mode?: string): "read-only" | "workspace-write" | "danger-full-access" {
  return mode && VALID_SANDBOX_MODES.has(mode)
    ? (mode as "read-only" | "workspace-write" | "danger-full-access")
    : "workspace-write";
}

/**
 * Resolve the JSON Schema selected for structured output. Returns the schema
 * payload Codex's `turn/start` expects via `output_schema`, or undefined if
 * the user hasn't selected one. Mirrors the wiring in claude.adapter.ts.
 */
function resolveOutputSchema(
  config: CodexAdapterConfig,
): Record<string, unknown> | undefined {
  const selectedId = config.structuredOutputsSelectedId;
  if (!selectedId) return undefined;
  return config.structuredOutputs?.[selectedId]?.schema;
}

/**
 * Codex's app-server treats ThreadStartParams.config as a TOML override map
 * (codex-rs/config/src/overrides.rs::build_cli_overrides_layer). The key uses
 * dotted-path notation matching ConfigToml fields. Network access lives under
 * `sandbox_workspace_write.network_access` — there is NO top-level
 * `sandbox_network_access` field.
 */
function buildCodexConfigOverrides(networkAccess: boolean): Record<string, unknown> {
  return {
    sandbox_workspace_write: { network_access: networkAccess },
  };
}

/**
 * Build the `collaborationMode` payload for `turn/start`. Codex treats
 * `collaborationMode` as sticky — once a thread enters `mode: "plan"`, it
 * stays there until explicitly reset. So:
 *
 * - `startRun` (new thread): pass `forceReset=false` → only send when plan
 *   is on; omit otherwise so Codex uses its defaults.
 * - `continueRun` / `forkRun` (existing thread): pass `forceReset=true` →
 *   when plan is off, send `mode: "default"` to clear any stuck plan state
 *   from a prior turn. Without this the agent keeps responding "I'm still
 *   in Plan Mode" even after the user toggled it off.
 *
 * Built-in instructions for the selected mode are activated by sending
 * `developer_instructions: null`. The Plan preset uses medium reasoning
 * effort by default; if the caller has an explicit effort, we forward that.
 */
export function buildCollaborationMode(
  planEnabled: boolean,
  model: string | undefined,
  effort: string | undefined,
  forceReset: boolean = false,
): Record<string, unknown> | undefined {
  if (!planEnabled && !forceReset) return undefined;
  return {
    mode: planEnabled ? "plan" : "default",
    settings: {
      model: model ?? "",
      reasoning_effort: effort ?? (planEnabled ? "medium" : null),
      developer_instructions: null,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Codex review text parser
// ─────────────────────────────────────────────────────────────

interface ParsedReviewFinding {
  severity: "critical" | "warning" | "info";
  title: string;
  file: string;
  lineStart?: number;
  lineEnd?: number;
  message: string;
  reason: string;
}

const PRIORITY_MAP: Record<string, "critical" | "warning" | "info"> = {
  P1: "critical",
  P2: "warning",
  P3: "info",
};

/**
 * Parse Codex review/start output into structured findings.
 *
 * Format:
 *   - [P1] Title — /path/to/file.ts:50-51
 *     Description text spanning one or more lines...
 */
export function parseCodexReviewFindings(reviewText: string): ParsedReviewFinding[] {
  try {
    if (!reviewText || typeof reviewText !== "string") return [];

    const findings: ParsedReviewFinding[] = [];

    // Split on finding headers: "- [P1]", "- [P2]", "- [P3]"
    const blocks = reviewText.split(/\n(?=- \[P[123]\] )/);

    for (const block of blocks) {
      try {
        // Match: - [P1] Title — file/path:lineStart-lineEnd
        const headerMatch = block.match(
          /^- \[(P[123])]\s+(.+?)\s+[—-]+\s+(.+?)(?::(\d+)(?:-(\d+))?)?\s*\n([\s\S]*)/,
        );
        if (!headerMatch) continue;

        const [, priority, title, filePath, lineStartStr, lineEndStr, body] = headerMatch;
        if (!title || !filePath) continue;

        const severity = PRIORITY_MAP[priority] ?? "info";
        const description = (body ?? "").replace(/^ {2}/gm, "").trim();

        findings.push({
          severity,
          title: title.trim(),
          file: filePath.trim(),
          lineStart: lineStartStr ? parseInt(lineStartStr, 10) : undefined,
          lineEnd: lineEndStr ? parseInt(lineEndStr, 10) : undefined,
          message: title.trim(),
          reason: description || title.trim(),
        });
      } catch {
        // Skip malformed finding block
      }
    }

    return findings;
  } catch {
    // If parsing fails entirely, return empty — review text still shows as report artifact
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Mains Dynamic Tools (registered per-thread via dynamicTools)
// ─────────────────────────────────────────────────────────────

const MAINS_DYNAMIC_TOOLS = toCodexDynamicTools();

const MAINS_TOOL_NAMES = new Set(MAINS_DYNAMIC_TOOLS.map((t) => t.name));

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
  /** Workspace context for mains dynamic tools */
  mainsCtx: MainsToolContext;
  /** Accumulated file change diff content per itemId (from output/delta events) */
  fileChangeBuffers: Map<string, string>;
  /**
   * fileChange item details keyed by itemId, captured on item/started.
   * `item/fileChange/requestApproval` only carries `itemId`/`reason`, so we
   * look paths/kind up here to render a useful approval dialog.
   */
  fileChangeItems: Map<string, Array<{ path: string; kind: string; diff?: string }>>;
  /** Shell stdout/stderr chunks per command_execution itemId (Codex streams here; completed item often omits aggregatedOutput) */
  commandOutputBuffers: Map<string, string>;
  /** Absolute image paths already emitted as artifacts during this run (deduped) */
  emittedImagePaths: Set<string>;
  /** Absolute Office document paths already emitted as artifacts this run (deduped) */
  emittedDocPaths: Set<string>;
  /** ms epoch when this run/turn began — used to surface only docs created this
   * run, not pre-existing files the agent merely listed (e.g. `ls outputs/`). */
  runStartedAt: number;
  /**
   * Accumulated plan text per plan itemId. Codex streams plan content via
   * `item/plan/delta` (experimental); we concatenate deltas keyed by itemId
   * and flush as an artifact when the plan item completes.
   */
  planBuffers: Map<string, string>;
  /**
   * Sub-agent metadata keyed by sub-thread id. Captured from `thread/started`
   * notifications for AgentControl-spawned sub-threads (which carry
   * `agentNickname`/`agentRole`). Used to render Conductor-style "Spawned X Y"
   * lines on `collabAgentToolCall` (`spawnAgent`) items.
   */
  subAgents: Map<string, { threadId: string; nickname?: string; role?: string }>;
  /**
   * App/connector elicitation servers the user approved "for this run". The MCP
   * elicitation response only speaks accept/decline/cancel (no session scope
   * like command-exec's `acceptForSession`), so we honor "Allow for this run"
   * on the Mains side: once a form-mode elicitation is approved for the run,
   * later elicitations from the same `serverName` auto-accept without prompting.
   * Lazily created; cleared automatically when the run's activeRuns entry is
   * deleted. url-mode elicitations are never cached (they need a browser step).
   */
  approvedElicitationServers?: Set<string>;
}>();

// Session ID mapping: runId → threadId (for resume support)
const sessionIdMap = new Map<string, string>();

// Track saved review item IDs to prevent duplicate persistence
const savedReviewItems = new Set<string>();

// No-op handlers installed when waitForTurnCompletion finishes, so any late
// notifications/requests from a long-running codex turn don't fall back into
// stale closures that still reference a finished run's onEvent.
const noopNotificationHandler = (_method: string, _params: unknown): void => undefined;
const noopServerRequestHandler = (id: number | string, _method: string, _params: unknown): void => {
  // Best-effort: nothing to do here. The next active run will replace this
  // handler before the caller observes any side effect; until then any inbound
  // request will simply time out on codex's side, which is the correct
  // behavior when there's no live run to respond from.
  void id;
};

const { info: logInfo, error: logError, warn: logWarn } = createLogger("[CodexDriver]");

// ─────────────────────────────────────────────────────────────
// Rate-limit snapshot mapping + live push
// ─────────────────────────────────────────────────────────────

/**
 * Map a Codex `RateLimitSnapshot` (from `account/rateLimits/read` or the
 * `account/rateLimits/updated` notification — identical wire shape) into mains'
 * `RateLimitInfo`. Shared by the pull path (`getRateLimits`) and the live push.
 */
export function mapRateLimitSnapshot(rl: Record<string, unknown> | undefined): RateLimitInfo | null {
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
}

/** Push a fresh rate-limit snapshot to every client via the event bus. */
function broadcastRateLimits(providerId: string, rateLimits: RateLimitInfo | null): void {
  if (!rateLimits) return;
  emit(CHANNELS.providers.rateLimitsUpdated, { providerId, rateLimits });
}

/**
 * Map a raw Codex goal object (from `thread/goal/*` results or the
 * `thread/goal/updated` notification — identical wire shape) into `GoalInfo`.
 */
function mapGoalSnapshot(raw: Record<string, unknown> | null | undefined): GoalInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const threadId = raw.threadId as string | undefined;
  if (!threadId) return null;
  return {
    threadId,
    objective: (raw.objective as string) ?? "",
    status: (raw.status as string) ?? "active",
    tokenBudget: raw.tokenBudget as number | undefined,
    tokensUsed: raw.tokensUsed as number | undefined,
    timeUsedSeconds: raw.timeUsedSeconds as number | undefined,
    createdAt: raw.createdAt as number | undefined,
    updatedAt: raw.updatedAt as number | undefined,
  };
}

/**
 * Push a goal change to every live renderer window. `goal === null` signals the
 * goal was cleared. Carries `runId` so the renderer can match it to the active
 * run's card. Mirrors {@link broadcastRateLimits}.
 */
function broadcastGoal(providerId: string, runId: string | null, goal: GoalInfo | null): void {
  emit(CHANNELS.providers.goalUpdated, { providerId, runId, goal }, runId ? { runId } : undefined);
}

/**
 * Make `@<absolute path>` file mentions in a goal objective relative to the
 * workspace root, so the goal reads `@src/foo.ts` instead of the long worktree
 * prefix (e.g. ~/Library/Application Support/mains/worktrees/…). Relative paths
 * are also more useful to the agent, which runs with cwd = rootPath. Mentions
 * pointing outside the workspace are left untouched.
 */
export function relativizeGoalMentions(goal: string, rootPath: string | undefined): string {
  if (!rootPath || !goal) return goal;
  // Literal replace (not regex) so roots containing spaces — e.g. macOS
  // "Application Support" in the worktree path — are matched correctly.
  const root = rootPath.endsWith("/") ? rootPath : rootPath + "/";
  return goal.split("@" + root).join("@");
}

/**
 * Translate Codex's dedicated image-generation item lifecycle into a
 * renderer-only placeholder stream. The final image remains a normal,
 * persisted image artifact emitted from the completed item's `savedPath`.
 */
export function mapImageGenerationLifecycle(
  item: Pick<ThreadItem, "id"> & { status?: unknown },
  phase: ThreadItemPhase,
  runId: string,
  ts: number,
): WorkRunEvent[] {
  const streamId = `codex-image-generation-${runId}-${item.id}`;

  if (phase === "start") {
    return [{
      type: "artifact",
      kind: "image_generation",
      content: "Generating image",
      metadata: {
        source: "codex_image_generation",
        itemId: item.id,
        status: typeof item.status === "string" ? item.status : "inProgress",
      },
      ephemeral: true,
      streamId,
      ts,
    }];
  }

  if (phase !== "complete") return [];

  const events: WorkRunEvent[] = [{
    type: "artifact",
    kind: "image_generation",
    content: "",
    metadata: {
      source: "codex_image_generation",
      itemId: item.id,
      status: typeof item.status === "string" ? item.status : "completed",
    },
    ephemeral: true,
    streamId,
    ts,
  }];

  if (item.status === "failed") {
    events.push({
      type: "log",
      message: "Codex image generation failed",
      level: "error",
      ts,
      metadata: { itemId: item.id },
    });
  }

  return events;
}

/**
 * Register a run's prompt as the thread's goal when goal mode is on.
 *
 * - New threads (`createSession`) pass `overwrite=true` — the first prompt IS
 *   the goal, set it unconditionally.
 * - Continue / fork pass `overwrite=false` — a goal is thread-scoped and meant
 *   to persist across turns, so we must NOT clobber an in-progress goal with
 *   every follow-up. We only (re)set when there's no goal yet or the previous
 *   one already completed; an active/paused/blocked goal is left as-is for the
 *   new turn to keep pursuing.
 */
async function maybeSetThreadGoal(
  server: { sendRequest: (method: string, params?: unknown) => Promise<unknown> },
  threadId: string | undefined,
  goalMode: boolean,
  rawObjective: string | undefined,
  rootPath: string | undefined,
  overwrite: boolean,
): Promise<void> {
  if (!goalMode || !threadId || !rawObjective?.trim()) return;
  if (!overwrite) {
    try {
      const existing = (await server.sendRequest("thread/goal/get", { threadId })) as
        | { goal?: { status?: string } | null }
        | undefined;
      if (existing?.goal && existing.goal.status !== "complete") return;
    } catch {
      /* no goal / get failed — fall through and set */
    }
  }
  const objective = relativizeGoalMentions(rawObjective, rootPath);
  await server
    .sendRequest("thread/goal/set", { threadId, objective })
    .catch((err) => logWarn("thread/goal/set failed:", err instanceof Error ? err.message : err));
}

/** Reverse-lookup the runId that owns a Codex threadId (for goal notifications). */
function runIdForThread(threadId: string | undefined): string | null {
  if (!threadId) return null;
  for (const [runId, tid] of sessionIdMap) {
    if (tid === threadId) return runId;
  }
  return null;
}

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
      // Guard: if we've accumulated >32MB without a parseable message we're
      // almost certainly stuck on malformed output. Reset to avoid unbounded
      // memory growth.
      if (this.jsonBuffer.length > 32 * 1024 * 1024) {
        logError(
          `jsonBuffer exceeded 32MB (${this.jsonBuffer.length} bytes), resetting`,
        );
        this.jsonBuffer = "";
      }
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

// Image path scanning helpers — used to surface generated images from tool outputs
// even when the agent doesn't mention the path in chat text.
const IMAGE_PATH_SCAN_REGEX = /([~/][\w./\- ]+\.(?:png|jpe?g|webp|gif))/gi;

function expandHomeTilde(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function findImagePathsInValue(value: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (v: unknown, depth: number): void => {
    if (v == null || depth > 6) return;
    if (typeof v === "string") {
      for (const m of v.matchAll(IMAGE_PATH_SCAN_REGEX)) {
        const p = m[1];
        if (!p || p.includes("://")) continue;
        const idx = m.index ?? 0;
        const before = v.slice(Math.max(0, idx - 12), idx);
        if (before.includes("://")) continue;
        if (seen.has(p)) continue;
        seen.add(p);
        out.push(p);
      }
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) visit(item, depth + 1);
      return;
    }
    if (typeof v === "object") {
      for (const item of Object.values(v as Record<string, unknown>)) {
        visit(item, depth + 1);
      }
    }
  };
  visit(value, 0);
  return out;
}

/**
 * Only surface images that come from Codex's own generated_images dir or live
 * inside the active workspace. Random PNG path references picked up from grep
 * / file reads (e.g. icons in the codebase) would otherwise produce noisy
 * artifact cards.
 */
function isAllowedImagePath(resolved: string, workspaceRoot: string | null): boolean {
  const codexGenDir = path.join(os.homedir(), ".codex", "generated_images");
  if (resolved === codexGenDir || resolved.startsWith(codexGenDir + path.sep)) {
    return true;
  }
  if (workspaceRoot) {
    const root = path.resolve(workspaceRoot);
    if (resolved === root || resolved.startsWith(root + path.sep)) {
      return true;
    }
  }
  return false;
}

function emitImageArtifacts(
  events: WorkRunEvent[],
  runId: string | undefined,
  source: unknown,
  ts: number,
): void {
  if (!runId) return;
  const rs = activeRuns.get(runId);
  if (!rs) return;
  for (const raw of findImagePathsInValue(source)) {
    const expanded = expandHomeTilde(raw);
    if (!path.isAbsolute(expanded)) continue;
    const resolved = path.resolve(expanded);
    if (rs.emittedImagePaths.has(resolved)) continue;
    if (!isAllowedImagePath(resolved, rs.mainsCtx.rootPath)) continue;
    try {
      const stat = fs.lstatSync(resolved);
      if (stat.isSymbolicLink() || !stat.isFile()) continue;
    } catch {
      continue;
    }
    rs.emittedImagePaths.add(resolved);
    events.push({
      type: "artifact",
      kind: "image",
      content: "",
      metadata: { kind: "image", path: resolved, fileName: path.basename(resolved) },
      ts,
    });
  }
}

// Office document path scanning — mirror of the image scanner above. Surfaces
// generated .pptx/.docx/.xlsx files as artifact cards even when the agent only
// references them in prose. Reuses the same workspace allowlist + symlink guard.
function docTypeFromPath(p: string): "pptx" | "docx" | "xlsx" | null {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".pptx") return "pptx";
  if (ext === ".docx") return "docx";
  if (ext === ".xlsx") return "xlsx";
  return null;
}

/** Collect every string value in an arbitrary object/array tree (bounded depth). */
function collectStrings(value: unknown, out: string[], depth: number): void {
  if (value == null || depth > 6) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStrings(v, out, depth + 1);
    }
  }
}

/** Clock-skew slack so a doc written moments before the run's recorded start
 * still counts as "created this run". */
const DOC_MTIME_SKEW_MS = 10_000;

/** Emit a `document` artifact for one resolved absolute path, applying the
 * workspace allowlist + symlink/existence guards, a "created this run" mtime
 * gate, and per-run dedup. */
function emitDocAtResolvedPath(
  events: WorkRunEvent[],
  rs: { emittedDocPaths: Set<string>; mainsCtx: MainsToolContext; runStartedAt: number },
  resolved: string,
  ts: number,
): void {
  if (rs.emittedDocPaths.has(resolved)) return;
  if (!isAllowedImagePath(resolved, rs.mainsCtx.rootPath)) return;
  const docType = docTypeFromPath(resolved);
  if (!docType) return;
  try {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink() || !stat.isFile()) return;
    // Only surface docs created/modified during this run — not pre-existing
    // files the agent merely referenced (e.g. an `ls outputs/documents`).
    if (stat.mtimeMs < rs.runStartedAt - DOC_MTIME_SKEW_MS) return;
  } catch {
    return;
  }
  rs.emittedDocPaths.add(resolved);
  events.push({
    type: "artifact",
    kind: "document",
    content: "",
    metadata: {
      kind: "document",
      path: resolved,
      fileName: path.basename(resolved),
      docType,
    },
    ts,
  });
}

function emitDocumentArtifacts(
  events: WorkRunEvent[],
  runId: string | undefined,
  source: unknown,
  ts: number,
): void {
  // Flatten the item tree to its strings and run the permissive, workspace-
  // root-resolving scan over them — this catches both absolute paths in tool
  // output and bare/relative names mentioned in item fields.
  const strings: string[] = [];
  collectStrings(source, strings, 0);
  if (strings.length === 0) return;
  emitDocumentArtifactsFromText(events, runId, strings.join("\n"), ts);
}

/**
 * Scan free text (e.g. the agent's final "Done: report.docx" message) for
 * document references, resolving bare/relative names against the workspace
 * root. More permissive than the item scanner — the existence + allowlist
 * checks in {@link emitDocAtResolvedPath} keep prose false-positives out. This
 * is the reliable path when the rendered .png previews live in
 * ~/.codex/generated_images while the real document sits in the workspace.
 */
// No spaces in the name portion so prose ("the report.docx") splits on the
// word boundary and yields just "report.docx" rather than swallowing the
// preceding word. (Paths with spaces are rare for generated docs.)
const DOC_NAME_SCAN_REGEX = /([~/]?[\w.\-/]*[\w-]\.(?:pptx|docx|xlsx))/gi;

function emitDocumentArtifactsFromText(
  events: WorkRunEvent[],
  runId: string | undefined,
  text: string | undefined | null,
  ts: number,
): void {
  if (!runId || !text) return;
  const rs = activeRuns.get(runId);
  if (!rs) return;
  const root = rs.mainsCtx.rootPath ? path.resolve(rs.mainsCtx.rootPath) : null;
  const seen = new Set<string>();
  for (const m of text.matchAll(DOC_NAME_SCAN_REGEX)) {
    const raw = m[1]?.trim();
    if (!raw || raw.includes("://") || seen.has(raw)) continue;
    seen.add(raw);
    const expanded = expandHomeTilde(raw);
    let resolved: string;
    if (path.isAbsolute(expanded)) {
      resolved = path.resolve(expanded);
    } else if (root) {
      resolved = path.resolve(root, expanded);
    } else {
      continue;
    }
    emitDocAtResolvedPath(events, rs, resolved, ts);
  }
}

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

interface AppDirectoryEntry {
  name?: string;
  description?: string;
  logoUrl?: string;
  installUrl?: string;
  isAccessible?: boolean;
  isEnabled?: boolean;
}

let appDirectoryMemo: { mtimeMs: number; map: Map<string, AppDirectoryEntry> } | null = null;

/**
 * App/connector id → directory entry from codex's cached ChatGPT connector
 * directory (`~/.codex/cache/codex_app_directory/*.json`). This is what gives
 * plugin apps their real logos and Connected state — `plugin/read` returns
 * only id/name/description/category for remote plugins. Best-effort: returns
 * an empty map when the cache is missing, and the auth state is only as fresh
 * as codex's last directory sync.
 */
function loadAppDirectory(): Map<string, AppDirectoryEntry> {
  try {
    const dir = path.join(os.homedir(), ".codex", "cache", "codex_app_directory");
    let newestPath: string | null = null;
    let newestMtime = 0;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const stat = fs.statSync(path.join(dir, f));
      if (stat.mtimeMs > newestMtime) {
        newestMtime = stat.mtimeMs;
        newestPath = path.join(dir, f);
      }
    }
    if (!newestPath) return new Map();
    if (appDirectoryMemo && appDirectoryMemo.mtimeMs === newestMtime) return appDirectoryMemo.map;

    const data = JSON.parse(fs.readFileSync(newestPath, "utf8")) as {
      connectors?: Array<Record<string, unknown>>;
    };
    const map = new Map<string, AppDirectoryEntry>();
    for (const c of data.connectors ?? []) {
      const id = c?.id as string | undefined;
      if (!id) continue;
      map.set(id, {
        name: (c.name as string) ?? undefined,
        description: (c.description as string) ?? undefined,
        logoUrl: (c.logoUrl as string) ?? undefined,
        installUrl: (c.installUrl as string) ?? undefined,
        isAccessible: (c.isAccessible as boolean) ?? undefined,
        isEnabled: (c.isEnabled as boolean) ?? undefined,
      });
    }
    appDirectoryMemo = { mtimeMs: newestMtime, map };
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Resolve a plugin asset to something the renderer can display. Older Codex
 * releases return local file paths (converted to data URLs); the remote plugin
 * catalog (openai-curated-remote) returns https/data URLs in the `*Url` fields
 * instead, with the path fields null. Tries each candidate in order.
 */
function pluginAssetUrl(...candidates: Array<string | undefined | null>): string | undefined {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (/^(https?:|data:)/i.test(candidate)) return candidate;
    const dataUrl = fileToDataUrl(candidate);
    if (dataUrl) return dataUrl;
  }
  return undefined;
}

export function mapCodexPluginList(
  result: Record<string, unknown> | null | undefined,
): PluginListResponse {
  const rawMarketplaces = Array.isArray(result?.marketplaces)
    ? result.marketplaces as Array<Record<string, unknown>>
    : [];

  return {
    marketplaces: rawMarketplaces.map((marketplace) => {
      const rawPlugins = Array.isArray(marketplace.plugins)
        ? marketplace.plugins as Array<Record<string, unknown>>
        : [];

      return {
        name: (marketplace.name as string) ?? "",
        path: (marketplace.path as string | null | undefined) ?? "",
        interface:
          (marketplace.interface as { displayName?: string } | null | undefined) ??
          null,
        plugins: rawPlugins.map((plugin): PluginInfo => {
          const pluginInterface = plugin.interface as Record<string, unknown> | null | undefined;
          return {
            id: (plugin.id as string) ?? "",
            name: (plugin.name as string) ?? "",
            source:
              (plugin.source as { type: string; path: string } | undefined) ??
              { type: "local", path: "" },
            installed: (plugin.installed as boolean) ?? false,
            enabled: (plugin.enabled as boolean) ?? false,
            installPolicy:
              (plugin.installPolicy as PluginInfo["installPolicy"]) ??
              "AVAILABLE",
            authPolicy:
              (plugin.authPolicy as PluginInfo["authPolicy"]) ?? "ON_INSTALL",
            interface: pluginInterface
              ? {
                  displayName:
                    (pluginInterface.displayName as string | undefined) ??
                    undefined,
                  shortDescription:
                    (pluginInterface.shortDescription as string | undefined) ??
                    undefined,
                  longDescription:
                    (pluginInterface.longDescription as string | undefined) ??
                    undefined,
                  developerName:
                    (pluginInterface.developerName as string | undefined) ??
                    undefined,
                  category:
                    (pluginInterface.category as string | undefined) ??
                    undefined,
                  capabilities:
                    (pluginInterface.capabilities as string[] | undefined) ?? [],
                  websiteUrl:
                    (pluginInterface.websiteUrl as string | undefined) ??
                    undefined,
                  defaultPrompt:
                    (pluginInterface.defaultPrompt as string[] | undefined) ??
                    undefined,
                  brandColor:
                    (pluginInterface.brandColor as string | undefined) ??
                    undefined,
                  composerIcon: pluginAssetUrl(
                    pluginInterface.composerIcon as string | undefined,
                    pluginInterface.composerIconUrl as string | undefined,
                  ),
                  logo: pluginAssetUrl(
                    pluginInterface.logo as string | undefined,
                    pluginInterface.logoUrl as string | undefined,
                  ),
                  screenshots: [
                    ...((pluginInterface.screenshots as string[] | undefined) ?? []),
                    ...((pluginInterface.screenshotUrls as string[] | undefined) ?? []),
                  ]
                    .map((screenshot) => pluginAssetUrl(screenshot))
                    .filter(Boolean) as string[],
                  privacyPolicyUrl:
                    (pluginInterface.privacyPolicyUrl as string | undefined) ??
                    undefined,
                  termsOfServiceUrl:
                    (pluginInterface.termsOfServiceUrl as string | undefined) ??
                    undefined,
                }
              : null,
          };
        }),
      };
    }),
    marketplaceLoadErrors:
      (result?.marketplaceLoadErrors as PluginListResponse["marketplaceLoadErrors"] | undefined) ??
      [],
    remoteSyncError: (result?.remoteSyncError as string | null | undefined) ?? null,
    featuredPluginIds: (result?.featuredPluginIds as string[] | undefined) ?? [],
  };
}

/**
 * Per-run session state handed back to Core as opaque `session`.
 * The runId is the only thing Core sees; everything else lives on the
 * factory-closure `activeRuns` map under the same runId.
 */
interface CodexSession {
  runId: string;
  /** Send the SDK request that kicks off the turn (`turn/start` or `review/start`). */
  startTurn: () => Promise<void>;
  /** Optional model name used for usage tracking inside `waitForTurnCompletion`. */
  model: string | undefined;
  /** Per-call timeout passed through to `waitForTurnCompletion`. */
  timeout: number;
  /**
   * Optional event the driver wants emitted right before `startTurn`. Used by
   * `reviewSession` to surface a custom user-prompt artifact (Core skips the
   * generic one for review verbs since `WorkRunReviewRequest` has no message).
   */
  preExecuteEvent?: WorkRunEvent;
}

/**
 * Creates a Codex driver using `codex app-server` JSON-RPC protocol.
 * Spawns `codex app-server` as a subprocess and communicates via
 * newline-delimited JSON-RPC over stdin/stdout.
 *
 * Key advantage over @openai/codex-sdk: model selection works per-turn,
 * bypassing ~/.codex/config.toml precedence issues.
 */
export function createCodexDriver(config: CodexAdapterConfig): ProviderDriver {
  let appServer: CodexAppServer | null = null;
  const titleGenerationModel = "gpt-5.4-mini";

  // Marketplace path cache: marketplace name → path
  const marketplacePathCache = new Map<string, string>();
  /**
   * Remote-catalog marketplaces (openai-curated-remote) have no on-disk path —
   * their plugins are addressed by backend id (`remotePluginId`) via the
   * `remoteMarketplaceName` param instead. Keyed by both the composite plugin
   * id (`name@marketplace`, used by install/uninstall) and the bare plugin
   * name (used by readPlugin, which never sees the composite id).
   */
  const remotePluginRefCache = new Map<string, { remotePluginId: string; marketplaceName: string }>();
  const pluginCatalogTtlMs = 15 * 60 * 1000;
  const installedPluginsTtlMs = 5 * 60 * 1000;
  let pluginCatalogCache: { value: PluginListResponse; fetchedAt: number } | null = null;
  let installedPluginsCache: { value: PluginListResponse; fetchedAt: number } | null = null;
  let pluginCatalogInFlight: Promise<PluginListResponse> | null = null;
  let installedPluginsInFlight: Promise<PluginListResponse> | null = null;
  let pluginCacheGeneration = 0;

  function indexPluginReferences(result: Record<string, unknown>): void {
    const rawMarketplaces = Array.isArray(result.marketplaces)
      ? result.marketplaces as Array<Record<string, unknown>>
      : [];
    for (const marketplace of rawMarketplaces) {
      const marketplaceName = marketplace.name as string;
      const marketplacePath = marketplace.path as string | null | undefined;
      if (marketplacePath) marketplacePathCache.set(marketplaceName, marketplacePath);

      const rawPlugins = Array.isArray(marketplace.plugins)
        ? marketplace.plugins as Array<Record<string, unknown>>
        : [];
      for (const plugin of rawPlugins) {
        const remotePluginId = plugin.remotePluginId as string | undefined;
        if (!remotePluginId) continue;
        const reference = { remotePluginId, marketplaceName };
        remotePluginRefCache.set(plugin.id as string, reference);
        remotePluginRefCache.set(plugin.name as string, reference);
      }
    }
  }

  async function fetchPluginList(method: "plugin/list" | "plugin/installed"): Promise<PluginListResponse> {
    const server = await ensureServer();
    const result = await server.sendRequest(method, {}, 30000) as Record<string, unknown>;
    indexPluginReferences(result);
    return mapCodexPluginList(result);
  }

  function pluginListFailure(
    error: unknown,
    method: "plugin/list" | "plugin/installed",
    staleValue?: PluginListResponse,
  ): PluginListResponse {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Failed to call ${method}:`, message);
    if (/method not found|unknown method|not supported/i.test(message)) {
      logWarn(`${method} not supported by this Codex version`);
    }
    if (staleValue) {
      return { ...staleValue, remoteSyncError: message };
    }
    return {
      marketplaces: [],
      marketplaceLoadErrors: [],
      remoteSyncError: message,
      featuredPluginIds: [],
    };
  }

  function invalidatePluginCaches(): void {
    pluginCacheGeneration += 1;
    pluginCatalogCache = null;
    installedPluginsCache = null;
    pluginCatalogInFlight = null;
    installedPluginsInFlight = null;
  }

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

    const resolved = findCodexBinaryPath();
    if (resolved) return resolved;

    throw new Error(
      "Codex CLI not found. Please install Codex and ensure `codex` is in your PATH, " +
      "or set config.binary to the full path of the codex executable."
    );
  }

  /**
   * Build the spawn env: HOME, an extended PATH (nvm node bins + common dirs so
   * the packaged app can find `codex`), and the OpenAI/Codex API key.
   */
  function buildCodexEnv(binaryPath: string): Record<string, string> {
    const env: Record<string, string> = {};
    env.HOME = os.homedir();

    const homedir = os.homedir();
    const extraPaths = [
      path.dirname(binaryPath),
      path.join(homedir, ".nvm", "versions", "node"),
      "/usr/local/bin",
      "/opt/homebrew/bin",
    ];
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
    return env;
  }

  /** Run a one-shot `codex <args>` CLI command (not the app-server). */
  function runCodexCli(
    args: string[],
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const binaryPath = findCodexBinary();
    const env = { ...process.env, ...buildCodexEnv(binaryPath) };
    return new Promise((resolve) => {
      const child = spawn(binaryPath, args, {
        env,
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

  /** Read the installed Codex CLI version (e.g. "0.135.0" from "codex-cli 0.135.0"). */
  async function getCodexVersion(): Promise<string | null> {
    try {
      const { stdout } = await runCodexCli(["--version"], 8000);
      const match = stdout.trim().match(/(\d+\.\d+\.\d+[^\s]*)/);
      return match ? match[1] : stdout.trim() || null;
    } catch {
      return null;
    }
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
    const env = buildCodexEnv(binaryPath);

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
        name: "mains",
        title: "Mains Desktop",
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

      // Live rate-limit snapshot — push to the renderer so the Codex settings
      // panel (and any future indicator) refreshes immediately instead of
      // waiting for its 60s poll. Account-scoped, so it lives in the background
      // handler and fires regardless of run lifecycle.
      if (method === "account/rateLimits/updated") {
        const rl = (params as Record<string, unknown> | undefined)?.rateLimits as
          | Record<string, unknown>
          | undefined;
        broadcastRateLimits(PROVIDER_IDS.codex, mapRateLimitSnapshot(rl));
      }

      // Live goal updates — push to the renderer so the goal card above the
      // input reflects status/usage as Codex tracks the objective. Thread-
      // scoped, so we reverse-map threadId → runId for the card to match.
      if (method === "thread/goal/updated") {
        const p = params as Record<string, unknown> | undefined;
        const goal = mapGoalSnapshot(p?.goal as Record<string, unknown> | undefined);
        const threadId = (p?.threadId ?? goal?.threadId) as string | undefined;
        broadcastGoal(PROVIDER_IDS.codex, runIdForThread(threadId), goal);
      }
      if (method === "thread/goal/cleared") {
        const p = params as Record<string, unknown> | undefined;
        const threadId = p?.threadId as string | undefined;
        broadcastGoal(PROVIDER_IDS.codex, runIdForThread(threadId), null);
      }
    });

    logInfo("App-server initialized successfully")
    return server;
  }

  // ─────────────────────────────────────────────────────────────
  // Event mapping: app-server notifications → WorkRunEvent
  // ─────────────────────────────────────────────────────────────

  /**
   * Resolve the thread item id for streamed output chunks.
   * Canonical Codex notification: `item/commandExecution/outputDelta` with
   * `CommandExecutionOutputDeltaNotification` JSON fields `threadId`, `turnId`, `itemId`, `delta`
   * (camelCase on the wire — see `codex-rs/app-server-protocol` v2).
   * Docs: https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md#events
   * (`item.id` from `item/started` matches delta `itemId`.)
   * Also accepts snake_case / nested `item` for tolerance.
   */
  function resolveStreamOutputItemId(p: Record<string, unknown> | undefined): string | undefined {
    if (!p) return undefined;
    const cand =
      (typeof p.itemId === "string" && p.itemId) ||
      (typeof p.item_id === "string" && p.item_id) ||
      (typeof p.threadItemId === "string" && p.threadItemId) ||
      (typeof p.thread_item_id === "string" && p.thread_item_id) ||
      (typeof (p as { commandExecutionId?: string }).commandExecutionId === "string" &&
        (p as { commandExecutionId: string }).commandExecutionId) ||
      (typeof (p as { command_execution_id?: string }).command_execution_id === "string" &&
        (p as { command_execution_id: string }).command_execution_id);
    if (cand) return cand;
    const item = p.item as ThreadItem | undefined;
    return item?.id && typeof item.id === "string" ? item.id : undefined;
  }

  function notificationOutputDeltaText(p: Record<string, unknown> | undefined): string | undefined {
    if (!p) return undefined;
    const raw = p.delta ?? p.content ?? p.text ?? p.output ?? p.stdout;
    if (typeof raw === "string" && raw.length) return raw;
    if (raw && typeof raw === "object" && "text" in raw && typeof (raw as { text: unknown }).text === "string") {
      const t = (raw as { text: string }).text;
      return t.length ? t : undefined;
    }
    return undefined;
  }

  /** Shell / file-read output: aggregatedOutput plus alternate Codex shapes */
  function extractThreadItemStreamedText(item: ThreadItem): string | undefined {
    const tryStr = (v: unknown): string | undefined =>
      typeof v === "string" && v.trim() ? v : undefined;

    const direct =
      tryStr(item.aggregatedOutput) ??
      tryStr(item.aggregated_output) ??
      tryStr(item.output) ??
      tryStr(item.stdout) ??
      tryStr(item.stderr);
    if (direct) return direct;

    const nestedKeys = ["result", "commandOutput", "command_output"] as const;
    for (const k of nestedKeys) {
      const v = item[k];
      if (typeof v === "string" && v.trim()) return v;
      if (v && typeof v === "object") {
        const o = v as Record<string, unknown>;
        const inner =
          tryStr(o.text) ??
          tryStr(o.content) ??
          tryStr(o.stdout) ??
          tryStr(o.output) ??
          tryStr(o.aggregatedOutput) ??
          tryStr(o.aggregated_output);
        if (inner) return inner;
      }
    }
    return undefined;
  }

  function appendCommandOutputBuffer(runId: string, itemId: string | undefined, delta: string | undefined): string | undefined {
    if (!delta || !itemId) return undefined;
    const runState = activeRuns.get(runId);
    if (!runState) return undefined;
    const cur = runState.commandOutputBuffers.get(itemId) ?? "";
    const next = cur + delta;
    runState.commandOutputBuffers.set(itemId, next);
    return next;
  }

  /**
   * Compact a command's stdout/stderr buffer into a single status line for the
   * AsciiLoader. Long outputs (think `npm install`) get reduced to the last
   * non-empty line so the user sees live progress without a wall of text.
   */
  function streamingStatusLine(buffer: string | undefined): string {
    if (!buffer) return "";
    const lines = buffer.split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (trimmed) return trimmed.length > 200 ? trimmed.slice(0, 200) + "…" : trimmed;
    }
    return "";
  }

  /**
   * Detect a `collabAgentToolCall` item completing on the parent thread, then
   * fetch each new sub-thread's nickname/role via `thread/read` and cache it
   * on runState. Runs before `mapNotification` so subsequent emissions have
   * names available. Fires for ALL collab variants (spawn/wait/close/
   * sendInput/resumeAgent) — wait/close events for sub-threads we never saw
   * a spawn for (e.g. resumed a thread from a past run) still need a name.
   * Best-effort — silent on failure (UI falls back to a short threadId).
   */
  async function maybeResolveCollabSubAgents(
    server: CodexAppServer,
    params: unknown,
    runId: string,
  ): Promise<void> {
    const p = params as Record<string, unknown> | undefined;
    const item = (p?.item ?? p) as Record<string, unknown> | undefined;
    const itemType = item?.type as string | undefined;
    if (itemType !== "collabAgentToolCall" && itemType !== "collab_agent_tool_call") return;

    const eventThreadId = (p?.threadId ?? p?.thread_id) as string | undefined;
    const runState = activeRuns.get(runId);
    // Only run for the parent thread's collab events
    if (!runState || (runState.threadId && eventThreadId && runState.threadId !== eventThreadId)) {
      return;
    }

    const receiverThreadIds =
      ((item?.receiverThreadIds ?? item?.receiver_thread_ids) as string[] | undefined) ?? [];
    const unknownIds = receiverThreadIds.filter((id) => !runState.subAgents.has(id));
    if (unknownIds.length === 0) return;

    await Promise.all(
      unknownIds.map(async (threadId) => {
        try {
          const res = (await server.sendRequest("thread/read", {
            threadId,
            includeTurns: false,
          })) as { thread?: { agentNickname?: string | null; agentRole?: string | null } } | undefined;
          const nickname = res?.thread?.agentNickname ?? undefined;
          const role = res?.thread?.agentRole ?? undefined;
          runState.subAgents.set(threadId, { threadId, nickname: nickname ?? undefined, role: role ?? undefined });
        } catch {
          // App-server doesn't know the thread yet, or read failed — keep
          // placeholder; the artifact will fall back to a short threadId.
          runState.subAgents.set(threadId, { threadId });
        }
      }),
    );
  }

  function mapNotification(method: string, params: unknown, runId: string, model?: string): WorkRunEvent[] {
    const ts = Date.now();
    const events: WorkRunEvent[] = [];
    const p = params as Record<string, unknown> | undefined;

    switch (method) {
      case "thread/started": {
        const thread = p?.thread as Record<string, unknown> | undefined;
        const threadId = (thread?.id ?? p?.threadId) as string | undefined;
        if (threadId) {
          const runState = activeRuns.get(runId);

          // Sub-agent thread (AgentControl-spawned). The parent thread for this
          // run was already captured on the first thread/started; subsequent
          // thread/started notifications correspond to spawned sub-threads and
          // carry agentNickname/agentRole metadata we need to render
          // "Spawned <Nickname> <Role>" lines.
          const isSubThread =
            runState?.threadId !== undefined &&
            runState.threadId !== null &&
            runState.threadId !== threadId;
          const nickname = thread?.agentNickname as string | undefined;
          const role = thread?.agentRole as string | undefined;
          if (runState && isSubThread && (nickname || role)) {
            runState.subAgents.set(threadId, { threadId, nickname, role });
          } else if (!isSubThread) {
            sessionIdMap.set(runId, threadId);
            if (runState) runState.threadId = threadId;
          }
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
        // Sub-thread (subagent) turn completions stream into the same handler;
        // they must not flush the parent's agentMessage buffer or count their
        // usage twice. Only the parent thread's turn/completed advances the run.
        const tcThreadId = (p?.threadId ?? p?.thread_id) as string | undefined;
        const tcParentRs = activeRuns.get(runId);
        if (
          tcThreadId &&
          tcParentRs?.threadId &&
          tcThreadId !== tcParentRs.threadId
        ) {
          break;
        }

        trackUsage(runId, p, model);

        // Flush any remaining agent message buffer
        const runState = activeRuns.get(runId);
        if (runState) {
          // Emit any pending flushed messages first
          events.push(...runState.pendingFlush);
          runState.pendingFlush = [];

          // Emit remaining buffer
          if (runState.agentMessageBuffer.trim()) {
            const messageText = runState.agentMessageBuffer.trim();
            events.push({
              type: "artifact",
              kind: "report",
              content: messageText,
              metadata: { source: "agent_message", itemId: runState.currentMessageItemId },
            });
            // The agent's closing summary is the most reliable reference to a
            // generated document (e.g. "Done: report.docx") — surface it as a
            // document artifact card even when the .png previews it produced
            // live elsewhere.
            emitDocumentArtifactsFromText(events, runId, messageText, Date.now());
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

      case "item/started":
      case "item/updated":
      case "item/completed": {
        const item = (p?.item ?? p) as ThreadItem | undefined;
        const eventThreadId = (p?.threadId ?? p?.thread_id) as string | undefined;
        const parentRs = activeRuns.get(runId);
        const isSubThreadItem =
          eventThreadId !== undefined &&
          parentRs?.threadId !== undefined &&
          parentRs.threadId !== null &&
          eventThreadId !== parentRs.threadId;

        // Sub-thread items pollute parent's streaming UI (agentMessage deltas
        // mix into parent's buffer, command output appears as parent's, etc.).
        // The parent thread shows sub-agent activity via `collabAgentToolCall`
        // items on its own thread, so safely skip everything else here.
        // `collabAgentToolCall` is only emitted on the parent thread.
        if (isSubThreadItem) {
          // Emit a heartbeat into the AsciiLoader so the user can see
          // background subagent activity even though the items themselves
          // are filtered out of the parent timeline.
          if (eventThreadId) {
            const meta = parentRs?.subAgents.get(eventThreadId);
            const label = meta?.nickname ?? eventThreadId.slice(-8);
            const role = meta?.role ? ` (${meta.role})` : "";
            events.push({
              type: "artifact",
              kind: "report",
              content: `Subagent ${label}${role} working…`,
              metadata: { source: "codex_subagent_heartbeat", subThreadId: eventThreadId },
              ephemeral: true,
              streamId: `codex-cmd-subagent-${runId}-${eventThreadId}`,
            });
          }
          break;
        }

        // Only flush the agent message buffer when a COMPETING agentMessage
        // item starts (different itemId, same type) — that's the only signal
        // that the previous message is done. Codex runs Plan / Reasoning /
        // CollabAgent items concurrently with AgentMessage and interleaves
        // their deltas (see codex-rs/core/tests/suite/items.rs:779-839), so
        // flushing on any non-own item splits the running paragraph into two
        // bubbles ("There's a prior" + "commit named …"). The agentMessage's
        // own `item/completed` and `turn/completed` paths handle the normal
        // end-of-message flush.
        const rsItem = parentRs;
        const incomingId = (item?.id ?? null) as string | null;
        const incomingType = item?.type as string | undefined;
        const isCompetingAgentMessage =
          rsItem?.currentMessageItemId !== null &&
          rsItem?.currentMessageItemId !== undefined &&
          incomingId !== rsItem.currentMessageItemId &&
          (incomingType === "agentMessage" || incomingType === "agent_message");

        if (rsItem && rsItem.agentMessageBuffer.trim() && isCompetingAgentMessage) {
          events.push({
            type: "artifact",
            kind: "report",
            content: rsItem.agentMessageBuffer.trim(),
            metadata: { source: "agent_message", itemId: rsItem.currentMessageItemId },
          });
          rsItem.agentMessageBuffer = "";
          rsItem.currentMessageItemId = null;
        }

        if (item?.type) {
          events.push(...mapThreadItem(item, method, ts, runId));
        }
        break;
      }

      // Streaming delta: accumulate agent message text per itemId
      case "item/agentMessage/delta": {
        // Skip sub-thread deltas — they would garble the parent's streaming buffer
        const deltaThreadId = (p?.threadId ?? p?.thread_id) as string | undefined;
        const parentForDelta = activeRuns.get(runId);
        if (
          deltaThreadId !== undefined &&
          parentForDelta?.threadId !== undefined &&
          parentForDelta.threadId !== null &&
          deltaThreadId !== parentForDelta.threadId
        ) {
          break;
        }

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

      // Accumulate file change diff output per itemId
      case "item/fileChange/output/delta":
      case "item/fileChange/outputDelta": {
        const fcThreadId = (p?.threadId ?? p?.thread_id) as string | undefined;
        const parentForFc = activeRuns.get(runId);
        if (
          fcThreadId !== undefined &&
          parentForFc?.threadId !== undefined &&
          parentForFc.threadId !== null &&
          fcThreadId !== parentForFc.threadId
        ) {
          break;
        }

        const delta = notificationOutputDeltaText(p) ?? ((p?.delta ?? p?.content) as string | undefined);
        const itemId = resolveStreamOutputItemId(p) ?? (p?.itemId as string | undefined);
        if (delta && itemId) {
          const runState = activeRuns.get(runId);
          if (runState) {
            const current = runState.fileChangeBuffers.get(itemId) ?? "";
            runState.fileChangeBuffers.set(itemId, current + delta);
          }
        }
        break;
      }

      // commandExecution stdout/stderr: README + protocol use `item/commandExecution/outputDelta` with plain `delta` string.
      // (`command/exec/outputDelta` is separate: base64 chunks keyed by processId, not thread item id — not handled here.)
      // Extra case labels are defensive aliases; ThreadItem reads in Codex are normally `type: commandExecution` (e.g. cat/rg).
      case "item/commandExecution/output/delta":
      case "item/commandExecution/outputDelta":
      case "item/command_execution/output/delta":
      case "item/command_execution/outputDelta":
      case "item/fileRead/output/delta":
      case "item/fileRead/outputDelta":
      case "item/file_read/output/delta":
      case "item/file_read/outputDelta":
      case "item/shell/output/delta":
      case "item/shell/outputDelta": {
        const cmdThreadId = (p?.threadId ?? p?.thread_id) as string | undefined;
        const parentForCmd = activeRuns.get(runId);
        if (
          cmdThreadId !== undefined &&
          parentForCmd?.threadId !== undefined &&
          parentForCmd.threadId !== null &&
          cmdThreadId !== parentForCmd.threadId
        ) {
          break;
        }

        const delta = notificationOutputDeltaText(p);
        const itemId = resolveStreamOutputItemId(p);
        const next = appendCommandOutputBuffer(runId, itemId, delta);

        // Push a live progress line into the AsciiLoader so long-running
        // commands (npm install, builds, etc.) don't make the run look frozen.
        // The renderer maps streamId prefix `codex-cmd-` to the thinking lane.
        if (next && itemId) {
          const status = streamingStatusLine(next);
          if (status) {
            events.push({
              type: "artifact",
              kind: "report",
              content: status,
              metadata: { source: "codex_cmd_streaming", itemId },
              ephemeral: true,
              streamId: `codex-cmd-${runId}-${itemId}`,
            });
          }
        }
        break;
      }

      // Streaming plan deltas: accumulate per itemId and emit ephemeral
      // streaming artifact so the user sees the plan being written in real time.
      // Final flush happens on item/completed for the plan item itself.
      case "item/plan/delta": {
        const delta = p?.delta as string | undefined;
        const itemId = p?.itemId as string | undefined;
        if (delta && itemId) {
          const runState = activeRuns.get(runId);
          if (runState) {
            const prev = runState.planBuffers.get(itemId) ?? "";
            const next = prev + delta;
            runState.planBuffers.set(itemId, next);
            events.push({
              type: "artifact",
              kind: "report",
              content: next,
              metadata: { source: "codex_plan_streaming", itemId },
              ephemeral: true,
              streamId: `codex-plan-${runId}-${itemId}`,
            });
          }
        }
        break;
      }

      // Other streaming deltas — ignore (reasoning summaries, command output, etc.)
      case "item/commandExecution/terminalInteraction":
      case "item/reasoning/delta":
      case "item/reasoning/summaryPartAdded":
      case "item/reasoning/summaryTextDelta":
      case "item/reasoning/textDelta":
      case "item/plan/updated":
      case "item/mcpToolCall/progress":
        break;

      case "error": {
        const msg = (p?.error as { message?: string })?.message ?? p?.message ?? "unknown";
        events.push({ type: "log", message: `Codex error: ${msg}`, level: "error", ts });
        break;
      }

      case "account/rateLimits/updated":
        // Pushed to the renderer from the background handler (window broadcast,
        // not a per-run WorkRunEvent) — nothing to emit into the run timeline.
        break;

      case "thread/tokenUsage/updated": {
        // Live context-window indicator. Codex reports the context currently
        // occupied as the last turn's total_tokens
        // (codex-rs/tui/src/token_usage.rs::tokens_in_context_window), and
        // `modelContextWindow` as the window size. Emit the same renderer-only
        // ephemeral `context_usage` event the Claude driver uses so the
        // ContextUsageRing lights up for Codex runs too.
        // Payload: ThreadTokenUsageUpdatedNotification
        //   { threadId, turnId, tokenUsage: { total, last, modelContextWindow } }
        const tuThreadId = (p?.threadId ?? p?.thread_id) as string | undefined;
        const parentForTu = activeRuns.get(runId);
        if (
          tuThreadId !== undefined &&
          parentForTu?.threadId != null &&
          tuThreadId !== parentForTu.threadId
        ) {
          // Sub-agent thread — don't clobber the parent's indicator.
          break;
        }
        // Tolerate both serializations: the app-server wrapper keys come over
        // camelCase, but the inner per-turn `TokenUsage` is the core type and
        // serializes snake_case (same object `trackUsage` reads as
        // `input_tokens`/`output_tokens`/`cached_input_tokens`). Accept either.
        const tokenUsage = (p?.tokenUsage ?? p?.token_usage) as
          | {
              last?: { totalTokens?: number; total_tokens?: number };
              modelContextWindow?: number | null;
              model_context_window?: number | null;
            }
          | undefined;
        const rawMax = tokenUsage?.modelContextWindow ?? tokenUsage?.model_context_window;
        const maxTokens = typeof rawMax === "number" ? rawMax : 0;
        const rawOccupied = tokenUsage?.last?.totalTokens ?? tokenUsage?.last?.total_tokens;
        const occupied = typeof rawOccupied === "number" ? rawOccupied : 0;
        if (maxTokens > 0 && occupied > 0) {
          const total = Math.min(occupied, maxTokens);
          events.push({
            type: "context_usage",
            totalTokens: total,
            maxTokens,
            percentage: (total / maxTokens) * 100,
            model: model ?? undefined,
            ts,
          });
        }
        break;
      }

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
          method.startsWith("hook/") ||
          method.startsWith("mcpServer/") ||
          method.startsWith("serverRequest/") ||
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

  // ─────────────────────────────────────────────────────────────
  // Codex command_execution → Read / Grep / Glob / Bash (UI tool rows)
  // ─────────────────────────────────────────────────────────────

  function unquoteOuterShellArg(s: string): string {
    const t = s.trim();
    if (t.length >= 2) {
      const a = t[0];
      const b = t[t.length - 1];
      if ((a === "'" && b === "'") || (a === '"' && b === '"')) return t.slice(1, -1);
    }
    return t;
  }

  /** Strip nested `zsh -lc '…'` / `bash -c "…"` wrappers Codex often uses. */
  function unwrapNestedShellCommand(raw: string): string {
    const marker = /\s-(?:lc|c)\s+/i;
    let s = raw.trim();
    for (let d = 0; d < 4; d++) {
      const idx = s.search(marker);
      if (idx === -1) break;
      const inner = s.slice(idx).replace(/^\s*-\w*c\s+/i, "").trim();
      const next = unquoteOuterShellArg(inner);
      if (!next || next === s) break;
      s = next;
    }
    return s.trim();
  }

  function tokenizeShell(cmd: string): string[] {
    const out: string[] = [];
    let cur = "";
    let quote: "'" | '"' | null = null;
    for (let i = 0; i < cmd.length; i++) {
      const ch = cmd[i];
      if (quote) {
        if (ch === "\\" && quote === '"') {
          cur += ch;
          if (i + 1 < cmd.length) cur += cmd[++i];
          continue;
        }
        if (ch === quote) {
          out.push(cur);
          cur = "";
          quote = null;
        } else {
          cur += ch;
        }
        continue;
      }
      if (ch === "'" || ch === '"') {
        if (cur.trim()) {
          out.push(cur.trim());
          cur = "";
        }
        quote = ch;
        continue;
      }
      if (/\s/.test(ch)) {
        if (cur.trim()) {
          out.push(cur.trim());
          cur = "";
        }
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function stripQuotesToken(t: string): string {
    return unquoteOuterShellArg(t);
  }

  function extractReadFilePath(inner: string): string | null {
    const matches = [...inner.matchAll(/'([^']*)'|"([^"]*)"/g)];
    for (let i = matches.length - 1; i >= 0; i--) {
      const p = (matches[i][1] || matches[i][2] || "").trim();
      if (!p) continue;
      if (/^\d+(?:,\d+)?p?$/.test(p)) continue;
      if (p.startsWith("$")) continue;
      if (
        p.includes("/") ||
        /\.[a-zA-Z0-9]{1,12}$/.test(p) ||
        /^[\w.-]+\.(tsx?|jsx?|jsonc?|md|css|html|vue|svelte)$/i.test(p)
      ) {
        return p;
      }
    }
    const tok = tokenizeShell(inner);
    const bin = stripQuotesToken(tok[0] || "")
      .toLowerCase()
      .replace(/^.*\//, "");
    if (!["cat", "sed", "head", "tail", "less", "more"].includes(bin)) return null;
    for (let j = tok.length - 1; j >= 1; j--) {
      const last = stripQuotesToken(tok[j]);
      if (last.startsWith("-")) continue;
      if (/^\d+$/.test(last)) continue;
      if (last.includes("/") || /\.[a-zA-Z]{2,10}$/i.test(last)) return last;
    }
    return null;
  }

  function extractRgPatternAndPath(inner: string): { pattern?: string; path?: string } {
    const tokens = tokenizeShell(inner);
    if (!tokens.length) return {};
    const bin = stripQuotesToken(tokens[0]).replace(/^.*\//, "");
    if (bin !== "rg" && bin !== "ripgrep") return {};
    let i = 1;
    let pattern: string | undefined;
    while (i < tokens.length) {
      const t = stripQuotesToken(tokens[i]);
      if (!t.startsWith("-")) break;
      if (t === "-e" || t === "--regexp") {
        i++;
        if (i < tokens.length) pattern = stripQuotesToken(tokens[i]);
        i++;
        continue;
      }
      if (t === "--glob" || t === "-g" || t === "-t" || t === "--type") {
        i += 2;
        continue;
      }
      i++;
    }
    if (i < tokens.length && !pattern) {
      pattern = stripQuotesToken(tokens[i]);
      i++;
    }
    let path: string | undefined;
    if (i < tokens.length) path = stripQuotesToken(tokens[i]);
    return { pattern, path };
  }

  function extractRgGlobPattern(inner: string): string {
    const tokens = tokenizeShell(inner);
    const bin = stripQuotesToken(tokens[0] || "").replace(/^.*\//, "");
    if (bin !== "rg" && bin !== "ripgrep") return "**/*";
    const pos: string[] = [];
    let i = 1;
    while (i < tokens.length) {
      const t = stripQuotesToken(tokens[i]);
      if (!t.startsWith("-")) {
        pos.push(t);
        i++;
        continue;
      }
      if (t === "--glob" || t === "-g" || t === "-t" || t === "--type" || t === "-e" || t === "--regexp") {
        i += 2;
        continue;
      }
      i++;
    }
    const roots = pos.filter((p) => p !== "rg" && p !== "ripgrep");
    return roots.length ? roots[roots.length - 1] : "**/*";
  }

  function extractGrepClassicPatternPath(inner: string): { pattern?: string; path?: string } {
    const tokens = tokenizeShell(inner);
    let i = 0;
    const bin = stripQuotesToken(tokens[0] || "").replace(/^.*\//, "");
    if (bin !== "grep") return {};
    i = 1;
    let pattern: string | undefined;
    while (i < tokens.length) {
      const t = stripQuotesToken(tokens[i]);
      if (!t.startsWith("-")) break;
      if (t === "-e") {
        i++;
        if (i < tokens.length) pattern = stripQuotesToken(tokens[i++]);
        continue;
      }
      if (t === "-f" || t === "--file") {
        i += 2;
        continue;
      }
      i++;
    }
    if (!pattern && i < tokens.length) pattern = stripQuotesToken(tokens[i++]);
    const path = i < tokens.length ? stripQuotesToken(tokens[i]) : undefined;
    return { pattern, path };
  }

  function extractFindNamePattern(inner: string): string {
    const m = inner.match(/-name\s+(['"])((?:\\.|(?!\1).)*)\1/);
    if (m) return m[2].replace(/\\\./g, ".");
    if (/\s-name\s+/i.test(inner)) return "*";
    return "**/*";
  }

  function classifyCodexShellCommand(rawCommand: string): { toolName: string; input: Record<string, unknown> } {
    const inner = unwrapNestedShellCommand(rawCommand);
    const lower = inner.toLowerCase();

    if (/^\s*(cat|sed|head|tail|less|more)\s/i.test(inner)) {
      const filePath = extractReadFilePath(inner);
      if (filePath) return { toolName: "Read", input: { file_path: filePath } };
    }

    if (/^\s*find\s/.test(lower)) {
      return { toolName: "Glob", input: { pattern: extractFindNamePattern(inner) } };
    }

    if (/\brg\b/.test(lower) || /\bripgrep\b/.test(lower)) {
      const filesOnly =
        /\s--files\b/.test(lower) &&
        !/\s--files-with-matches\b/.test(lower);
      if (filesOnly) {
        return { toolName: "Glob", input: { pattern: extractRgGlobPattern(inner) } };
      }
      const { pattern, path } = extractRgPatternAndPath(inner);
      if (pattern || path) {
        return {
          toolName: "Grep",
          input: {
            ...(pattern ? { pattern } : {}),
            ...(path ? { path } : {}),
          },
        };
      }
    }

    if (/\bgrep\b/.test(lower) && !/\brg\b/.test(lower)) {
      const { pattern, path } = extractGrepClassicPatternPath(inner);
      if (pattern) {
        return {
          toolName: "Grep",
          input: {
            pattern,
            ...(path ? { path } : {}),
          },
        };
      }
    }

    if (/^\s*git\s+grep\s/.test(lower)) {
      const tokens = tokenizeShell(inner);
      let i = 0;
      if (stripQuotesToken(tokens[0] || "").replace(/^.*\//, "") === "git") i = 1;
      if (stripQuotesToken(tokens[i] || "") === "grep") i++;
      while (i < tokens.length) {
        const t = stripQuotesToken(tokens[i]);
        if (!t.startsWith("-")) break;
        i++;
      }
      let pattern: string | undefined;
      if (i < tokens.length) pattern = stripQuotesToken(tokens[i++]);
      const gpath = i < tokens.length ? stripQuotesToken(tokens[i]) : undefined;
      if (pattern) {
        return {
          toolName: "Grep",
          input: {
            pattern,
            ...(gpath ? { path: gpath } : {}),
          },
        };
      }
    }

    return { toolName: "Bash", input: { command: rawCommand } };
  }

  /**
   * Reshape raw shell stdout into the JSON envelope each tool's renderer
   * expects. Codex maps ad-hoc shell commands to logical tools (Glob/Grep/…)
   * via classifyCodexShellCommand, but their stdout is just newline-separated
   * text — GlobDisplay/GrepDisplay need a structured object.
   *
   * Returns a stringified JSON envelope when normalization applies, otherwise
   * the raw stdout (or a fallback exit-code marker when stdout is empty).
   */
  function formatShellOutputForTool(
    toolName: string,
    stdout: string | undefined,
    exitCode: number | undefined,
  ): string {
    const raw = stdout?.trim() ?? "";

    if (toolName === "Glob") {
      const filenames = raw
        ? raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        : [];
      return JSON.stringify({ filenames, numFiles: filenames.length });
    }

    if (toolName === "Grep") {
      const lines = raw ? raw.split(/\r?\n/) : [];
      return JSON.stringify({
        content: raw || null,
        numLines: lines.length,
      });
    }

    return raw ? raw : `exit code: ${exitCode ?? "unknown"}`;
  }

  /**
   * Map Codex ThreadItem to WorkRunEvents.
   * Matches the app-server's item schema (same structure as SDK ThreadItem).
   */
  function mapThreadItem(item: ThreadItem, eventMethod: string, ts: number, runId: string): WorkRunEvent[] {
    const events: WorkRunEvent[] = [];
    const phase: ThreadItemPhase = eventMethod.endsWith("/started") ? "start" :
      eventMethod.endsWith("/completed") ? "complete" : "update";

    switch (item.type) {
      case "agent_message":
      case "agentMessage": {
        // Deltas accumulate into runState.agentMessageBuffer; flush here on
        // completion so the message is persisted as a single artifact instead
        // of waiting for turn/completed (which would let an unrelated next
        // item arrive first and split ordering).
        if (phase === "complete" && runId) {
          const rs = activeRuns.get(runId);
          if (rs && rs.currentMessageItemId === item.id && rs.agentMessageBuffer.trim()) {
            const messageText = rs.agentMessageBuffer.trim();
            events.push({
              type: "artifact",
              kind: "report",
              content: messageText,
              metadata: { source: "agent_message", itemId: rs.currentMessageItemId },
            });
            // The agent's closing summary is the most reliable reference to a
            // generated document (e.g. "Done: report.docx") — surface it as a
            // document artifact card.
            emitDocumentArtifactsFromText(events, runId, messageText, ts);
            rs.agentMessageBuffer = "";
            rs.currentMessageItemId = null;
          }
        }
        break;
      }
      case "userMessage":
        // Internal — no UI event needed.
        break;

      case "image_generation":
      case "imageGeneration": {
        events.push(...mapImageGenerationLifecycle(item, phase, runId, ts));
        break;
      }

      // Plan items appear in collaborationMode "plan" turns. Text streams via
      // item/plan/delta (handled above into runState.planBuffers); on completion
      // we emit a `Plan` tool_call (start + complete) so the PlanDisplay card
      // renders with Apply/Dismiss buttons — matching the cursor adapter's
      // create_plan flow. Streaming entry is cleared so the live preview
      // disappears once the final card takes over.
      case "plan": {
        if (phase === "complete" && runId) {
          const rs = activeRuns.get(runId);
          const buffered = rs?.planBuffers.get(item.id);
          const fromItem = typeof item.text === "string" ? item.text : "";
          const planText = (buffered?.trim() || fromItem.trim());
          if (rs) rs.planBuffers.delete(item.id);

          // Clear the streaming entry so the live preview disappears.
          events.push({
            type: "artifact",
            kind: "report",
            content: "",
            metadata: { source: "codex_plan_streaming", itemId: item.id },
            ephemeral: true,
            streamId: `codex-plan-${runId}-${item.id}`,
          });

          if (planText) {
            const planMeta = {
              toolCallId: `codex-plan-${item.id}`,
              itemId: item.id,
              codexItemType: "plan" as const,
            };
            events.push({
              type: "tool_call",
              toolName: "Plan",
              input: { plan: planText },
              startedAt: ts,
              metadata: { phase: "start", ...planMeta },
            });
            events.push({
              type: "tool_call",
              toolName: "Plan",
              input: { plan: planText },
              output: { planStatus: "pending" },
              startedAt: ts,
              endedAt: ts,
              metadata: { phase: "complete", ...planMeta },
            });
          }
        }
        break;
      }

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
        const exitCode = (item.exitCode ?? item.exit_code) as number | undefined;
        const status = item.status as string | undefined;

        // item/updated may carry aggregatedOutput before/without a rich item/completed payload
        if (phase === "update" && runId) {
          const snap = extractThreadItemStreamedText(item);
          if (snap?.trim()) {
            const rs = activeRuns.get(runId);
            if (rs) rs.commandOutputBuffers.set(item.id, snap);
          }
          break;
        }

        const { toolName, input } = classifyCodexShellCommand(command);
        const cmdMeta = {
          toolCallId: item.id,
          itemId: item.id,
          codexItemType: "command_execution" as const,
          shellCommand: command,
        };

        if (phase === "start") {
          events.push({
            type: "tool_call",
            toolName,
            input,
            startedAt: ts,
            metadata: { phase: "start", ...cmdMeta },
          });
        } else if (phase === "complete") {
          const fromItem = extractThreadItemStreamedText(item);
          const runStateCmd = runId ? activeRuns.get(runId) : undefined;
          const buffered = runStateCmd?.commandOutputBuffers.get(item.id);
          if (runStateCmd && buffered !== undefined) runStateCmd.commandOutputBuffers.delete(item.id);

          const trimmedItem = fromItem?.trim() ?? "";
          const trimmedBuf = buffered?.trim() ?? "";
          let mergedOut: string | undefined;
          if (trimmedItem && trimmedBuf) {
            mergedOut = trimmedItem.length >= trimmedBuf.length ? trimmedItem : trimmedBuf;
          } else {
            mergedOut = trimmedItem || trimmedBuf || undefined;
          }

          const cmdFailed = status === "failed";
          // Normalize output to the shape the renderer's tool display expects.
          // Glob → { filenames, numFiles }, Grep → { content, numLines } so
          // GlobDisplay/GrepDisplay render rich previews instead of empty
          // dropdowns. Other tools (Bash/Read) keep the raw stdout string.
          const normalizedOutput = formatShellOutputForTool(toolName, mergedOut, exitCode);
          events.push({
            type: "tool_call",
            toolName,
            input,
            output: normalizedOutput,
            error: cmdFailed ? `Command failed with exit code ${exitCode}` : undefined,
            endedAt: ts,
            metadata: { phase: "complete", ...cmdMeta, exitCode },
          });

          // Clear the live status line — empty content removes the stream
          // entry from AsciiLoader once the command has actually finished.
          events.push({
            type: "artifact",
            kind: "report",
            content: "",
            metadata: { source: "codex_cmd_streaming", itemId: item.id },
            ephemeral: true,
            streamId: `codex-cmd-${runId}-${item.id}`,
          });
        }
        break;
      }

      case "file_read":
      case "fileRead": {
        const filePath =
          (typeof item.path === "string" && item.path) ||
          (typeof item.filePath === "string" && item.filePath) ||
          (typeof item.file_path === "string" && item.file_path) ||
          "";
        const readStatus = item.status as string | undefined;

        if (phase === "update" && runId) {
          const snap =
            extractThreadItemStreamedText(item) ??
            (typeof item.content === "string" && item.content.trim() ? item.content : undefined);
          if (snap?.trim()) {
            const rs = activeRuns.get(runId);
            if (rs) rs.commandOutputBuffers.set(item.id, snap);
          }
          break;
        }

        const readMeta = {
          toolCallId: item.id,
          itemId: item.id,
          codexItemType: "file_read" as const,
        };

        if (phase === "start") {
          events.push({
            type: "tool_call",
            toolName: "Read",
            input: { file_path: filePath },
            startedAt: ts,
            metadata: { phase: "start", ...readMeta },
          });
        } else if (phase === "complete") {
          const fromItem =
            extractThreadItemStreamedText(item) ??
            (typeof item.content === "string" && item.content.trim() ? item.content : undefined);
          const runStateRead = runId ? activeRuns.get(runId) : undefined;
          const buffered = runStateRead?.commandOutputBuffers.get(item.id);
          if (runStateRead && buffered !== undefined) runStateRead.commandOutputBuffers.delete(item.id);

          const trimmedItem = fromItem?.trim() ?? "";
          const trimmedBuf = buffered?.trim() ?? "";
          let mergedOut: string | undefined;
          if (trimmedItem && trimmedBuf) {
            mergedOut = trimmedItem.length >= trimmedBuf.length ? trimmedItem : trimmedBuf;
          } else {
            mergedOut = trimmedItem || trimmedBuf || undefined;
          }

          const readFailed = readStatus === "failed";
          events.push({
            type: "tool_call",
            toolName: "Read",
            input: { file_path: filePath },
            output: mergedOut?.trim() ? mergedOut : undefined,
            error: readFailed ? "File read failed" : undefined,
            endedAt: ts,
            metadata: { phase: "complete", ...readMeta },
          });

          // Clear the live progress stream for this file read.
          events.push({
            type: "artifact",
            kind: "report",
            content: "",
            metadata: { source: "codex_cmd_streaming", itemId: item.id },
            ephemeral: true,
            streamId: `codex-cmd-${runId}-${item.id}`,
          });
        }
        break;
      }

      case "file_change":
      case "fileChange": {
        const changes = item.changes as Array<{ path: string; kind: string; patch?: string; unifiedDiff?: string; diff?: string }> | undefined;
        const patchStatus = item.status as string | undefined;
        // Item-level patch (some versions of Codex put it here)
        const itemPatch = (item.patch ?? item.unifiedDiff ?? item.diff) as string | undefined;

        // Cache change details on start/update so item/fileChange/requestApproval
        // (which only carries itemId/reason) can render a rich approval dialog.
        if ((phase === "start" || phase === "update") && changes && changes.length > 0 && runId) {
          const rs = activeRuns.get(runId);
          if (rs) {
            rs.fileChangeItems.set(item.id, changes.map((c) => ({
              path: c.path,
              kind: c.kind,
              diff: c.patch ?? c.unifiedDiff ?? c.diff,
            })));
          }
        }

        if (phase === "complete" && changes && changes.length > 0) {
          // Retrieve accumulated diff from delta events, then clean up
          const runState = runId ? activeRuns.get(runId) : undefined;
          const bufferedDiff = runState?.fileChangeBuffers.get(item.id);
          if (runState) {
            runState.fileChangeBuffers.delete(item.id);
            runState.fileChangeItems.delete(item.id);
          }

          for (const change of changes) {
            const toolName = change.kind === "delete" ? "Delete" : (change.kind === "add" || change.kind === "create") ? "Write" : "Edit";
            // Prefer per-change patch → accumulated delta buffer → item-level patch
            const diffContent = change.patch ?? change.unifiedDiff ?? change.diff
              ?? (changes.length === 1 ? (bufferedDiff ?? itemPatch) : bufferedDiff);

            const fcId = `${item.id}-${change.path}`;
            events.push({
              type: "tool_call",
              toolName,
              input: { path: change.path },
              startedAt: ts,
              metadata: { phase: "start", toolCallId: fcId, itemId: fcId, changeType: change.kind, codexItemType: "file_change" },
            });
            const patchErr = patchStatus === "failed";
            events.push({
              type: "tool_call",
              toolName,
              input: { path: change.path },
              output: diffContent ? { detailedContent: diffContent } : `File ${change.kind}: ${change.path}`,
              error: patchErr ? "Patch failed" : undefined,
              endedAt: ts,
              metadata: { phase: "complete", toolCallId: fcId, itemId: fcId, changeType: change.kind, codexItemType: "file_change" },
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
            metadata: { phase: "start", toolCallId: item.id, itemId: item.id, codexItemType: "mcp_tool_call" },
          });
        } else if (phase === "complete") {
          events.push({
            type: "tool_call",
            toolName,
            input: args,
            output: result,
            error,
            endedAt: ts,
            metadata: { phase: "complete", toolCallId: item.id, itemId: item.id, codexItemType: "mcp_tool_call" },
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
            metadata: { phase: "start", toolCallId: item.id, itemId: item.id, codexItemType: "web_search" },
          });
          events.push({
            type: "tool_call",
            toolName: "WebSearch",
            input: { query },
            output: `Searched: ${query}`,
            endedAt: ts,
            metadata: { phase: "complete", toolCallId: item.id, itemId: item.id, codexItemType: "web_search" },
          });
        }
        break;
      }

      case "dynamic_tool_call":
      case "dynamicToolCall": {
        const tool = typeof item.tool === "string" ? item.tool : "unknown";
        const args = (typeof item.arguments === "string" ? safeJson(item.arguments) : item.arguments) as Record<string, unknown> | undefined;
        const result = item.result as unknown;
        const status = item.status as string | undefined;

        if (phase === "start") {
          events.push({
            type: "tool_call",
            toolName: tool,
            input: args,
            startedAt: ts,
            metadata: { phase: "start", toolCallId: item.id, itemId: item.id, codexItemType: "dynamic_tool_call" },
          });
        } else if (phase === "complete") {
          const dynFailed = status === "failed";
          events.push({
            type: "tool_call",
            toolName: tool,
            input: args,
            output: result,
            error: dynFailed ? `Dynamic tool call failed` : undefined,
            endedAt: ts,
            metadata: { phase: "complete", toolCallId: item.id, itemId: item.id, codexItemType: "dynamic_tool_call" },
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

      case "enteredReviewMode": {
        if (phase === "start") {
          const label = typeof item.label === "string" ? item.label : "started";
          events.push({ type: "log", message: `Review: ${label}`, level: "info", ts, metadata: { itemId: item.id, codexItemType: "enteredReviewMode" } });
        }
        break;
      }

      case "exitedReviewMode": {
        const reviewText = typeof item.review === "string" ? item.review : typeof item.text === "string" ? item.text : null;
        if (reviewText && phase === "complete") {
          events.push({
            type: "artifact",
            kind: "report",
            content: reviewText,
            metadata: { source: "codex_review_mode", itemId: item.id },
          });

          // Persist findings to DB (fire-and-forget, deduplicated by item ID)
          if (runId && !savedReviewItems.has(item.id)) {
            savedReviewItems.add(item.id);
            const parsedFindings = parseCodexReviewFindings(reviewText);
            if (parsedFindings.length > 0) {
              (async () => {
                try {
                  const run = await runsRepo.findRunById(runId);
                  if (!run?.workspaceId) return;

                  // Extract summary: full review text (intro + findings are separate DB records)
                  const summary = reviewText;

                  // Create review record
                  const reviewId = await workspaceRepo.insertReview({
                    workspaceId: run.workspaceId,
                    title: "Code Review",
                    summary,
                    runId,
                  });

                  // Create findings
                  const findingPayloads = parsedFindings.map((f) => ({
                    reviewId,
                    severity: f.severity as any,
                    file: f.file,
                    lineStart: f.lineStart,
                    lineEnd: f.lineEnd,
                    message: f.message,
                    reason: f.reason,
                  }));
                  await workspaceRepo.insertManyFindings(findingPayloads);

                  // Log activity
                  logWorkspaceActivity({
                    workspaceId: run.workspaceId,
                    type: "review",
                    title: "Code Review",
                    summary,
                    refId: reviewId,
                  });
                  logWorkspaceActivity({
                    workspaceId: run.workspaceId,
                    type: "finding",
                    title: `${parsedFindings.length} finding(s) saved`,
                    refId: reviewId,
                    metadata: {
                      count: parsedFindings.length,
                      critical: parsedFindings.filter((f) => f.severity === "critical").length,
                      warning: parsedFindings.filter((f) => f.severity === "warning").length,
                      info: parsedFindings.filter((f) => f.severity === "info").length,
                    },
                  });

                  logInfo(`Saved review ${reviewId} with ${parsedFindings.length} finding(s) for run ${runId}`);
                } catch (err) {
                  logError("Failed to persist review findings:", err);
                }
              })();
            }
          }
        }
        break;
      }

      case "collab_agent_tool_call":
      case "collabAgentToolCall": {
        // Codex AgentControl emits collab tool calls in 5 variants:
        //   spawnAgent  → start a new sub-agent thread
        //   sendInput   → push user input into a running sub-agent
        //   wait        → block until sub-agent(s) complete a turn
        //   closeAgent  → terminate sub-agent thread(s)
        //   resumeAgent → reactivate a closed sub-agent
        // Each carries the same shape (sender, receiver_thread_ids, prompt,
        // agents_states). We surface every variant so the timeline mirrors
        // the parent's actual state transitions ("Spawned X", "Finished
        // waiting for X", "Closed X" — matching Codex VS Code / Conductor).
        const tool = (item.tool as string | undefined) ?? "spawnAgent";

        const status = item.status as string | undefined;
        const senderThreadId = (item.senderThreadId ?? item.sender_thread_id) as string | undefined;
        const receiverThreadIds = ((item.receiverThreadIds ?? item.receiver_thread_ids) as string[] | undefined) ?? [];
        const prompt = item.prompt as string | undefined;
        const collabModel = item.model as string | undefined;
        const agentsStates = (item.agentsStates ?? item.agents_states) as
          | Record<string, { status?: string; message?: string | null } | undefined>
          | undefined;

        // Resolve sub-agent metadata captured up-front by maybeResolveCollabSubAgents
        const runStateCollab = runId ? activeRuns.get(runId) : undefined;
        const subAgents = receiverThreadIds.map((id) => {
          const meta = runStateCollab?.subAgents.get(id);
          return {
            threadId: id,
            nickname: meta?.nickname,
            role: meta?.role,
            status: agentsStates?.[id]?.status,
          };
        });

        // Map codex's tool name to a stable lowercased variant the renderer
        // dispatches on (group-events.ts treats these as standalone groups
        // and tool-call-item.tsx routes them to CollabAgentDisplay).
        const toolNameByVariant: Record<string, string> = {
          spawnAgent: "spawnAgent",
          sendInput: "sendCollabInput",
          wait: "waitCollabAgent",
          closeAgent: "closeCollabAgent",
          resumeAgent: "resumeCollabAgent",
        };
        const toolName = toolNameByVariant[tool] ?? tool;

        const collabMeta = {
          toolCallId: item.id,
          itemId: item.id,
          codexItemType: "collab_agent_tool_call" as const,
          collabTool: tool,
          senderThreadId,
        };

        // Skip the in-flight `start` for non-spawn variants — they're noisy
        // (lots of repeat updates while the parent waits), and only the
        // completed state carries a useful sub-agent snapshot. SpawnAgent
        // keeps the start so users see "Spawning agent…" right away.
        if (phase === "start" && tool === "spawnAgent") {
          events.push({
            type: "tool_call",
            toolName,
            input: { prompt, model: collabModel, receiverThreadIds },
            startedAt: ts,
            metadata: { phase: "start", ...collabMeta },
          });
        } else if (phase === "complete") {
          const errorByVariant: Record<string, string> = {
            spawnAgent: "Spawn agent failed",
            sendInput: "Send input failed",
            wait: "Wait failed",
            closeAgent: "Close agent failed",
            resumeAgent: "Resume agent failed",
          };
          events.push({
            type: "tool_call",
            toolName,
            input: { prompt, model: collabModel, receiverThreadIds },
            output: { subAgents, prompt, model: collabModel, collabTool: tool },
            error: status === "failed" ? (errorByVariant[tool] ?? "Collab tool failed") : undefined,
            endedAt: ts,
            metadata: { phase: "complete", ...collabMeta },
          });
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

    if (phase === "complete") {
      emitImageArtifacts(events, runId, item, ts);
    }
    // Document scan runs on every phase (start/update/complete): a command like
    // `qlmanage … report.docx` references a doc that already exists at start,
    // and the existence + dedup guards make repeat scans harmless.
    emitDocumentArtifacts(events, runId, item, ts);

    return events;
  }

  // ─────────────────────────────────────────────────────────────
  // Input building
  // ─────────────────────────────────────────────────────────────

  type TurnInput = Array<
    | { type: "text"; text: string; text_elements: [] }
    | { type: "localImage"; path: string }
    | { type: "skill"; name: string; path: string }
  >;

  function buildTurnInput(request: WorkRunRequest): TurnInput {
    let prompt: string;

    if (request.context && request.context.length > 0) {
      const contextParts = formatContextSection(request.context);
      prompt = `Context:\n${contextParts}\n\n---\n\n ${request.goal}`;
    } else {
      prompt = request.goal;
    }

    prompt = appendPromptSections(prompt, {
      contextIssues: request.contextIssues,
      contextSignals: request.contextSignals,
      contextFiles: request.contextFiles,
      runId: request.runId,
    });

    const input: TurnInput = [{ type: "text", text: prompt, text_elements: [] }];

    if (request.skills) {
      for (const s of request.skills) {
        if (s.name && s.path) {
          input.push({ type: "skill", name: s.name, path: s.path });
        }
      }
    }

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

    if (request.skills) {
      for (const s of request.skills) {
        if (s.name && s.path) {
          input.push({ type: "skill", name: s.name, path: s.path });
        }
      }
    }

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
    timeout: number,
  ): Promise<{ status: "succeeded" | "failed" | "canceled"; error?: string }> {
    return new Promise((resolve) => {
      let resolved = false;

      // Detach codex callbacks so notifications/requests for an already-
      // finished turn don't fall back into stale closures (which would still
      // reference this run's onEvent and could pop up dialogs/toolcalls long
      // after the user thinks the run is done).
      const detachHandlers = () => {
        try {
          server.setNotificationHandler(noopNotificationHandler);
          server.setServerRequestHandler(noopServerRequestHandler);
        } catch {
          // ignore — server may already be torn down
        }
      };

      const finalize = (result: { status: "succeeded" | "failed" | "canceled"; error?: string }) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutTimer);
        detachHandlers();
        resolve(result);
      };

      const timeoutTimer = setTimeout(() => {
        finalize({ status: "failed", error: `Codex run timed out after ${timeout}ms` });
      }, timeout);

      const handleNotification = async (method: string, params: unknown) => {
        const runState = activeRuns.get(runId);
        if (runState?.aborted) {
          finalize({ status: "canceled" });
          return;
        }

        // Emit any pending flushed messages (from itemId changes in agentMessage/delta).
        // Artifact collection happens at the Core layer (wrapped onEvent) — we just emit.
        const currentRunState = activeRuns.get(runId);
        if (currentRunState && currentRunState.pendingFlush.length > 0) {
          const flushed = currentRunState.pendingFlush.splice(0);
          for (const evt of flushed) {
            await onEvent(evt);
          }
        }

        // Resolve nicknames for collab spawn ends BEFORE mapNotification emits.
        // App-server's `collabAgentToolCall` item carries thread IDs only; the
        // sub-thread's `agentNickname`/`agentRole` live on the Thread object,
        // so we fetch via `thread/read` to populate runState.subAgents up-front.
        if (method === "item/completed") {
          await maybeResolveCollabSubAgents(server, params, runId);
        }

        const mappedEvents = mapNotification(method, params, runId, model);
        for (const mapped of mappedEvents) {
          await onEvent(mapped);

          // Tool-completion outputs may carry file/patch artifacts — extract and re-emit.
          // Core's wrapped onEvent collects them.
          if (mapped.type === "tool_call" && mapped.output && mapped.metadata?.phase === "complete") {
            const extracted = extractArtifactsFromToolOutput(mapped.toolName, mapped.output);
            for (const art of extracted) {
              await onEvent(art);
            }
          }
        }

        // Check for turn completion. TurnStatus = completed | interrupted | failed | inProgress
        // (v2.rs::TurnStatus). interrupted == user called turn/interrupt, must surface as canceled.
        if (method === "turn/completed") {
          const p = params as Record<string, unknown> | undefined;
          // Subagent turns stream their own turn/completed into the same handler.
          // Finalizing on those would mark the run "succeeded" while the parent
          // thread is still running (the user-visible "çat diye bitti" bug),
          // so wait for the parent thread's own turn/completed.
          const tcThreadId = (p?.threadId ?? p?.thread_id) as string | undefined;
          const tcParentRs = activeRuns.get(runId);
          if (
            tcThreadId &&
            tcParentRs?.threadId &&
            tcThreadId !== tcParentRs.threadId
          ) {
            return;
          }

          const turn = p?.turn as Record<string, unknown> | undefined;
          const status = (turn?.status ?? p?.status) as string | undefined;

          const resolvedStatus: "succeeded" | "failed" | "canceled" =
            status === "failed" ? "failed"
            : status === "interrupted" ? "canceled"
            : "succeeded";
          finalize({
            status: resolvedStatus,
            error: resolvedStatus === "failed"
              ? ((turn?.error as { message?: string })?.message ?? "Turn failed")
              : undefined,
          });
        } else if (method === "error") {
          const p = params as Record<string, unknown> | undefined;
          const willRetry = (p as any)?.willRetry as boolean | undefined;
          if (!willRetry) {
            const msg = (p?.error as { message?: string })?.message ?? (p?.message as string) ?? "Error";
            finalize({ status: "failed", error: msg });
          }
        }
      };

      // Handle server requests — approval, user input, auth tokens
      const handleServerRequest = async (id: number | string, method: string, params: unknown) => {
        // If the run was aborted or already resolved, codex shouldn't be
        // popping approval dialogs. Auto-decline anything that would surface
        // UI so a stale background turn can't grab the user's attention.
        const reqRunState = activeRuns.get(runId);
        const runIsDead = resolved || reqRunState?.aborted === true;
        if (runIsDead) {
          if (
            method === "item/commandExecution/requestApproval" ||
            method === "item/fileChange/requestApproval" ||
            method === "item/permissions/requestApproval"
          ) {
            server.respondToRequest(id, { decision: "decline" });
            return;
          }
          if (method === "item/tool/requestUserInput") {
            // Empty answers map matches the timeout/fallback shape codex expects.
            server.respondToRequest(id, { answers: {} });
            return;
          }
          if (method === "mcpServer/elicitation/request") {
            server.respondToRequest(id, { action: "cancel" });
            return;
          }
          // Pass through auth/tool-call requests; refusing them mid-flight can
          // wedge codex's internal state worse than letting them complete.
        }

        const p = params as Record<string, unknown> | undefined;
        switch (method) {
          // Command exec approval. Payload carries command, cwd, optional
          // commandActions/reason. Dispatch to the renderer's Bash preview.
          // Response shape: { decision: "accept" | "acceptForSession" | "decline" | "cancel" }.
          case "item/commandExecution/requestApproval": {
            const command = (p?.command as string) ?? "";
            const cwd = (p?.cwd as string) ?? undefined;
            const reason = (p?.reason as string) ?? undefined;

            // Dependency guard check — intercept install commands before approval
            const guardResult = await guardsService.checkCommand(command);
            if (guardResult.blocked) {
              server.respondToRequest(id, { decision: "decline" });
              break;
            }

            try {
              const result = await requestToolApproval({
                requestId: String(id),
                runId,
                toolName: "Bash",
                toolInput: {
                  command,
                  ...(cwd ? { cwd } : {}),
                  ...(reason ? { description: reason } : {}),
                },
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
            break;
          }

          // File change approval. Payload only carries itemId/reason — look
          // up the previously-cached fileChange item details to render
          // path/kind in the approval dialog. When multiple files share the
          // same patch, we surface them under a generic "FileChange" tool so
          // the dialog falls back to the key/value table renderer.
          case "item/fileChange/requestApproval": {
            const itemId = (p?.itemId as string) ?? (p?.item_id as string) ?? "";
            const reason = (p?.reason as string) ?? undefined;
            const cached = itemId ? activeRuns.get(runId)?.fileChangeItems.get(itemId) : undefined;

            const single = cached && cached.length === 1 ? cached[0] : undefined;
            const toolName = single
              ? (single.kind === "delete" ? "Delete"
                : (single.kind === "add" || single.kind === "create") ? "Write"
                : "Edit")
              : "FileChange";

            const kindLabel = (k: string): string =>
              k === "delete" ? "Delete"
              : k === "add" || k === "create" ? "Add"
              : "Edit";

            const toolInput: Record<string, unknown> = single
              ? {
                  file_path: single.path,
                  ...(single.diff ? { diff: single.diff } : {}),
                  ...(reason ? { description: reason } : {}),
                }
              : {
                  _meta: {
                    tool_params_display: (cached ?? []).map((c) => ({
                      display_name: kindLabel(c.kind),
                      value: c.path,
                    })),
                    ...(reason ? { subtitle: reason } : {}),
                  },
                };

            try {
              const result = await requestToolApproval({
                requestId: String(id),
                runId,
                toolName,
                toolInput,
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
            break;
          }

          // Permissions request — model is asking for elevated network/fs permissions.
          // Response shape: { permissions: GrantedPermissionProfile, scope: "turn" | "session" }
          // (NOT a decision). See v2.rs::PermissionsRequestApprovalResponse.
          case "item/permissions/requestApproval": {
            const requestedPermissions = (p?.permissions ?? {}) as Record<string, unknown>;
            const reason = (p?.reason as string) ?? "elevated permissions";

            try {
              const result = await requestToolApproval({
                requestId: String(id),
                runId,
                toolName: "Permission",
                toolInput: { command: reason, permissions: requestedPermissions },
                kind: "tool_approval",
                timestamp: Date.now(),
              });
              if (result.approved) {
                // Echo back the requested permissions to grant them; pick scope
                // based on whether the user opted into session-wide grant.
                server.respondToRequest(id, {
                  permissions: requestedPermissions,
                  scope: result.answer === "acceptForSession" ? "session" : "turn",
                });
              } else {
                // Empty permissions = decline (grant nothing)
                server.respondToRequest(id, { permissions: {}, scope: "turn" });
              }
            } catch {
              server.respondToRequest(id, { permissions: {}, scope: "turn" });
            }
            break;
          }

          // User input requests — Codex's structured Q&A (one or more questions
          // with options + multiSelect). The approval dialog only renders ONE
          // question at a time, so we dispatch each question sequentially with
          // its own dialog, collect all answers, then send a single batched
          // response back to codex. If the user dismisses any question, the
          // remaining questions are auto-answered with empty arrays.
          case "item/tool/requestUserInput": {
            const questions = p?.questions as Array<Record<string, unknown>> | undefined;
            if (!questions || questions.length === 0) {
              server.respondToRequest(id, { answers: {} });
              break;
            }

            const normalizeOptions = (q: Record<string, unknown>) => {
              const raw = q.options as Array<Record<string, unknown>> | undefined;
              if (!raw || raw.length === 0) return undefined;
              return raw.map((o) => ({
                label: (o.label as string) ?? (o.description as string) ?? "",
                description: (o.description as string | undefined) ?? undefined,
              })).filter((o) => o.label);
            };

            const answers: Record<string, { answers: string[] }> = {};
            let aborted = false;

            for (let i = 0; i < questions.length; i++) {
              const q = questions[i];
              const qId = (q.id as string) ?? (q.questionId as string);
              if (!qId) continue;

              if (aborted) {
                answers[qId] = { answers: [] };
                continue;
              }

              const text = (q.text as string) ?? (q.description as string) ?? "";
              const opts = normalizeOptions(q);
              try {
                const result = await requestToolApproval({
                  // Synthetic per-question requestId so each dialog has a
                  // unique broker key while still sharing the codex JSON-RPC id.
                  requestId: questions.length === 1 ? String(id) : `${id}-q${i}`,
                  runId,
                  toolName: "UserInput",
                  kind: "ask_user",
                  question: text,
                  options: opts,
                  multiSelect: !!q.multiSelect,
                  timestamp: Date.now(),
                });
                if (!result.approved) {
                  answers[qId] = { answers: [] };
                  aborted = true;
                  continue;
                }
                const parts = result.answer
                  ? result.answer.split(",").map((s) => s.trim()).filter(Boolean)
                  : [];
                const fallback = opts?.[0]?.label ?? "yes";
                answers[qId] = { answers: parts.length > 0 ? parts : [fallback] };
              } catch {
                answers[qId] = { answers: [] };
                aborted = true;
              }
            }

            server.respondToRequest(id, { answers });
            break;
          }

          // Auth token refresh — the server asks the client to supply fresh tokens.
          // ChatgptAuthTokensRefreshResponse requires { accessToken, chatgptAccountId },
          // which we don't manage from the renderer. Returning an empty {} would
          // fail serde deserialization on the codex side. Reject with -32601 so
          // codex falls back to its own auth.json refresh flow.
          case "account/chatgptAuthTokens/refresh": {
            logInfo("Auth token refresh requested by app-server; deferring to codex auth.json");
            server.respondToRequestError(
              id,
              -32601,
              "Client does not manage ChatGPT tokens; use auth.json fallback",
            );
            break;
          }

          // Dynamic tool calls — dispatch mains tools
          case "item/tool/call": {
            const toolParams = params as Record<string, unknown> | undefined;
            const toolName = toolParams?.tool as string | undefined;
            const toolArgs = (typeof toolParams?.arguments === "string"
              ? safeJson(toolParams.arguments)
              : toolParams?.arguments ?? {}) as Record<string, unknown>;
            const toolThreadId = toolParams?.threadId as string | undefined;

            if (toolName && MAINS_TOOL_NAMES.has(toolName)) {
              // Find the MainsToolContext from the active run that owns this thread
              let ctx: MainsToolContext = { workspaceId: null, rootPath: null, runId: null };
              for (const [, run] of activeRuns) {
                if (run.threadId === toolThreadId) {
                  ctx = run.mainsCtx;
                  break;
                }
              }

              try {
                const result = await dispatchMainsTool(toolName, toolArgs, ctx);
                const contentItems = result.content.map((c) => ({
                  type: "inputText" as const,
                  text: c.text,
                }));
                server.respondToRequest(id, {
                  contentItems,
                  success: !result.isError,
                });
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logError(`Mains tool ${toolName} failed:`, msg);
                server.respondToRequest(id, {
                  contentItems: [{ type: "inputText", text: `Error: ${msg}` }],
                  success: false,
                });
              }
            } else {
              server.respondToRequestError(id, -32601, `Unknown dynamic tool: ${toolName ?? "undefined"}`);
            }
            break;
          }

          // App / connector action approvals (Google Calendar create event,
          // Gmail send, Notion edit, …). Codex routes app-tool approvals
          // through MCP elicitation. Two modes:
          //   - "form": user accepts/declines a structured action
          //   - "url":  user must complete an action in the browser
          // Response vocabulary: { action: "accept" | "decline" | "cancel" }.
          // See codex-rs/app-server-protocol → McpServerElicitationRequest.
          case "mcpServer/elicitation/request": {
            const serverName = (p?.serverName as string) ?? "App";
            const mode = (p?.mode as string) ?? "form";
            const url = p?.url as string | undefined;
            const sessionKey = serverName.toLowerCase();

            // "Allow for this run" for a form-mode app approval: skip the dialog
            // if the user already opted this server in for the run. url-mode
            // needs a browser round-trip each time, so it's never auto-accepted.
            if (
              mode !== "url" &&
              activeRuns.get(runId)?.approvedElicitationServers?.has(sessionKey)
            ) {
              server.respondToRequest(id, { action: "accept", content: {} });
              break;
            }

            // Dump the full payload — proposed action args may live in `_meta`
            // or a sibling field whose shape is still being mapped.
            logInfo(`[mcpServer/elicitation/request] ${JSON.stringify(p, null, 2)}`);

            try {
              const result = await requestToolApproval({
                requestId: String(id),
                runId,
                toolName: serverName,
                // Forward the entire elicitation params so the dialog can
                // render whatever the app-server actually sends (proposed
                // args in _meta, schema properties, …).
                toolInput: { ...(p ?? {}) },
                kind: "tool_approval",
                timestamp: Date.now(),
              });

              if (!result.approved) {
                server.respondToRequest(id, { action: "decline" });
              } else {
                if (mode === "url" && url) {
                  shell.openExternal(url).catch((err) =>
                    logWarn(`Failed to open elicitation URL: ${err}`),
                  );
                }
                // Remember the opt-in so subsequent form-mode elicitations from
                // this server skip the prompt for the rest of the run.
                if (mode !== "url" && result.answer === "acceptForSession") {
                  const rs = activeRuns.get(runId);
                  if (rs) {
                    (rs.approvedElicitationServers ??= new Set()).add(sessionKey);
                  }
                }
                server.respondToRequest(id, { action: "accept", content: {} });
              }
            } catch {
              server.respondToRequest(id, { action: "decline" });
            }
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
    async createSession(request: WorkRunRequest): Promise<AcquiredSession> {
      const { runId, model } = request;
      const resolvedModel = model || config.defaultModel || undefined;
      const timeout = config.timeout ?? 3_600_000;

      const server = await ensureServer();

      const approvalPolicy = config.approvalMode ?? "on-request";
      const overrides = (request.configSnapshot ?? {}) as Record<string, unknown>;
      const overrideSandboxMode = typeof overrides.sandboxMode === "string"
        ? (overrides.sandboxMode as CodexAdapterConfig["sandboxMode"])
        : undefined;
      const overrideEffort = typeof overrides.modelReasoningEffort === "string"
        ? (overrides.modelReasoningEffort as string)
        : typeof overrides.effortLevel === "string" && overrides.effortLevel
          ? (overrides.effortLevel as string)
          : undefined;
      const outputSchema = resolveOutputSchema(config);
      const overrideServiceTier = typeof overrides.serviceTier === "string" && overrides.serviceTier
        ? (overrides.serviceTier as string)
        : undefined;
      const overridePlanMode = typeof overrides.planMode === "boolean"
        ? (overrides.planMode as boolean)
        : undefined;
      const overrideGoalMode = typeof overrides.goalMode === "boolean"
        ? (overrides.goalMode as boolean)
        : undefined;
      const sandbox = mapSandboxMode(overrideSandboxMode ?? config.sandboxMode);
      const personality = config.personality ?? "none";

      const networkAccess = config.networkAccessEnabled !== false;
      const threadStartParams: Record<string, unknown> = {
        cwd: request.workspace.rootPath,
        approvalPolicy,
        sandbox,
        personality,
        ...(resolvedModel ? { model: resolvedModel } : {}),
        config: buildCodexConfigOverrides(networkAccess),
        dynamicTools: MAINS_DYNAMIC_TOOLS,
      };

      logInfo(`Starting thread (model: ${resolvedModel || "default"}, cwd: ${request.workspace.rootPath})`);
      const threadResult = await server.sendRequest("thread/start", threadStartParams) as Record<string, unknown>;
      const thread = threadResult?.thread as Record<string, unknown> | undefined;
      const threadId = (thread?.id ?? threadResult?.threadId) as string | undefined;

      if (threadId) sessionIdMap.set(runId, threadId);

      // Goal mode: register the prompt as the thread's goal so Codex tracks
      // token/time usage against it and reports completion ("Goal achieved").
      // Best-effort — older Codex builds without `thread/goal/*` shouldn't fail
      // the run. The goal stays active across follow-up turns until cleared.
      const goalMode = overrideGoalMode ?? config.goalMode ?? false;
      await maybeSetThreadGoal(server, threadId, goalMode, request.goal, request.workspace.rootPath, /*overwrite*/ true);

      const mainsCtx: MainsToolContext = { workspaceId: request.workspace.id, rootPath: request.workspace.rootPath, runId };
      activeRuns.set(runId, { threadId: threadId ?? null, turnId: null, aborted: false, currentMessageItemId: null, agentMessageBuffer: "", pendingFlush: [], mainsCtx, fileChangeBuffers: new Map(), fileChangeItems: new Map(), commandOutputBuffers: new Map(), emittedImagePaths: new Set(), emittedDocPaths: new Set(), runStartedAt: Date.now(), planBuffers: new Map(), subAgents: new Map() });

      const turnInput = buildTurnInput(request);
      const effort = overrideEffort ?? config.modelReasoningEffort;
      const serviceTier = overrideServiceTier ?? config.serviceTier;
      const planEnabled = overridePlanMode ?? config.planMode ?? false;
      const collaborationMode = buildCollaborationMode(planEnabled, resolvedModel, effort);
      const turnStartParams: Record<string, unknown> = {
        threadId: threadId ?? "",
        input: turnInput,
        ...(resolvedModel ? { model: resolvedModel } : {}),
        ...(effort ? { effort } : {}),
        ...(serviceTier ? { serviceTier } : {}),
        ...(outputSchema ? { output_schema: outputSchema } : {}),
        ...(collaborationMode ? { collaborationMode } : {}),
      };

      const startTurn = async () => {
        await server.sendRequest("turn/start", turnStartParams);
      };

      const session: CodexSession = { runId, startTurn, model: resolvedModel, timeout };
      return { session, prompt: request.goal, sessionId: threadId };
    },

    async resumeSession(request: WorkRunContinueRequest): Promise<AcquiredSession> {
      const { runId, message } = request;
      const resolvedModel = request.model || config.defaultModel || undefined;
      const timeout = config.timeout ?? 3_600_000;

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

      const approvalPolicy = config.approvalMode ?? "on-request";
      const sandbox = mapSandboxMode(config.sandboxMode);
      const personality = config.personality ?? "none";
      const networkAccess = config.networkAccessEnabled !== false;

      try {
        await server.sendRequest("thread/resume", {
          threadId,
          cwd: request.workspace.rootPath,
          approvalPolicy,
          sandbox,
          personality,
          ...(resolvedModel ? { model: resolvedModel } : {}),
          config: buildCodexConfigOverrides(networkAccess),
        });
      } catch (resumeError) {
        if (isCodexArchivedThreadError(resumeError)) {
          throw normalizeCodexResumeError(resumeError);
        }
        const errMsg = codexErrorMessage(resumeError);
        if (isCodexMissingThreadError(resumeError)) {
          logWarn(`Thread resume failed (${errMsg}), starting new thread`);
          const threadResult = await server.sendRequest("thread/start", {
            cwd: request.workspace.rootPath,
            approvalPolicy,
            sandbox,
            personality,
            ...(resolvedModel ? { model: resolvedModel } : {}),
            config: buildCodexConfigOverrides(networkAccess),
            dynamicTools: MAINS_DYNAMIC_TOOLS,
          }) as Record<string, unknown>;
          const newThreadId = (threadResult?.thread as Record<string, unknown>)?.id as string ??
                          threadResult?.threadId as string;
          if (newThreadId) {
            sessionIdMap.set(runId, newThreadId);
            threadId = newThreadId;
          }
        } else {
          throw resumeError;
        }
      }

      const mainsCtxContinue: MainsToolContext = { workspaceId: request.workspace.id, rootPath: request.workspace.rootPath, runId };
      activeRuns.set(runId, { threadId, turnId: null, aborted: false, currentMessageItemId: null, agentMessageBuffer: "", pendingFlush: [], mainsCtx: mainsCtxContinue, fileChangeBuffers: new Map(), fileChangeItems: new Map(), commandOutputBuffers: new Map(), emittedImagePaths: new Set(), emittedDocPaths: new Set(), runStartedAt: Date.now(), planBuffers: new Map(), subAgents: new Map() });

      const currentThreadId = sessionIdMap.get(runId) ?? threadId;

      // Goal mode on a continue: only establish a goal if the thread doesn't
      // already have an in-progress one (don't reset a multi-turn goal).
      await maybeSetThreadGoal(server, currentThreadId, config.goalMode ?? false, message, request.workspace.rootPath, /*overwrite*/ false);

      const turnInput = buildContinueTurnInput(message, request);

      const continueOutputSchema = resolveOutputSchema(config);
      const continueCollaborationMode = buildCollaborationMode(
        config.planMode ?? false,
        resolvedModel,
        config.modelReasoningEffort,
        /*forceReset*/ true,
      );
      const turnStartParams = {
        threadId: currentThreadId,
        input: turnInput,
        ...(resolvedModel ? { model: resolvedModel } : {}),
        ...(config.modelReasoningEffort ? { effort: config.modelReasoningEffort } : {}),
        ...(config.serviceTier ? { serviceTier: config.serviceTier } : {}),
        ...(continueOutputSchema ? { output_schema: continueOutputSchema } : {}),
        ...(continueCollaborationMode ? { collaborationMode: continueCollaborationMode } : {}),
      };
      const startTurn = async () => {
        await server.sendRequest("turn/start", turnStartParams);
      };

      const session: CodexSession = { runId, startTurn, model: resolvedModel, timeout };
      return { session, prompt: message, sessionId: threadId };
    },

    async forkSession(request: WorkRunForkRequest): Promise<AcquiredSession> {
      const { runId, sourceRunId, message } = request;
      const resolvedModel = request.model || config.defaultModel || undefined;
      const timeout = config.timeout ?? 3_600_000;

      logInfo(`Forking session from run ${sourceRunId} into new run ${runId}`);

      const server = await ensureServer();

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

      const approvalPolicy = config.approvalMode ?? "on-request";
      const sandbox = mapSandboxMode(config.sandboxMode);
      const personality = config.personality ?? "none";
      const networkAccess = config.networkAccessEnabled !== false;

      const forkResult = await server.sendRequest("thread/fork", {
        threadId: sourceThreadId,
        cwd: request.workspace.rootPath,
        approvalPolicy,
        sandbox,
        personality,
        ...(resolvedModel ? { model: resolvedModel } : {}),
        config: buildCodexConfigOverrides(networkAccess),
      }) as Record<string, unknown>;

      const forkedThread = forkResult?.thread as Record<string, unknown> | undefined;
      const forkedThreadId = (forkedThread?.id ?? forkResult?.threadId) as string | undefined;

      if (!forkedThreadId) {
        throw new Error("thread/fork did not return a new thread ID");
      }

      sessionIdMap.set(runId, forkedThreadId);

      // Goal mode on a fork: the fork inherits the source thread's goal, so
      // only set one if there's none in progress (mirrors continue).
      await maybeSetThreadGoal(server, forkedThreadId, config.goalMode ?? false, message, request.workspace.rootPath, /*overwrite*/ false);

      const mainsCtxFork: MainsToolContext = { workspaceId: request.workspace.id, rootPath: request.workspace.rootPath, runId };
      activeRuns.set(runId, {
        threadId: forkedThreadId,
        turnId: null,
        aborted: false,
        currentMessageItemId: null,
        agentMessageBuffer: "",
        pendingFlush: [],
        mainsCtx: mainsCtxFork,
        fileChangeBuffers: new Map(),
        fileChangeItems: new Map(),
        commandOutputBuffers: new Map(),
        emittedImagePaths: new Set(),
        emittedDocPaths: new Set(),
        runStartedAt: Date.now(),
        planBuffers: new Map(),
        subAgents: new Map(),
      });

      const turnInput = buildContinueTurnInput(message, {
        runId,
        message,
        workspace: request.workspace,
        attachments: request.attachments,
      } as WorkRunContinueRequest);

      const forkOutputSchema = resolveOutputSchema(config);
      const forkCollaborationMode = buildCollaborationMode(
        config.planMode ?? false,
        resolvedModel,
        config.modelReasoningEffort,
        /*forceReset*/ true,
      );
      const turnStartParams = {
        threadId: forkedThreadId,
        input: turnInput,
        ...(resolvedModel ? { model: resolvedModel } : {}),
        ...(config.modelReasoningEffort ? { effort: config.modelReasoningEffort } : {}),
        ...(config.serviceTier ? { serviceTier: config.serviceTier } : {}),
        ...(forkOutputSchema ? { output_schema: forkOutputSchema } : {}),
        ...(forkCollaborationMode ? { collaborationMode: forkCollaborationMode } : {}),
      };
      const startTurn = async () => {
        await server.sendRequest("turn/start", turnStartParams);
      };

      const session: CodexSession = { runId, startTurn, model: resolvedModel, timeout };
      return { session, prompt: message, sessionId: forkedThreadId };
    },

    async reviewSession(request: WorkRunReviewRequest): Promise<AcquiredSession> {
      const { runId } = request;
      const resolvedModel = request.model || config.defaultModel || undefined;
      const timeout = config.timeout ?? 3_600_000;

      const server = await ensureServer();

      const approvalPolicy = config.approvalMode ?? "on-request";
      const sandbox = mapSandboxMode(config.sandboxMode);
      const personality = config.personality ?? "none";

      const networkAccess = config.networkAccessEnabled !== false;
      const threadStartParams: Record<string, unknown> = {
        cwd: request.workspace.rootPath,
        approvalPolicy,
        sandbox,
        personality,
        ...(resolvedModel ? { model: resolvedModel } : {}),
        config: buildCodexConfigOverrides(networkAccess),
        dynamicTools: MAINS_DYNAMIC_TOOLS,
      };

      logInfo(`Starting review thread (model: ${resolvedModel || "default"}, cwd: ${request.workspace.rootPath})`);
      const threadResult = await server.sendRequest("thread/start", threadStartParams) as Record<string, unknown>;
      const thread = threadResult?.thread as Record<string, unknown> | undefined;
      const threadId = (thread?.id ?? threadResult?.threadId) as string | undefined;

      if (threadId) sessionIdMap.set(runId, threadId);

      const mainsCtxReview: MainsToolContext = { workspaceId: request.workspace.id, rootPath: request.workspace.rootPath, runId };
      activeRuns.set(runId, { threadId: threadId ?? null, turnId: null, aborted: false, currentMessageItemId: null, agentMessageBuffer: "", pendingFlush: [], mainsCtx: mainsCtxReview, fileChangeBuffers: new Map(), fileChangeItems: new Map(), commandOutputBuffers: new Map(), emittedImagePaths: new Set(), emittedDocPaths: new Set(), runStartedAt: Date.now(), planBuffers: new Map(), subAgents: new Map() });

      const target: Record<string, unknown> = { type: request.target.type };
      if (request.target.type === "baseBranch" && request.target.branch) {
        target.branch = request.target.branch;
      } else if (request.target.type === "commit") {
        if (request.target.sha) target.sha = request.target.sha;
        if (request.target.title) target.title = request.target.title;
      } else if (request.target.type === "custom" && request.target.instructions) {
        target.instructions = request.target.instructions;
      }

      const reviewStartParams: Record<string, unknown> = {
        threadId: threadId ?? "",
        target,
        ...(request.delivery ? { delivery: request.delivery } : {}),
        ...(resolvedModel ? { model: resolvedModel } : {}),
      };

      const startTurn = async () => {
        logInfo(`Starting review: target=${request.target.type}, delivery=${request.delivery ?? "inline"}`);
        await server.sendRequest("review/start", reviewStartParams);
      };

      // Review verbs don't carry a user-message string, so Core skips the
      // generic user-prompt artifact. Emit a custom one carrying the review
      // target description right before startTurn.
      const targetLabel =
        request.target.type === "uncommittedChanges"
          ? "Review uncommitted changes"
          : request.target.type === "baseBranch"
            ? `Changes vs ${request.target.branch ?? "base branch"}`
            : request.target.type === "commit"
              ? `Commit ${request.target.sha?.substring(0, 7) ?? ""}${request.target.title ? ` — ${request.target.title}` : ""}`
              : "Code Changes";
      const preExecuteEvent: WorkRunEvent = {
        type: "artifact",
        kind: "user-prompt",
        content: targetLabel,
        metadata: {
          source: "user",
          isReview: true,
          reviewTarget: request.target.type,
          delivery: request.delivery ?? "inline",
        },
      };

      const session: CodexSession = {
        runId,
        startTurn,
        model: resolvedModel,
        timeout,
        preExecuteEvent,
      };
      return { session, prompt: "", sessionId: threadId };
    },

    async executePrompt(
      sessionParam,
      _prompt,
      onEvent,
      signal,
    ): Promise<DriverOutcome> {
      const cs = sessionParam as CodexSession;

      // Wire abort: when signal fires, interrupt the current turn via the SDK.
      const onAbort = () => {
        const runState = activeRuns.get(cs.runId);
        if (runState) runState.aborted = true;
        if (
          appServer?.isRunning &&
          runState?.threadId &&
          runState?.turnId
        ) {
          appServer
            .sendRequest("turn/interrupt", {
              threadId: runState.threadId,
              turnId: runState.turnId,
            })
            .catch((err) => logError("Failed to interrupt turn:", err));
        }
      };
      signal.addEventListener("abort", onAbort, { once: true });

      try {
        if (!appServer?.isRunning) {
          throw new Error("Codex app-server is not running");
        }

        if (cs.preExecuteEvent) {
          await onEvent(cs.preExecuteEvent);
        }

        await cs.startTurn();
        const result = await waitForTurnCompletion(
          appServer,
          cs.runId,
          cs.model,
          onEvent,
          cs.timeout,
        );

        return {
          status: result.status,
          summary: result.error,
          usage: flushUsage(cs.runId),
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logError("executePrompt failed:", msg);
        flushUsage(cs.runId);
        return { status: "failed", summary: msg };
      } finally {
        signal.removeEventListener("abort", onAbort);
      }
    },

    async cleanup(sessionParam): Promise<void> {
      const cs = sessionParam as CodexSession;
      activeRuns.delete(cs.runId);
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
      invalidatePluginCaches();
      marketplacePathCache.clear();
      remotePluginRefCache.clear();

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

            // serviceTiers (preferred) or legacy additionalSpeedTiers (string[]).
            // Codex returns { id, name, description } per tier; the older
            // additionalSpeedTiers array carries only ids, so we lift them
            // into the same shape with id==name as a fallback.
            const tiersRaw = m.serviceTiers as Array<{ id: string; name?: string; description?: string }> | undefined;
            const legacyTiers = m.additionalSpeedTiers as string[] | undefined;
            const serviceTiers = tiersRaw && tiersRaw.length > 0
              ? tiersRaw.map((t) => ({ id: t.id, name: t.name ?? t.id, description: t.description }))
              : legacyTiers && legacyTiers.length > 0
                ? legacyTiers.map((id) => ({ id, name: id }))
                : undefined;

            const rawName = (m.displayName as string) || (m.id as string);
            // Format display name: "gpt-5.4" → "GPT-5.4", "gpt-5.1-codex-mini" → "GPT-5.1 Codex Mini"
            const displayName = rawName
              .replace(/^gpt-/i, "GPT-")
              .replace(/-codex/i, " Codex")
              .replace(/-mini$/i, " Mini")
              .replace(/-max$/i, " Max")
              .replace(/-spark$/i, " Spark");

            // Codex's "fast" speed tier (id = SPEED_TIER_FAST = "fast" in
            // codex-rs/protocol/src/openai_models.rs; Codex internally maps it
            // to OpenAI's "priority" service tier). Some legacy responses still
            // surface it as "priority", so accept either.
            const supportsFastMode =
              serviceTiers?.some((t) => t.id === "fast" || t.id === "priority") ?? false;

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
              supportsFastMode,
              serviceTiers,
            };
          });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (/not authenticated/i.test(msg)) throw error;
        logError("Failed to list models:", error);
        return [];
      }
    },

    async getAccountInfo(): Promise<AccountInfo> {
      const cli = { version: await getCodexVersion(), channel: null, outdated: false };
      try {
        const server = await ensureServer();
        const result = await server.sendRequest("account/read", {}) as Record<string, unknown>;
        return {
          account: result.account as AccountInfo["account"],
          requiresOpenaiAuth: (result.requiresOpenaiAuth as boolean) ?? false,
          cli,
        };
      } catch (error) {
        logError("Failed to read account:", error);
        return { account: null, requiresOpenaiAuth: true, cli };
      }
    },

    async updateCli(): Promise<CliUpdateResult> {
      const { stdout, stderr, code } = await runCodexCli(["update"], 120000);
      return { success: code === 0, output: `${stdout}${stderr}`.trim() };
    },

    async getRateLimits(): Promise<import("../../../../shared/adapter.types").RateLimitInfo | null> {
      try {
        if (!appServer?.isRunning) return null;
        const result = await appServer.sendRequest("account/rateLimits/read", {}) as Record<string, unknown>;
        return mapRateLimitSnapshot(result?.rateLimits as Record<string, unknown> | undefined);
      } catch (error) {
        logError("Failed to get rate limits:", error);
        return null;
      }
    },

    // ── Thread goal controls (Codex `thread/goal/*`) ──
    // threadId is resolved from the in-memory sessionIdMap, falling back to the
    // run's persisted sessionId (survives an app restart). We also broadcast the
    // result directly so the caller's card converges even if the matching
    // `thread/goal/updated` notification races or is missed.

    async setGoal(runId: string, params: GoalSetParams): Promise<GoalInfo | null> {
      try {
        const threadId = sessionIdMap.get(runId) ?? (await runsRepo.findRunById(runId))?.sessionId ?? undefined;
        if (!threadId) {
          logWarn(`setGoal: no thread for run ${runId}`);
          return null;
        }
        const server = await ensureServer();
        const result = await server.sendRequest("thread/goal/set", {
          threadId,
          ...(params.objective !== undefined ? { objective: params.objective } : {}),
          ...(params.status !== undefined ? { status: params.status } : {}),
          ...(params.tokenBudget !== undefined ? { tokenBudget: params.tokenBudget } : {}),
        }) as Record<string, unknown>;
        const goal = mapGoalSnapshot(result?.goal as Record<string, unknown> | undefined);
        broadcastGoal(PROVIDER_IDS.codex, runId, goal);
        return goal;
      } catch (error) {
        logError("setGoal failed:", error);
        return null;
      }
    },

    async getGoal(runId: string): Promise<GoalInfo | null> {
      try {
        const threadId = sessionIdMap.get(runId) ?? (await runsRepo.findRunById(runId))?.sessionId ?? undefined;
        if (!threadId || !appServer?.isRunning) return null;
        const result = await appServer.sendRequest("thread/goal/get", { threadId }) as Record<string, unknown>;
        return mapGoalSnapshot(result?.goal as Record<string, unknown> | undefined);
      } catch (error) {
        if (isCodexUnavailableThreadError(error)) return null;
        logError("getGoal failed:", error);
        return null;
      }
    },

    async clearGoal(runId: string): Promise<boolean> {
      try {
        const threadId = sessionIdMap.get(runId) ?? (await runsRepo.findRunById(runId))?.sessionId ?? undefined;
        if (!threadId) return false;
        const server = await ensureServer();
        const result = await server.sendRequest("thread/goal/clear", { threadId }) as Record<string, unknown>;
        const cleared = result?.cleared === true;
        if (cleared) broadcastGoal(PROVIDER_IDS.codex, runId, null);
        return cleared;
      } catch (error) {
        logError("clearGoal failed:", error);
        return false;
      }
    },

    async listSkills(): Promise<import("../../../../shared/adapter.types").SkillInfo[]> {
      try {
        const server = await ensureServer();
        const result = await server.sendRequest("skills/list", { forceReload: true }) as Record<string, unknown>;
        const entries = result?.data as Array<Record<string, unknown>> | undefined;

        const skills: import("../../../../shared/adapter.types").SkillInfo[] = [];
        if (entries && Array.isArray(entries)) {
          for (const entry of entries) {
            const entrySkills = entry.skills as Array<Record<string, unknown>> | undefined;
            if (!entrySkills) continue;
            for (const s of entrySkills) {
              if (!s.enabled) continue;
              const iface = s.interface as Record<string, unknown> | undefined;
              const scopeRaw = s.scope as string | undefined;
              const source = scopeRaw === "user"
                ? "user"
                : scopeRaw === "repo" || scopeRaw === "project"
                  ? "project"
                  : undefined;
              skills.push({
                name: s.name as string,
                description: (iface?.shortDescription as string) || (s.shortDescription as string) || (s.description as string) || "",
                source: source as "user" | "project" | undefined,
                path: s.path as string | undefined,
                userInvokable: true,
                displayName: (iface?.displayName as string) || undefined,
                shortDescription: (iface?.shortDescription as string) || (s.shortDescription as string) || undefined,
                iconSmall: (iface?.iconSmall as string) || undefined,
                iconLarge: (iface?.iconLarge as string) || undefined,
                brandColor: (iface?.brandColor as string) || undefined,
                defaultPrompt: (iface?.defaultPrompt as string) || undefined,
                scope: scopeRaw,
                enabled: s.enabled as boolean | undefined,
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

    async generateTitle(goal: string, context?: WorkRunContextItem[]): Promise<string> {
      try {
        const binaryPath = findCodexBinary();

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
          "- Use title case: capitalize the first letter of each word, e.g. \"Fix Login Redirect\", \"Add Dark Mode\", \"Hello Greeting\"",
          "- Do NOT use generic descriptions of the request type, e.g. NOT \"Title Generation\"",
          "- No quotes, no punctuation at the end, no prefixes",
          "",
          `User message: ${goal}`,
          contextSnippet ? `\nContext:\n${contextSnippet}` : "",
        ].filter(Boolean).join("\n");

        const titleText = await new Promise<string>((resolve, reject) => {
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-title-"));
          const outputPath = path.join(tmpDir, "title.txt");
          let settled = false;
          let stdout = "";
          let stderr = "";

          const cleanup = () => {
            try {
              fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch {
              // Ignore temp cleanup failures.
            }
          };

          const env: Record<string, string | undefined> = {
            ...process.env,
            HOME: os.homedir(),
            PATH: [
              path.dirname(binaryPath),
              path.join(os.homedir(), ".nvm", "versions", "node"),
              "/usr/local/bin",
              "/opt/homebrew/bin",
              process.env.PATH || "",
            ].join(":"),
          };
          if (config.apiKey) {
            env.OPENAI_API_KEY = config.apiKey;
          } else if (process.env.OPENAI_API_KEY) {
            env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
          } else if (process.env.CODEX_API_KEY) {
            env.CODEX_API_KEY = process.env.CODEX_API_KEY;
          }

          const args = [
            "exec",
            "--ephemeral",
            "--skip-git-repo-check",
            "--ignore-rules",
            "--sandbox", "read-only",
            "--color", "never",
            "--output-last-message", outputPath,
            "--model", titleGenerationModel,
            // ~/.codex/config.toml leaks into ephemeral execs: a user-level
            // reasoning effort can be unsupported by the title model (400),
            // and configured MCP servers stall/spam a one-shot run.
            "--ignore-user-config",
            "-c", "model_reasoning_effort=low",
            "-",
          ];

          const child = spawn(binaryPath, args, {
            cwd: os.homedir(),
            env,
            stdio: ["pipe", "pipe", "pipe"],
          });

          const timer = setTimeout(() => {
            try { child.kill("SIGKILL"); } catch { /* already exited */ }
            finish(() => {
              cleanup();
              reject(new Error("Codex title generation timed out"));
            });
          }, 15000);

          function finish(fn: () => void) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            fn();
          }

          child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
          child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
          child.on("error", (err) => {
            finish(() => {
              cleanup();
              reject(err);
            });
          });
          child.on("close", (code) => {
            finish(() => {
              try {
                const output = fs.existsSync(outputPath)
                  ? fs.readFileSync(outputPath, "utf-8").trim()
                  : stdout.trim();
                cleanup();
                if (code === 0 && output) {
                  resolve(output);
                } else {
                  reject(new Error(stderr.trim() || `Exit code ${code}`));
                }
              } catch (err) {
                cleanup();
                reject(err);
              }
            });
          });

          child.stdin?.end(titlePrompt);
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

    async generateText(
      prompt: string,
      opts?: { system?: string; model?: string },
    ): Promise<string> {
      const binaryPath = findCodexBinary();
      const fullPrompt = opts?.system
        ? `${opts.system}\n\n${prompt}`
        : prompt;

      return await new Promise<string>((resolve, reject) => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mains-codex-gen-"));
        const outputPath = path.join(tmpDir, "out.txt");
        let settled = false;
        let stdout = "";
        let stderr = "";

        const cleanup = () => {
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch {
            // Ignore temp cleanup failures.
          }
        };

        const env: Record<string, string | undefined> = {
          ...process.env,
          HOME: os.homedir(),
          PATH: [
            path.dirname(binaryPath),
            path.join(os.homedir(), ".nvm", "versions", "node"),
            "/usr/local/bin",
            "/opt/homebrew/bin",
            process.env.PATH || "",
          ].join(":"),
        };
        if (config.apiKey) {
          env.OPENAI_API_KEY = config.apiKey;
        } else if (process.env.OPENAI_API_KEY) {
          env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        } else if (process.env.CODEX_API_KEY) {
          env.CODEX_API_KEY = process.env.CODEX_API_KEY;
        }

        const args = [
          "exec",
          "--ephemeral",
          "--skip-git-repo-check",
          "--ignore-rules",
          "--sandbox", "read-only",
          "--color", "never",
          "--output-last-message", outputPath,
          "--model", opts?.model ?? titleGenerationModel,
          // Same overrides as title generation — see comment there.
          "--ignore-user-config",
          "-c", "model_reasoning_effort=low",
          "-",
        ];

        const child = spawn(binaryPath, args, {
          cwd: os.homedir(),
          env,
          stdio: ["pipe", "pipe", "pipe"],
        });

        const timer = setTimeout(() => {
          try { child.kill("SIGKILL"); } catch { /* already exited */ }
          finish(() => {
            cleanup();
            reject(new Error("Codex text generation timed out"));
          });
        }, 30000);

        function finish(fn: () => void) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          fn();
        }

        child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
        child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });
        child.on("error", (err) => {
          finish(() => {
            cleanup();
            reject(err);
          });
        });
        child.on("close", (code) => {
          finish(() => {
            try {
              const output = fs.existsSync(outputPath)
                ? fs.readFileSync(outputPath, "utf-8").trim()
                : stdout.trim();
              cleanup();
              if (code === 0 && output) {
                resolve(output);
              } else {
                reject(new Error(stderr.trim() || `Exit code ${code}`));
              }
            } catch (err) {
              cleanup();
              reject(err);
            }
          });
        });

        child.stdin?.end(fullPrompt);
      });
    },

    async listPlugins(): Promise<PluginListResponse> {
      if (
        pluginCatalogCache &&
        Date.now() - pluginCatalogCache.fetchedAt < pluginCatalogTtlMs
      ) {
        return pluginCatalogCache.value;
      }
      if (pluginCatalogInFlight) return pluginCatalogInFlight;

      const staleValue = pluginCatalogCache?.value;
      const generation = pluginCacheGeneration;
      const request = fetchPluginList("plugin/list")
        .then((value) => {
          if (generation === pluginCacheGeneration) {
            pluginCatalogCache = { value, fetchedAt: Date.now() };
          }
          return value;
        })
        .catch((error) => pluginListFailure(error, "plugin/list", staleValue))
        .finally(() => {
          if (pluginCatalogInFlight === request) pluginCatalogInFlight = null;
        });
      pluginCatalogInFlight = request;
      return request;
    },

    async listInstalledPlugins(): Promise<PluginListResponse> {
      if (
        installedPluginsCache &&
        Date.now() - installedPluginsCache.fetchedAt < installedPluginsTtlMs
      ) {
        return installedPluginsCache.value;
      }
      if (installedPluginsInFlight) return installedPluginsInFlight;

      const staleValue = installedPluginsCache?.value;
      const generation = pluginCacheGeneration;
      const request = fetchPluginList("plugin/installed")
        .then((value) => {
          if (generation === pluginCacheGeneration) {
            installedPluginsCache = { value, fetchedAt: Date.now() };
          }
          return value;
        })
        .catch((error) =>
          pluginListFailure(error, "plugin/installed", staleValue),
        )
        .finally(() => {
          if (installedPluginsInFlight === request) {
            installedPluginsInFlight = null;
          }
        });
      installedPluginsInFlight = request;
      return request;
    },

    async readPlugin(pluginName: string, marketplacePath: string): Promise<PluginDetail> {
      const server = await ensureServer();
      // Local marketplaces read by path; remote-catalog plugins (path-less) by backend id.
      const remoteRef = !marketplacePath ? remotePluginRefCache.get(pluginName) : undefined;
      if (!marketplacePath && !remoteRef) {
        throw new Error(`Marketplace not found for plugin "${pluginName}". Try browsing plugins first.`);
      }
      const params = marketplacePath
        ? { pluginName, marketplacePath }
        : { pluginName: remoteRef!.remotePluginId, remoteMarketplaceName: remoteRef!.marketplaceName };
      const result = await server.sendRequest("plugin/read", params, 30000) as Record<string, unknown>;
      const p = result?.plugin as Record<string, unknown>;
      if (!p) throw new Error("plugin/read returned no plugin data");

      const summary = p.summary as Record<string, unknown>;
      const iface = summary?.interface as Record<string, unknown> | undefined;
      const skills = (p.skills as Array<Record<string, unknown>>) ?? [];
      const apps = (p.apps as Array<Record<string, unknown>>) ?? [];
      const appDirectory = loadAppDirectory();

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
            composerIcon: pluginAssetUrl(iface.composerIcon as string | undefined, iface.composerIconUrl as string | undefined),
            logo: pluginAssetUrl(iface.logo as string | undefined, iface.logoUrl as string | undefined),
            screenshots: ([...((iface.screenshots as string[]) ?? []), ...((iface.screenshotUrls as string[]) ?? [])])
              .map((s) => pluginAssetUrl(s))
              .filter(Boolean) as string[],
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
        apps: apps.map((a) => {
          // plugin/read only carries id/name/description/category for remote
          // plugins; logos and Connected state come from the directory cache.
          const dirEntry = appDirectory.get(a.id as string);
          return {
            id: a.id as string,
            name: (a.name as string) || dirEntry?.name || (a.id as string),
            needsAuth: (a.needsAuth as boolean) ?? false,
            description: (a.description as string | undefined) ?? dirEntry?.description,
            installUrl: (a.installUrl as string | undefined) ?? dirEntry?.installUrl,
            isAccessible: (a.isAccessible as boolean | undefined) ?? dirEntry?.isAccessible,
            isEnabled: (a.isEnabled as boolean | undefined) ?? dirEntry?.isEnabled,
            category: a.category as string | undefined,
            iconUrl: dirEntry?.logoUrl,
          };
        }),
        mcpServers: (p.mcpServers as string[]) ?? [],
      };
    },

    async installPlugin(pluginId: string, _scope?: "user" | "project" | "local"): Promise<void> {
      // Codex has no install-scope concept; _scope exists only for interface parity.
      const server = await ensureServer();
      // pluginId format: "name@marketplace" e.g. "github@openai-curated-remote"
      const atIdx = pluginId.lastIndexOf("@");
      const marketplaceName = atIdx !== -1 ? pluginId.slice(atIdx + 1) : "";
      const pluginName = atIdx !== -1 ? pluginId.slice(0, atIdx) : pluginId;
      const marketplacePath = marketplacePathCache.get(marketplaceName);
      const remoteRef = remotePluginRefCache.get(pluginId);

      if (marketplacePath) {
        await server.sendRequest("plugin/install", { pluginName, marketplacePath }, 120000);

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
      } else if (remoteRef) {
        // Remote catalog: install goes by backend id and downloads the bundle
        // (hence the long timeout); the server enables it as part of install.
        await server.sendRequest("plugin/install", {
          pluginName: remoteRef.remotePluginId,
          remoteMarketplaceName: remoteRef.marketplaceName,
        }, 120000);
      } else {
        throw new Error(`Marketplace not found for "${pluginId}". Try browsing plugins first.`);
      }

      invalidatePluginCaches();
      logInfo(`Plugin installed and enabled: ${pluginId}`);
    },

    async uninstallPlugin(pluginId: string): Promise<void> {
      const server = await ensureServer();
      const atIdx = pluginId.lastIndexOf("@");
      const marketplaceName = atIdx !== -1 ? pluginId.slice(atIdx + 1) : "";
      const marketplacePath = marketplacePathCache.get(marketplaceName);
      const remoteRef = remotePluginRefCache.get(pluginId);

      if (marketplacePath) {
        await server.sendRequest("plugin/uninstall", { pluginId, marketplacePath });
      } else if (remoteRef) {
        // Remote plugins uninstall by backend id — the composite id silently no-ops.
        await server.sendRequest("plugin/uninstall", { pluginId: remoteRef.remotePluginId });
      } else {
        throw new Error(`Marketplace not found for "${pluginId}". Try browsing plugins first.`);
      }
      invalidatePluginCaches();
      logInfo(`Plugin uninstalled: ${pluginId}`);
    },

    async setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
      const server = await ensureServer();
      // Remote-catalog plugins ignore the config-level enabled flag (their
      // state lives server-side): the write below would "succeed" without
      // changing anything, so refuse loudly instead of pretending.
      const atIdx = pluginId.lastIndexOf("@");
      const marketplaceName = atIdx !== -1 ? pluginId.slice(atIdx + 1) : "";
      if (!marketplacePathCache.get(marketplaceName) && remotePluginRefCache.has(pluginId)) {
        throw new Error("Codex remote plugins can't be enabled/disabled — uninstall the plugin instead.");
      }
      await server.sendRequest("config/value/write", {
        keyPath: `plugins.${pluginId}.enabled`,
        value: enabled,
        mergeStrategy: "replace",
      });
      invalidatePluginCaches();
      logInfo(`Plugin ${enabled ? "enabled" : "disabled"}: ${pluginId}`);
    },
  };
}
