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

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app, shell } from "electron";
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
  ProviderDriver,
  RateLimitInfo,
  WorkRunContextItem,
  WorkRunContinueRequest,
  WorkRunEvent,
  WorkRunEventHandler,
  WorkRunForkRequest,
  WorkRunRequest,
  WorkRunReviewRequest,
} from "../../../../shared/adapter.types";
import {
  cancelPendingRequest,
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
import type { CodexAppServerParams } from "./codex-app-server-protocol/rpc";
import { CodexAppServer } from "./codex-app-server.client";
import {
  createCodexCapabilities,
  mapRateLimitSnapshot,
} from "./codex-capabilities";
import {
  createCodexEventRunState,
  createCodexEventMapper,
  type CodexEventRunState,
} from "./codex-event-mapper";

export const CODEX_ARCHIVED_CHAT_MESSAGE =
  "This chat is archived in Codex. Unarchive it in Codex to continue, or archive it in Mains to hide it from this workspace.";

/** App-server schema version this driver is developed and tested against. */
export const CODEX_APP_SERVER_PROTOCOL_VERSION = "0.146.0";
/** Oldest CLI whose app-server contract Mains accepts. */
export const CODEX_MIN_CLI_VERSION = "0.146.0";

function compareCodexVersions(left: string, right: string): number | null {
  const parse = (value: string): [number, number, number] | null => {
    const match = value.match(/^(\d+)\.(\d+)\.(\d+)/);
    return match
      ? [Number(match[1]), Number(match[2]), Number(match[3])]
      : null;
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] < rightParts[index] ? -1 : 1;
    }
  }
  return 0;
}

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

type CodexConfigOverrides = NonNullable<
  CodexAppServerParams<"thread/start">["config"]
>;
type CodexOutputSchema = Exclude<
  CodexAppServerParams<"turn/start">["outputSchema"],
  null | undefined
>;
type CodexGoalStatus = NonNullable<
  CodexAppServerParams<"thread/goal/set">["status"]
>;

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
 * payload Codex's `turn/start` expects via `outputSchema`, or undefined if
 * the user hasn't selected one. Mirrors the wiring in claude.adapter.ts.
 */
function resolveOutputSchema(
  config: CodexAdapterConfig,
): CodexOutputSchema | undefined {
  const selectedId = config.structuredOutputsSelectedId;
  if (!selectedId) return undefined;
  return config.structuredOutputs?.[selectedId]?.schema as
    | CodexOutputSchema
    | undefined;
}

/**
 * Codex's app-server treats ThreadStartParams.config as a TOML override map
 * (codex-rs/config/src/overrides.rs::build_cli_overrides_layer). The key uses
 * dotted-path notation matching ConfigToml fields. Network access lives under
 * `sandbox_workspace_write.network_access` — there is NO top-level
 * `sandbox_network_access` field.
 */
