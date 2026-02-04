// ─────────────────────────────────────────────────────────────
// Claude Agent SDK Adapter
// Implements WorkRunAdapter using Claude Agent SDK (stable API)
// ─────────────────────────────────────────────────────────────

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
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

interface SDKModelInfo {
  value: string;
  displayName: string;
  description: string;
}

interface SDKQuery extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  rewindFiles(userMessageUuid: string): Promise<void>;
  setPermissionMode(mode: string): Promise<void>;
  setModel(model?: string): Promise<void>;
  setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
  supportedCommands(): Promise<unknown[]>;
  supportedModels(): Promise<SDKModelInfo[]>;
  mcpServerStatus(): Promise<unknown[]>;
  accountInfo(): Promise<{ email?: string; organization?: string }>;
}

// Active run tracking for abort support
const activeRuns = new Map<
  string,
  { abortController: AbortController; aborted: boolean; sessionId?: string; query?: SDKQuery }
>();

// Session ID tracking for resume capability
const sessionIdMap = new Map<string, string>();

// Cached CLI path
let cachedCliPath: string | null = null;

// Cached models list (with TTL)
let cachedModels: ModelInfo[] | null = null;
let cachedModelsTimestamp = 0;
const MODELS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────
// Debug logging (configured per-adapter instance, but binary
// discovery runs before adapter creation so we use module-level)
// Can be enabled via CLAUDE_ADAPTER_DEBUG=1 environment variable
// ─────────────────────────────────────────────────────────────
let debugEnabled = process.env.CLAUDE_ADAPTER_DEBUG === "1";

function logDebug(...args: unknown[]): void {
  if (debugEnabled) console.log("[ClaudeAdapter]", ...args);
}

function logInfo(...args: unknown[]): void {
  console.log("[ClaudeAdapter]", ...args);
}

function logWarn(...args: unknown[]): void {
  console.warn("[ClaudeAdapter]", ...args);
}

function logError(...args: unknown[]): void {
  console.error("[ClaudeAdapter]", ...args);
}

// ─────────────────────────────────────────────────────────────
// CLI Binary Discovery Helpers
// ─────────────────────────────────────────────────────────────

const isWindows = process.platform === "win32";

/**
 * Check if a path points to an executable file (NOT a directory)
 */
function isExecutableFile(p: string): boolean {
  try {
    if (!fs.existsSync(p)) return false;
    const stat = fs.statSync(p);

    // Explicitly reject directories - this is critical
    if (stat.isDirectory()) {
      logDebug("Rejected directory (not a file):", p);
      return false;
    }

    if (!stat.isFile()) {
      logDebug("Rejected non-file:", p);
      return false;
    }

    if (isWindows) {
      // On Windows, check for common executable extensions or trust existence
      const ext = path.extname(p).toLowerCase();
      return ext === ".exe" || ext === ".cmd" || ext === ".bat" || ext === "";
    } else {
      // On Unix, check execute permission
      try {
        fs.accessSync(p, fs.constants.X_OK);
        return true;
      } catch {
        logDebug("No execute permission:", p);
        return false;
      }
    }
  } catch (e) {
    logDebug("Error checking executable:", p, e);
    return false;
  }
}

/**
 * Resolve a candidate path and validate it's an executable.
 * Important: Returns the ORIGINAL path (e.g., symlink) if valid, not the resolved path.
 * This is because the Claude SDK may expect paths ending in "claude".
 */
function resolveCandidate(p: string): string | null {
  try {
    if (!fs.existsSync(p)) {
      return null;
    }

    // Check if it's a symlink
    const lstat = fs.lstatSync(p);
    const isSymlink = lstat.isSymbolicLink();

    // Resolve symlinks to get the real path for validation
    const realPath = fs.realpathSync(p);

    if (isSymlink) {
      logDebug(`Symlink: ${p} -> ${realPath}`);
    }

    // Check the real path stat
    const stat = fs.statSync(realPath);
    logDebug(`Stat for ${realPath}: isFile=${stat.isFile()}, isDirectory=${stat.isDirectory()}`);

    // If the target is an executable file, return the ORIGINAL path
    // (preserves symlink paths like ~/.local/bin/claude which the SDK may expect)
    if (stat.isFile() && isExecutableFile(realPath)) {
      // Return the original path (symlink), not the resolved path
      // The SDK may validate that the path ends in "claude"
      logDebug(`Valid executable, returning original path: ${p}`);
      return p;
    }

    // Special case: if the resolved path is a directory, look inside for executable
    if (stat.isDirectory()) {
      logDebug(`Path resolved to directory, looking for executable inside: ${realPath}`);

      const executableCandidates = isWindows
        ? [
            path.join(realPath, "claude.exe"),
            path.join(realPath, "bin", "claude.exe"),
            path.join(realPath, "claude.cmd"),
            path.join(realPath, "bin", "claude.cmd"),
          ]
        : [
            path.join(realPath, "claude"),
            path.join(realPath, "bin", "claude"),
          ];

      for (const execPath of executableCandidates) {
        logDebug(`Checking for executable at: ${execPath}`);
        if (isExecutableFile(execPath)) {
          logDebug(`Found executable inside directory: ${execPath}`);
          return execPath;
        }
      }

      logDebug(`No executable found inside directory: ${realPath}`);
    }

    return null;
  } catch (e) {
    logDebug("Error in resolveCandidate:", p, e);
    return null;
  }
}

/**
 * Compare version strings for sorting (descending order)
 */
function compareVersionsDesc(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal !== bVal) return bVal - aVal; // Descending order
  }
  return 0;
}

/**
 * Clear the cached CLI path (useful for testing or after installation)
 */
export function clearClaudeCliCache(): void {
  cachedCliPath = null;
}

/**
 * Find the Claude CLI binary path
 * The SDK needs the path to the installed `claude` command
 * ALWAYS returns the full path to the executable file, never a directory
 */
function findClaudeBinary(): string | null {
  // Validate cached path is still valid and is an actual file (not directory)
  if (cachedCliPath) {
    try {
      const stat = fs.statSync(cachedCliPath);
      if (stat.isFile()) {
        logDebug("Using cached CLI path:", cachedCliPath);
        return cachedCliPath;
      } else {
        logWarn("Cached CLI path is not a file, clearing cache:", cachedCliPath);
        cachedCliPath = null;
      }
    } catch {
      logDebug("Cached CLI path no longer exists, clearing cache:", cachedCliPath);
      cachedCliPath = null;
    }
  }

  logDebug("Starting Claude CLI discovery...");
  const homeDir = os.homedir();

  // ─────────────────────────────────────────────────────────────
  // 1. Check Anthropic installer's versioned directory first
  // ─────────────────────────────────────────────────────────────
  const versionsDir = path.join(homeDir, ".local", "share", "claude", "versions");
  logDebug("Checking versions directory:", versionsDir);
  try {
    if (fs.existsSync(versionsDir)) {
      const versions = fs.readdirSync(versionsDir).filter((v) => {
        // Filter to only version-like directories
        return /^\d+/.test(v);
      });
      logDebug("Found versions:", versions);

      if (versions.length > 0) {
        const sortedVersions = versions.sort(compareVersionsDesc);

        for (const version of sortedVersions) {
          const versionDir = path.join(versionsDir, version);

          // Check candidate executable paths within the version directory
          const candidates = isWindows
            ? [
                path.join(versionDir, "claude.exe"),
                path.join(versionDir, "bin", "claude.exe"),
                path.join(versionDir, "claude.cmd"),
                path.join(versionDir, "bin", "claude.cmd"),
              ]
            : [
                path.join(versionDir, "claude"),
                path.join(versionDir, "bin", "claude"),
              ];

          for (const candidate of candidates) {
            logDebug("Checking candidate:", candidate);
            const resolved = resolveCandidate(candidate);
            if (resolved) {
              logInfo("Found Claude CLI version:", version, "at:", resolved);
              cachedCliPath = resolved;
              return resolved;
            }
          }
        }
      }
    } else {
      logDebug("Versions directory does not exist");
    }
  } catch (e) {
    logDebug("Error checking versions dir:", e);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Check common fixed installation paths
  // ─────────────────────────────────────────────────────────────
  const commonPaths: string[] = [];

  if (isWindows) {
    const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
    const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";

    commonPaths.push(
      path.join(localAppData, "Programs", "Claude", "claude.exe"),
      path.join(localAppData, "Programs", "Claude", "bin", "claude.exe"),
      path.join(programFiles, "Claude", "claude.exe"),
      path.join(programFiles, "Claude", "bin", "claude.exe"),
      path.join(homeDir, ".local", "bin", "claude.exe"),
      path.join(homeDir, ".npm-global", "bin", "claude.cmd"),
    );
  } else {
    commonPaths.push(
      // User's local bin (common for npm global installs and Anthropic installer)
      path.join(homeDir, ".local", "bin", "claude"),
      // macOS Homebrew
      "/opt/homebrew/bin/claude",
      "/usr/local/bin/claude",
      // Linux
      "/usr/bin/claude",
      // npm global (varies by system)
      path.join(homeDir, ".npm-global", "bin", "claude"),
    );
  }

  for (const binPath of commonPaths) {
    logDebug("Checking common path:", binPath);
    const resolved = resolveCandidate(binPath);
    if (resolved) {
      logInfo("Found Claude CLI at:", binPath, "->", resolved);
      cachedCliPath = resolved;
      return resolved;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 3. PATH fallback: use which/where command
  // ─────────────────────────────────────────────────────────────
  logDebug("Checking PATH using", isWindows ? "where" : "which");
  try {
    const cmd = isWindows ? "where" : "which";
    const result = execFileSync(cmd, ["claude"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Take the first non-empty line
    const lines = result.split(/\r?\n/).filter((line) => line.trim().length > 0);
    logDebug("PATH lookup returned:", lines);
    if (lines.length > 0) {
      const resolved = resolveCandidate(lines[0].trim());
      if (resolved) {
        logInfo("Found Claude CLI in PATH:", resolved);
        cachedCliPath = resolved;
        return resolved;
      }
    }
  } catch (e) {
    // which/where failed or not found in PATH
    logDebug("Claude CLI not found in PATH:", e);
  }

  logWarn("Claude CLI not found in any known location");
  return null;
}

/**
 * Creates a Claude Agent SDK adapter instance
 */
export function createClaudeAdapter(
  config: ClaudeCodeAdapterConfig,
): WorkRunAdapter {
  // Enable debug logging if configured
  debugEnabled = !!(config as any).debug;

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
        logDebug("SDK not found");
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
      logInfo("SDK loaded successfully (stable API)");
    } catch (error) {
      loadError = error instanceof Error ? error : new Error(String(error));
      logError("Failed to load SDK:", loadError.message);
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
   * When using CLI (subscription mode), we strip ANTHROPIC_API_KEY from env
   * to avoid unexpected API billing when user has CLI login session.
   */
  function buildOptions(
    model: string,
    workspacePath?: string,
    abortController?: AbortController,
    resumeSessionId?: string,
  ): SDKOptions {
    // Find the Claude CLI binary
    let binaryPath: string | null = null;

    // If config.binary is set, validate it's an actual executable file
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

    // Fall back to auto-discovery if no valid config.binary
    if (!binaryPath) {
      binaryPath = findClaudeBinary();
    }

    if (!binaryPath) {
      throw new Error(
        "Claude CLI not found. Please install Claude Code and run `claude login` to authenticate, " +
          "or ensure the CLI is in your PATH. You can also set config.binary to the full path of the claude executable.",
      );
    }

    // Final validation: ensure the path (or its symlink target) is not a directory
    try {
      // Use stat (not lstat) to follow symlinks
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
      // Re-throw validation errors
      if (e instanceof Error && e.message.includes("directory")) {
        throw e;
      }
      logDebug("Error validating binary path:", e);
    }

    logInfo("Using Claude CLI at:", binaryPath);

    // Build environment: strip API key/auth token when using CLI (subscription mode)
    // This ensures the subprocess uses CLI login session rather than API billing
    const cleanEnv: Record<string, string | undefined> = { ...process.env };
    delete cleanEnv.ANTHROPIC_API_KEY;
    delete cleanEnv.ANTHROPIC_AUTH_TOKEN;

    // Determine permission mode: use config override if provided, else default to acceptEdits
    const permissionMode = (config as any).permissionMode || "acceptEdits";

    const options: SDKOptions = {
      model,
      permissionMode,
      abortController,
      pathToClaudeCodeExecutable: binaryPath,
      env: cleanEnv,
    };

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
              // Emit text as log (not artifact to avoid duplicates)
              events.push({
                type: "log",
                message: block.text,
                level: "info",
                ts,
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
        // Final result - only emit if there's an actual result message or error
        const resultMsg = msg as SDKResultMessage;
        if (resultMsg.result && resultMsg.result.trim().length > 0) {
          // Only emit non-empty results
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

        const prompt = buildPrompt(request);

        await onEvent({
          type: "log",
          message: `Sending prompt to Claude (${prompt.length} chars)`,
          level: "info",
          ts: Date.now(),
        });

        // Create the query
        const query = queryFn({ prompt, options });

        // Store query in activeRuns for abort/interrupt support
        activeRuns.set(runId, { abortController, aborted: false, query });

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
                  activeRuns.set(runId, { ...state, sessionId, query });
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

        // Store query in activeRuns for abort/interrupt support
        activeRuns.set(runId, { abortController, aborted: false, sessionId, query });

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
          logError("Error aborting run:", err);
        }
        // Call query.interrupt() if available
        if (runState.query?.interrupt) {
          try {
            await runState.query.interrupt();
          } catch (err) {
            logDebug("Error calling query.interrupt():", err);
          }
        }
        activeRuns.delete(runId);
      }

      logDebug(`Deleted session tracking for run: ${runId}`);
    },

    async abortRun(runId: string): Promise<void> {
      const runState = activeRuns.get(runId);
      if (runState) {
        runState.aborted = true;
        try {
          runState.abortController.abort();
        } catch (err) {
          logError("Error aborting controller:", err);
        }
        // Call query.interrupt() if available
        if (runState.query?.interrupt) {
          try {
            await runState.query.interrupt();
          } catch (err) {
            logDebug("Error calling query.interrupt():", err);
          }
        }
      }
    },

    async shutdown(): Promise<void> {
      // Mark all runs as aborted and interrupt queries
      const interruptPromises: Promise<void>[] = [];

      for (const [, state] of activeRuns) {
        state.aborted = true;
        try {
          state.abortController.abort();
        } catch {
          // Ignore abort errors
        }
        // Collect interrupt promises
        if (state.query?.interrupt) {
          interruptPromises.push(
            state.query.interrupt().catch((err) => {
              logDebug("Error during shutdown interrupt:", err);
            }),
          );
        }
      }

      // Wait for all interrupts with a timeout
      if (interruptPromises.length > 0) {
        await Promise.race([
          Promise.all(interruptPromises),
          new Promise((resolve) => setTimeout(resolve, 2000)), // 2s timeout
        ]);
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

      // Clear models cache
      cachedModels = null;
      cachedModelsTimestamp = 0;

      logInfo("Shutdown complete");
    },

    async listModels(): Promise<ModelInfo[]> {
      // Check cache first
      const now = Date.now();
      if (cachedModels && now - cachedModelsTimestamp < MODELS_CACHE_TTL_MS) {
        logDebug("Returning cached models");
        return cachedModels;
      }

      try {
        await ensureSDK();

        if (!queryFn) {
          logWarn("SDK not available, returning fallback models");
          return getDefaultModels(config.defaultModel);
        }

        // Find CLI binary using same logic as buildOptions
        let binaryPath: string | null = null;
        if (config.binary) {
          const resolved = resolveCandidate(config.binary);
          if (resolved) {
            binaryPath = resolved;
          }
        }
        if (!binaryPath) {
          binaryPath = findClaudeBinary();
        }

        if (!binaryPath) {
          logWarn("CLI not found, returning fallback models");
          return getDefaultModels(config.defaultModel);
        }

        // Create a temporary query to fetch supported models
        const tempQuery = queryFn({
          prompt: "", // Empty prompt - we just need the query object
          options: {
            pathToClaudeCodeExecutable: binaryPath,
          },
        });

        // Fetch supported models from SDK
        const sdkModels = await tempQuery.supportedModels();
        logDebug("SDK returned models:", sdkModels);

        if (!sdkModels || sdkModels.length === 0) {
          logWarn("SDK returned no models, using fallback");
          return getDefaultModels(config.defaultModel);
        }

        // Map SDK models to our ModelInfo format
        const models: ModelInfo[] = sdkModels.map((sdkModel, index) => ({
          id: sdkModel.value,
          displayName: sdkModel.displayName,
          description: sdkModel.description,
          isDefault:
            sdkModel.value === config.defaultModel ||
            (!config.defaultModel && index === 0),
          capabilities: {
            streaming: true,
            vision: true,
            functionCalling: true,
            // Mark opus models as having reasoning capability
            reasoning: sdkModel.value.includes("opus"),
          },
          // Estimate context window based on model name
          contextWindow: sdkModel.value.includes("haiku") ? 128000 : 200000,
        }));

        // Cache the result
        cachedModels = models;
        cachedModelsTimestamp = now;

        return models;
      } catch (error) {
        logError("Failed to fetch models from SDK:", error);
        return getDefaultModels(config.defaultModel);
      }
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
      id: "claude-haiku-4-5",
      displayName: "Claude Haiku 4.5",
      isDefault: defaultModel === "claude-haiku-4-5" || !defaultModel,
      capabilities: {
        streaming: true,
        vision: true,
        functionCalling: true,
      },
      contextWindow: 128000,
    },

  ];

  return models;
}