function buildCodexConfigOverrides(
  networkAccess: boolean,
): CodexConfigOverrides {
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

export function buildCodexReviewTarget(
  target: WorkRunReviewRequest["target"],
): CodexAppServerParams<"review/start">["target"] {
  if (target.type === "uncommittedChanges") {
    return { type: "uncommittedChanges" };
  }
  if (target.type === "baseBranch") {
    if (!target.branch) {
      throw new Error("A base branch is required for a base-branch review");
    }
    return { type: "baseBranch", branch: target.branch };
  }
  if (target.type === "commit") {
    if (!target.sha) {
      throw new Error("A commit SHA is required for a commit review");
    }
    return {
      type: "commit",
      sha: target.sha,
      title: target.title ?? null,
    };
  }
  if (!target.instructions) {
    throw new Error("Instructions are required for a custom review");
  }
  return { type: "custom", instructions: target.instructions };
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

type CodexThreadStartParams = CodexAppServerParams<"thread/start"> & {
  dynamicTools?: typeof MAINS_DYNAMIC_TOOLS;
};

type CodexTurnStartParams = CodexAppServerParams<"turn/start"> & {
  collaborationMode?: Record<string, unknown>;
};

// ─────────────────────────────────────────────────────────────
// Active run tracking
// ─────────────────────────────────────────────────────────────

type CodexActiveRunState = CodexEventRunState & {
  /** Threads this run subscribed to and must release during cleanup. */
  subscribedThreadIds: Set<string>;
  aborted: boolean;
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
};

const activeRuns = new Map<string, CodexActiveRunState>();

function createActiveRunState(
  threadId: string | null,
  mainsCtx: MainsToolContext,
): CodexActiveRunState {
  return {
    ...createCodexEventRunState(threadId, mainsCtx),
    subscribedThreadIds: new Set(
      threadId ? [threadId] : [],
    ),
    aborted: false,
  };
}

// Session ID mapping: runId → threadId (for resume support)
const sessionIdMap = new Map<string, string>();

// Track saved review item IDs to prevent duplicate persistence
const savedReviewItems = new Set<string>();

const codexLogger = createLogger("[CodexDriver]");
const { info: logInfo, error: logError, warn: logWarn } = codexLogger;

function persistCodexReviewFindings(
  runId: string,
  itemId: string,
  reviewText: string,
): void {
  if (savedReviewItems.has(itemId)) return;
  savedReviewItems.add(itemId);
  const findings = parseCodexReviewFindings(reviewText);
  if (findings.length === 0) return;

  void (async () => {
    try {
      const run = await runsRepo.findRunById(runId);
      if (!run?.workspaceId) return;

      const reviewId = await workspaceRepo.insertReview({
        workspaceId: run.workspaceId,
        title: "Code Review",
        summary: reviewText,
        runId,
      });
      await workspaceRepo.insertManyFindings(
        findings.map((finding) => ({
          reviewId,
          severity: finding.severity as any,
          file: finding.file,
          lineStart: finding.lineStart,
          lineEnd: finding.lineEnd,
          message: finding.message,
          reason: finding.reason,
        })),
      );

      logWorkspaceActivity({
        workspaceId: run.workspaceId,
        type: "review",
        title: "Code Review",
        summary: reviewText,
        refId: reviewId,
      });
      logWorkspaceActivity({
        workspaceId: run.workspaceId,
        type: "finding",
        title: `${findings.length} finding(s) saved`,
        refId: reviewId,
        metadata: {
          count: findings.length,
          critical: findings.filter(
            (finding) => finding.severity === "critical",
          ).length,
          warning: findings.filter(
            (finding) => finding.severity === "warning",
          ).length,
          info: findings.filter(
            (finding) => finding.severity === "info",
          ).length,
        },
      });

      logInfo(
        `Saved review ${reviewId} with ${findings.length} finding(s) for run ${runId}`,
      );
    } catch (error) {
      logError("Failed to persist review findings:", error);
    }
  })();
}

// ─────────────────────────────────────────────────────────────
// Rate-limit live push
// ─────────────────────────────────────────────────────────────

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
  server: CodexAppServer,
  threadId: string | undefined,
  goalMode: boolean,
  rawObjective: string | undefined,
  rootPath: string | undefined,
  overwrite: boolean,
): Promise<void> {
  if (!goalMode || !threadId || !rawObjective?.trim()) return;
  if (!overwrite) {
    try {
      const existing = await server.sendRequest("thread/goal/get", {
        threadId,
      });
      if (existing.goal && existing.goal.status !== "complete") return;
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
// Adapter factory
// ─────────────────────────────────────────────────────────────

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

type TurnCompletion = {
  status: "succeeded" | "failed" | "canceled";
  error?: string;
};

interface CodexRunSink {
  handleNotification: (method: string, params: unknown) => Promise<void>;
  handleServerRequest: (
    id: number | string,
    method: string,
    params: unknown,
  ) => Promise<void>;
  notificationQueue: Promise<void>;
  finalize: (result: TurnCompletion) => void;
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
  let appServerStartPromise: Promise<CodexAppServer> | null = null;
  let codexVersionPromise: Promise<string | null> | null = null;
  let codexCompatibilityPromise: Promise<void> | null = null;
  const runSinks = new Map<string, CodexRunSink>();
  const serverRequestOwners = new Map<string, string>();
  const titleGenerationModel = "gpt-5.4-mini";
  const capabilities = createCodexCapabilities({
    defaultModel: config.defaultModel,
    ensureServer: (cwd) => ensureServer(cwd),
    getRunningServer: () =>
      appServer?.isRunning ? appServer : null,
    getCliHealth: () => getCodexCliHealth(),
    logger: codexLogger,
  });
  const eventMapper = createCodexEventMapper({
    getRunState: (runId) => activeRuns.get(runId),
    onReviewCompleted: persistCodexReviewFindings,
    onParentThreadStarted: (runId, threadId) => {
      sessionIdMap.set(runId, threadId);
    },
    defaultModel: config.defaultModel,
  });

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

  /** Read the installed Codex CLI version (e.g. "0.146.0" from "codex-cli 0.146.0"). */
  function getCodexVersion(): Promise<string | null> {
    codexVersionPromise ??= (async () => {
      try {
        const { stdout } = await runCodexCli(["--version"], 8000);
        const match = stdout.trim().match(/(\d+\.\d+\.\d+[^\s]*)/);
        return match ? match[1] : stdout.trim() || null;
      } catch {
        return null;
      }
    })();
    return codexVersionPromise;
  }

  function ensureCompatibleCodexVersion(): Promise<void> {
    codexCompatibilityPromise ??= (async () => {
      const version = await getCodexVersion();
      if (!version) {
        logWarn(
          "Could not determine the Codex CLI version; app-server compatibility is unverified.",
        );
        return;
      }

      const minimumComparison = compareCodexVersions(
        version,
        CODEX_MIN_CLI_VERSION,
      );
      if (minimumComparison !== null && minimumComparison < 0) {
        throw new Error(
          `Codex CLI ${version} is not supported. Mains requires ${CODEX_MIN_CLI_VERSION} or newer.`,
        );
      }

      const schemaComparison = compareCodexVersions(
        version,
        CODEX_APP_SERVER_PROTOCOL_VERSION,
      );
      if (schemaComparison !== null && schemaComparison > 0) {
        logWarn(
          `Codex CLI ${version} is newer than Mains' tested app-server schema ${CODEX_APP_SERVER_PROTOCOL_VERSION}; continuing in forward-compatible mode.`,
        );
      }
    })();
    return codexCompatibilityPromise;
  }

  async function getCodexCliHealth(): Promise<
    NonNullable<AccountInfo["cli"]>
  > {
    const version = await getCodexVersion();
    const minimumComparison = version
      ? compareCodexVersions(version, CODEX_MIN_CLI_VERSION)
      : null;
    const schemaComparison = version
      ? compareCodexVersions(version, CODEX_APP_SERVER_PROTOCOL_VERSION)
      : null;
    const compatibility =
      !version || minimumComparison === null || schemaComparison === null
        ? "unknown"
        : minimumComparison < 0
          ? "unsupported"
          : schemaComparison > 0
            ? "newer"
            : "supported";
    return {
      version,
      channel: null,
      outdated: compatibility === "unsupported",
      compatibility,
      minimumVersion: CODEX_MIN_CLI_VERSION,
      testedProtocolVersion: CODEX_APP_SERVER_PROTOCOL_VERSION,
    };
  }

  function requestThreadId(params: unknown): string | undefined {
    const p = params as Record<string, unknown> | undefined;
    return (p?.threadId ?? p?.thread_id) as string | undefined;
  }

  function runIdForLiveThread(
    method: string,
    params: unknown,
  ): string | undefined {
    const p = params as Record<string, unknown> | undefined;
    const thread = p?.thread as Record<string, unknown> | undefined;
    const directThreadId =
      requestThreadId(params) ??
      (thread?.id as string | undefined);
    const parentThreadId = thread?.parentThreadId as string | null | undefined;

    for (const runId of runSinks.keys()) {
      const state = activeRuns.get(runId);
      if (!state) continue;
      if (
        directThreadId &&
        (state.threadId === directThreadId ||
          state.subAgents.has(directThreadId))
      ) {
        return runId;
      }
      if (
        method === "thread/started" &&
        parentThreadId &&
        (state.threadId === parentThreadId ||
          state.subAgents.has(parentThreadId))
      ) {
        return runId;
      }
    }

    // Global requests without thread context are unambiguous only while one
    // run is live. Thread-scoped approvals always take the branch above.
    if (!directThreadId && runSinks.size === 1) {
      return runSinks.keys().next().value as string | undefined;
    }
    return undefined;
  }

  function rejectInactiveServerRequest(
    server: CodexAppServer,
    id: number | string,
    method: string,
  ): void {
    switch (method) {
      case "item/commandExecution/requestApproval":
      case "item/fileChange/requestApproval":
        server.respondToRequest(id, { decision: "decline" });
        return;
      case "item/permissions/requestApproval":
        server.respondToRequest(id, { permissions: {}, scope: "turn" });
        return;
      case "item/tool/requestUserInput":
        server.respondToRequest(id, { answers: {} });
        return;
      case "mcpServer/elicitation/request":
        server.respondToRequest(id, {
          action: "cancel",
          content: null,
          _meta: null,
        });
        return;
      case "currentTime/read":
        server.respondToRequest(id, {
          currentTimeAt: Math.floor(Date.now() / 1000),
        });
        return;
      case "account/chatgptAuthTokens/refresh":
        server.respondToRequestError(
          id,
          -32601,
          "Client does not manage ChatGPT tokens; use auth.json fallback",
        );
        return;
      default:
        server.respondToRequestError(
          id,
          -32601,
          `No active run for server request: ${method}`,
        );
    }
  }

  function installRunDispatcher(server: CodexAppServer): void {
    server.setNotificationHandler((method, params) => {
      if (method === "serverRequest/resolved") {
        const requestId = (
          params as Record<string, unknown> | undefined
        )?.requestId;
        if (
          typeof requestId === "string" ||
          typeof requestId === "number"
        ) {
          cancelPendingRequest(String(requestId));
          serverRequestOwners.delete(String(requestId));
        }
      }

      const runId = runIdForLiveThread(method, params);
      if (!runId) return;
      const sink = runSinks.get(runId);
      if (!sink) return;

      sink.notificationQueue = sink.notificationQueue
        .then(() => sink.handleNotification(method, params))
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          logError(`Notification handler failed for ${runId}:`, message);
          sink.finalize({
            status: "failed",
            error: `Codex event handling failed: ${message}`,
          });
        });
    });

    server.setServerRequestHandler((id, method, params) => {
      const runId = runIdForLiveThread(method, params);
      const sink = runId ? runSinks.get(runId) : undefined;
      if (!runId || !sink) {
        rejectInactiveServerRequest(server, id, method);
        return;
      }

      serverRequestOwners.set(String(id), runId);
      void sink.handleServerRequest(id, method, params).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        logError(`Server request handler failed for ${runId}:`, message);
        server.respondToRequestError(id, -32603, message);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Ensure app-server is running
  // ─────────────────────────────────────────────────────────────

  async function startServer(cwd?: string): Promise<CodexAppServer> {
    const binaryPath = findCodexBinary();
    const spawnCwd = cwd ?? os.homedir();
    logInfo(`Starting app-server: ${binaryPath} app-server (cwd: ${spawnCwd}, HOME=${process.env.HOME}, homedir=${os.homedir()})`);

    const server = new CodexAppServer(codexLogger);
    const env = buildCodexEnv(binaryPath);

    await server.start(binaryPath, spawnCwd, env);
    appServer = server;
    installRunDispatcher(server);

    server.setOnClose(() => {
      if (appServer === server) {
        appServer = null;
      }
      capabilities.onServerClosed();
      for (const sink of [...runSinks.values()]) {
        sink.finalize({
          status: "failed",
          error: "Codex app-server exited unexpectedly",
        });
      }
    });

    // Handshake: initialize → initialized (required before any other RPC)
    const initializeResponse = await server.sendRequest("initialize", {
      clientInfo: {
        name: "mains",
        title: "Mains Desktop",
        version: app.getVersion(),
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
      },
    });
    if (
      typeof initializeResponse.userAgent !== "string" ||
      typeof initializeResponse.codexHome !== "string" ||
      typeof initializeResponse.platformFamily !== "string" ||
      typeof initializeResponse.platformOs !== "string"
    ) {
      throw new Error(
        `Codex app-server initialize response is incompatible with protocol ${CODEX_APP_SERVER_PROTOCOL_VERSION}`,
      );
    }
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

    logInfo("App-server initialized successfully");
    return server;
  }

  async function ensureServer(cwd?: string): Promise<CodexAppServer> {
    if (appServer?.isRunning) return appServer;
    if (appServerStartPromise) return appServerStartPromise;

    const startPromise = ensureCompatibleCodexVersion().then(() =>
      startServer(cwd),
    );
    appServerStartPromise = startPromise;
    try {
      return await startPromise;
    } catch (error) {
      const failedServer = appServer;
      if (failedServer) {
        await failedServer.stop().catch(() => undefined);
        if (appServer === failedServer) {
          appServer = null;
        }
      }
      throw error;
    } finally {
      if (appServerStartPromise === startPromise) {
        appServerStartPromise = null;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Input building
  // ─────────────────────────────────────────────────────────────

  type TurnInput = CodexAppServerParams<"turn/start">["input"];

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
  ): Promise<TurnCompletion> {
    return new Promise((resolve) => {
      let resolved = false;

      const finalize = (result: TurnCompletion) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutTimer);
        if (runSinks.get(runId) === sink) {
          runSinks.delete(runId);
        }
        for (const [requestId, ownerRunId] of serverRequestOwners) {
          if (ownerRunId === runId) {
            serverRequestOwners.delete(requestId);
          }
        }
        cancelPendingRequests(runId);
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
          await eventMapper.maybeResolveCollabSubAgents(
            server,
            params,
            runId,
          );
        }

        const mappedEvents = eventMapper.mapNotification(
          method,
          params,
          runId,
          model,
        );
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
            method === "item/fileChange/requestApproval"
          ) {
            server.respondToRequest(id, { decision: "decline" });
            return;
          }
          if (method === "item/permissions/requestApproval") {
            server.respondToRequest(id, { permissions: {}, scope: "turn" });
            return;
          }
          if (method === "item/tool/requestUserInput") {
            // Empty answers map matches the timeout/fallback shape codex expects.
            server.respondToRequest(id, { answers: {} });
            return;
          }
          if (method === "mcpServer/elicitation/request") {
            server.respondToRequest(id, {
              action: "cancel",
              content: null,
              _meta: null,
            });
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
            const networkApprovalContext = p?.networkApprovalContext as
              | { host?: string; protocol?: string }
              | null
              | undefined;
            const displayCommand =
              command ||
              (
                networkApprovalContext?.host
                  ? `Network access: ${networkApprovalContext.protocol ?? "https"}://${networkApprovalContext.host}`
                  : "Command approval"
              );

            // Dependency guard check — intercept install commands before approval
            const guardResult = command
              ? await guardsService.checkCommand(command)
              : { blocked: false };
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
                  command: displayCommand,
                  ...(cwd ? { cwd } : {}),
                  ...(reason ? { description: reason } : {}),
                  ...(networkApprovalContext
                    ? { networkApprovalContext }
                    : {}),
                  ...(p?.commandActions
                    ? { commandActions: p.commandActions }
                    : {}),
                  ...(p?.proposedExecpolicyAmendment
                    ? {
                        proposedExecpolicyAmendment:
                          p.proposedExecpolicyAmendment,
                      }
                    : {}),
                  ...(p?.proposedNetworkPolicyAmendments
                    ? {
                        proposedNetworkPolicyAmendments:
                          p.proposedNetworkPolicyAmendments,
                      }
                    : {}),
                  ...(p?.environmentId
                    ? { environmentId: p.environmentId }
                    : {}),
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
          // with optional choices). The approval dialog only renders ONE
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
            const autoResolutionMs =
              typeof p?.autoResolutionMs === "number"
                ? p.autoResolutionMs
                : undefined;

            for (let i = 0; i < questions.length; i++) {
              const q = questions[i];
              const qId = (q.id as string) ?? (q.questionId as string);
              if (!qId) continue;

              if (aborted) {
                answers[qId] = { answers: [] };
                continue;
              }

              const text =
                (q.question as string) ??
                (q.text as string) ??
                (q.description as string) ??
                "";
              const opts = normalizeOptions(q);
              try {
                const result = await requestToolApproval({
                  // Synthetic per-question requestId so each dialog has a
                  // unique broker key while still sharing the codex JSON-RPC id.
                  requestId: questions.length === 1 ? String(id) : `${id}-q${i}`,
                  runId,
                  toolName: "UserInput",
                  kind: "ask_user",
                  header: (q.header as string) || undefined,
                  question: text,
                  options: opts,
                  multiSelect: false,
                  isOther: q.isOther === true,
                  isSecret: q.isSecret === true,
                  autoResolutionMs,
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

          case "currentTime/read": {
            server.respondToRequest(id, {
              currentTimeAt: Math.floor(Date.now() / 1000),
            });
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
            const requestedSchema = p?.requestedSchema as
              | Record<string, unknown>
              | undefined;
            const requiredFields = Array.isArray(requestedSchema?.required)
              ? requestedSchema.required.filter(
                  (field): field is string => typeof field === "string",
                )
              : [];
            const canAcceptWithoutFormValues =
              mode === "url" || requiredFields.length === 0;

            // "Allow for this run" for a form-mode app approval: skip the dialog
            // if the user already opted this server in for the run. url-mode
            // needs a browser round-trip each time, so it's never auto-accepted.
            if (
              mode !== "url" &&
              activeRuns.get(runId)?.approvedElicitationServers?.has(sessionKey)
            ) {
              server.respondToRequest(id, canAcceptWithoutFormValues
                ? { action: "accept", content: {}, _meta: null }
                : { action: "decline", content: null, _meta: null });
              break;
            }

            logInfo(
              `[mcpServer/elicitation/request] server=${serverName}, mode=${mode}`,
            );

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
                server.respondToRequest(id, {
                  action: "decline",
                  content: null,
                  _meta: null,
                });
              } else if (!canAcceptWithoutFormValues) {
                // The current approval UI can consent to an action but cannot
                // collect schema-defined form values. Never claim acceptance
                // with an invalid empty object when required fields exist.
                server.respondToRequest(id, {
                  action: "decline",
                  content: null,
                  _meta: null,
                });
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
                server.respondToRequest(id, {
                  action: "accept",
                  content: mode === "url" ? null : {},
                  _meta: null,
                });
              }
            } catch {
              server.respondToRequest(id, {
                action: "decline",
                content: null,
                _meta: null,
              });
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

      const sink: CodexRunSink = {
        handleNotification,
        handleServerRequest,
        notificationQueue: Promise.resolve(),
        finalize,
      };
      const previous = runSinks.get(runId);
      if (previous) {
        previous.finalize({
          status: "failed",
          error: "A newer Codex turn replaced this run",
        });
      }
      runSinks.set(runId, sink);
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
      const threadStartParams: CodexThreadStartParams = {
        cwd: request.workspace.rootPath,
        approvalPolicy,
        sandbox,
        personality,
        ...(resolvedModel ? { model: resolvedModel } : {}),
        config: buildCodexConfigOverrides(networkAccess),
        dynamicTools: MAINS_DYNAMIC_TOOLS,
      };

      logInfo(`Starting thread (model: ${resolvedModel || "default"}, cwd: ${request.workspace.rootPath})`);
      const threadResult = await server.sendRequest(
        "thread/start",
        threadStartParams,
      );
      const threadId = threadResult.thread.id;

      if (threadId) sessionIdMap.set(runId, threadId);

      // Goal mode: register the prompt as the thread's goal so Codex tracks
      // token/time usage against it and reports completion ("Goal achieved").
      // Best-effort — older Codex builds without `thread/goal/*` shouldn't fail
      // the run. The goal stays active across follow-up turns until cleared.
      const goalMode = overrideGoalMode ?? config.goalMode ?? false;
      await maybeSetThreadGoal(server, threadId, goalMode, request.goal, request.workspace.rootPath, /*overwrite*/ true);

      const mainsCtx: MainsToolContext = { workspaceId: request.workspace.id, rootPath: request.workspace.rootPath, runId };
      activeRuns.set(
        runId,
        createActiveRunState(threadId ?? null, mainsCtx),
      );

      const turnInput = buildTurnInput(request);
      const effort = overrideEffort ?? config.modelReasoningEffort;
      const serviceTier = overrideServiceTier ?? config.serviceTier;
      const planEnabled = overridePlanMode ?? config.planMode ?? false;
      const collaborationMode = buildCollaborationMode(planEnabled, resolvedModel, effort);
      const turnStartParams: CodexTurnStartParams = {
        threadId: threadId ?? "",
        input: turnInput,
        ...(resolvedModel ? { model: resolvedModel } : {}),
        ...(effort ? { effort } : {}),
        ...(serviceTier ? { serviceTier } : {}),
        ...(outputSchema ? { outputSchema } : {}),
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
          const fallbackStartParams: CodexThreadStartParams = {
            cwd: request.workspace.rootPath,
            approvalPolicy,
            sandbox,
            personality,
            ...(resolvedModel ? { model: resolvedModel } : {}),
            config: buildCodexConfigOverrides(networkAccess),
            dynamicTools: MAINS_DYNAMIC_TOOLS,
          };
          const threadResult = await server.sendRequest(
            "thread/start",
            fallbackStartParams,
          );
          const newThreadId = threadResult.thread.id;
          sessionIdMap.set(runId, newThreadId);
          threadId = newThreadId;
        } else {
          throw resumeError;
        }
      }

      const mainsCtxContinue: MainsToolContext = { workspaceId: request.workspace.id, rootPath: request.workspace.rootPath, runId };
      activeRuns.set(
        runId,
        createActiveRunState(threadId, mainsCtxContinue),
      );

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
      const turnStartParams: CodexTurnStartParams = {
        threadId: currentThreadId,
        input: turnInput,
        ...(resolvedModel ? { model: resolvedModel } : {}),
        ...(config.modelReasoningEffort ? { effort: config.modelReasoningEffort } : {}),
        ...(config.serviceTier ? { serviceTier: config.serviceTier } : {}),
        ...(continueOutputSchema ? { outputSchema: continueOutputSchema } : {}),
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
      const networkAccess = config.networkAccessEnabled !== false;

      const forkResult = await server.sendRequest("thread/fork", {
        threadId: sourceThreadId,
        cwd: request.workspace.rootPath,
        approvalPolicy,
        sandbox,
        ...(resolvedModel ? { model: resolvedModel } : {}),
        config: buildCodexConfigOverrides(networkAccess),
      });

      const forkedThreadId = forkResult.thread.id;

      sessionIdMap.set(runId, forkedThreadId);

      // Goal mode on a fork: the fork inherits the source thread's goal, so
      // only set one if there's none in progress (mirrors continue).
      await maybeSetThreadGoal(server, forkedThreadId, config.goalMode ?? false, message, request.workspace.rootPath, /*overwrite*/ false);

      const mainsCtxFork: MainsToolContext = { workspaceId: request.workspace.id, rootPath: request.workspace.rootPath, runId };
      activeRuns.set(
        runId,
        createActiveRunState(forkedThreadId, mainsCtxFork),
      );

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
      const turnStartParams: CodexTurnStartParams = {
        threadId: forkedThreadId,
        input: turnInput,
        ...(resolvedModel ? { model: resolvedModel } : {}),
        ...(config.modelReasoningEffort ? { effort: config.modelReasoningEffort } : {}),
        ...(config.serviceTier ? { serviceTier: config.serviceTier } : {}),
        ...(forkOutputSchema ? { outputSchema: forkOutputSchema } : {}),
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
      const target = buildCodexReviewTarget(request.target);
      const resolvedModel = request.model || config.defaultModel || undefined;
      const timeout = config.timeout ?? 3_600_000;

      const server = await ensureServer();

      const approvalPolicy = config.approvalMode ?? "on-request";
      const sandbox = mapSandboxMode(config.sandboxMode);
      const personality = config.personality ?? "none";

      const networkAccess = config.networkAccessEnabled !== false;
      const threadStartParams: CodexThreadStartParams = {
        cwd: request.workspace.rootPath,
        approvalPolicy,
        sandbox,
        personality,
        ...(resolvedModel ? { model: resolvedModel } : {}),
        config: buildCodexConfigOverrides(networkAccess),
        dynamicTools: MAINS_DYNAMIC_TOOLS,
      };

      logInfo(`Starting review thread (model: ${resolvedModel || "default"}, cwd: ${request.workspace.rootPath})`);
      const threadResult = await server.sendRequest(
        "thread/start",
        threadStartParams,
      );
      const threadId = threadResult.thread.id;

      if (threadId) sessionIdMap.set(runId, threadId);

      const mainsCtxReview: MainsToolContext = { workspaceId: request.workspace.id, rootPath: request.workspace.rootPath, runId };
      activeRuns.set(
        runId,
        createActiveRunState(threadId ?? null, mainsCtxReview),
      );

      const reviewStartParams: CodexAppServerParams<"review/start"> = {
        threadId,
        target,
        ...(request.delivery ? { delivery: request.delivery } : {}),
      };

      const startTurn = async () => {
        logInfo(`Starting review: target=${request.target.type}, delivery=${request.delivery ?? "inline"}`);
        const result = await server.sendRequest(
          "review/start",
          reviewStartParams,
        );
        const reviewThreadId = result.reviewThreadId;

        sessionIdMap.set(runId, reviewThreadId);
        const state = activeRuns.get(runId);
        if (state) {
          state.subscribedThreadIds.add(reviewThreadId);
          state.threadId = reviewThreadId;
          state.turnId = result.turn.id;
        }
        if (reviewThreadId !== threadId) {
          runsRepo.updateRun(runId, { sessionId: reviewThreadId }).catch((error) =>
            logWarn(
                "Failed to persist detached review thread:",
                error instanceof Error ? error.message : error,
              ),
          );
        }
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

        // Register the thread-aware sink before starting the turn. App-server
        // is allowed to emit notifications immediately after its response.
        const completion = waitForTurnCompletion(
          appServer,
          cs.runId,
          cs.model,
          onEvent,
          cs.timeout,
        );
        try {
          await cs.startTurn();
        } catch (error) {
          runSinks.get(cs.runId)?.finalize({
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
          await completion;
          throw error;
        }
        const result = await completion;

        return {
          status: result.status,
          summary: result.error,
          usage: eventMapper.flushUsage(cs.runId),
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logError("executePrompt failed:", msg);
        eventMapper.flushUsage(cs.runId);
        return { status: "failed", summary: msg };
      } finally {
        signal.removeEventListener("abort", onAbort);
      }
    },

    async cleanup(sessionParam): Promise<void> {
      const cs = sessionParam as CodexSession;
      const state = activeRuns.get(cs.runId);
      if (appServer?.isRunning && state) {
        for (const threadId of state.subscribedThreadIds) {
          try {
            await appServer.sendRequest("thread/unsubscribe", { threadId });
          } catch (error) {
            logWarn(
              `Failed to unsubscribe Codex thread ${threadId}:`,
              error instanceof Error ? error.message : error,
            );
          }
        }
      }
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
      eventMapper.discardRun(runId);
    },

    async shutdown(): Promise<void> {
      // Abort all active runs
      for (const [runId, state] of activeRuns) {
        state.aborted = true;
        cancelPendingRequests(runId);
      }
      activeRuns.clear();
      sessionIdMap.clear();
      eventMapper.clear();
      for (const sink of [...runSinks.values()]) {
        sink.finalize({
          status: "canceled",
          error: "Codex driver is shutting down",
        });
      }
      runSinks.clear();
      serverRequestOwners.clear();
      capabilities.shutdown();

      if (appServer) {
        await appServer.stop();
        appServer = null;
      }

      logInfo("Shutdown complete");
    },

    listModels: capabilities.listModels,

    getAccountInfo: capabilities.getAccountInfo,

    async updateCli(): Promise<CliUpdateResult> {
      const { stdout, stderr, code } = await runCodexCli(["update"], 120000);
      return { success: code === 0, output: `${stdout}${stderr}`.trim() };
    },

    getRateLimits: capabilities.getRateLimits,

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
        const goalParams: CodexAppServerParams<"thread/goal/set"> = {
          threadId,
          ...(params.objective !== undefined ? { objective: params.objective } : {}),
          ...(params.status !== undefined
            ? { status: params.status as CodexGoalStatus }
            : {}),
          ...(params.tokenBudget !== undefined ? { tokenBudget: params.tokenBudget } : {}),
        };
        const result = await server.sendRequest(
          "thread/goal/set",
          goalParams,
        );
        const goal = mapGoalSnapshot(
          result.goal as unknown as Record<string, unknown>,
        );
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
        const result = await appServer.sendRequest("thread/goal/get", {
          threadId,
        });
        return mapGoalSnapshot(
          result.goal as unknown as Record<string, unknown> | undefined,
        );
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
        const result = await server.sendRequest("thread/goal/clear", {
          threadId,
        });
        const cleared = result.cleared;
        if (cleared) broadcastGoal(PROVIDER_IDS.codex, runId, null);
        return cleared;
      } catch (error) {
        logError("clearGoal failed:", error);
        return false;
      }
    },

    listSkills: capabilities.listSkills,

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

    listPlugins: capabilities.listPlugins,
    listInstalledPlugins: capabilities.listInstalledPlugins,
    readPlugin: capabilities.readPlugin,
    installPlugin: capabilities.installPlugin,
    uninstallPlugin: capabilities.uninstallPlugin,
    setPluginEnabled: capabilities.setPluginEnabled,
  };
}
