import { BrowserWindow, Notification, powerSaveBlocker } from "electron";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

import {
  couldModifyFiles,
  type WorkRunEvent,
} from "../providers/adapters";
import type { WorkRunUsage, StopReason } from "../../../shared/adapter.types";
import { runsRepo } from "./runs.repo";
import { providersRepo } from "../providers/providers.repo";
import { appSettingsRepo } from "../appSettings/appSettings.repo";
import { gitService } from "../git/git.service";
import { workspaceService, workspaceRepo, logWorkspaceActivity } from "../workspace";
import { createWorkAdapter } from "../providers/adapters";
import { runSessionRegistry } from "./run-session-registry";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const LIVE_DIFF_DEBOUNCE_MS = 300;
const FORCE_FINALIZE_TIMEOUT_MS = 30_000;
const MAX_UNTRACKED_INLINE_BYTES = 256 * 1024;

// ─────────────────────────────────────────────────────────────
// File-level utilities (pure)
// ─────────────────────────────────────────────────────────────

function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").substring(0, 16);
}

/**
 * Split a unified diff into per-file chunks and return filename → content hash.
 * Used to detect which files actually changed between two cumulative diffs
 * that share the same baseRef.
 */
function buildPerFileDiffHashes(diffText: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!diffText) return result;
  const chunks = diffText.split(/^(?=diff --git )/m);
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const match = chunk.match(/^diff --git a\/(.+?) b\/(.+)/);
    if (match) {
      const fileName = match[2];
      result.set(fileName, hashContent(chunk));
    }
  }
  return result;
}

/**
 * Merge untracked file stats into a git shortstat string.
 * git diff --shortstat only covers tracked files; new files are added here.
 */
function mergeUntrackedIntoShortstat(
  shortstat: string,
  newFileCount: number,
  newInsertions: number,
): string {
  if (newFileCount === 0 && newInsertions === 0) return shortstat;
  const existingFiles = parseInt(shortstat.match(/(\d+) file/)?.[1] ?? "0", 10);
  const existingInsertions = parseInt(shortstat.match(/(\d+) insertion/)?.[1] ?? "0", 10);
  const existingDeletions = parseInt(shortstat.match(/(\d+) deletion/)?.[1] ?? "0", 10);
  const totalFiles = existingFiles + newFileCount;
  const totalInsertions = existingInsertions + newInsertions;
  const parts: string[] = [];
  parts.push(`${totalFiles} file${totalFiles !== 1 ? "s" : ""} changed`);
  if (totalInsertions > 0) {
    parts.push(`${totalInsertions} insertion${totalInsertions !== 1 ? "s" : ""}(+)`);
  }
  if (existingDeletions > 0) {
    parts.push(`${existingDeletions} deletion${existingDeletions !== 1 ? "s" : ""}(-)`);
  }
  return parts.join(", ");
}

// Local broadcast helper. Extracted to runs.broadcasts.ts in a follow-up PR.
function broadcastToWindows(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

interface DiffSnapshot {
  baseRef: string;
  diffText: string;
  files: string[];
  untrackedFiles: string[];
  shortstat: string;
}

// ─────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────

export interface RunSessionContext {
  runId: string;
  accountId: string;
  providerId: string;
  workspace: { id: string; rootPath: string };
  initialPromptContent: string;
  /** Defaults to -1 (fresh run). continueRun passes the recovered max turn index. */
  seedTurnIndex?: number;
}

export interface RunSessionResult {
  status: "succeeded" | "failed" | "canceled";
  summary?: string;
  stopReason?: StopReason | null;
  usage?: WorkRunUsage;
}

export interface RunSession {
  readonly runId: string;

  /**
   * Project an adapter event onto run state.
   * No-op after finalize. Tolerates out-of-order events by logging + dropping.
   */
  project(event: WorkRunEvent): Promise<void>;

  /**
   * Signal the adapter to abort this run.
   * Idempotent — only the first call signals. Schedules a 30s force-finalize
   * timer in case the adapter does not wind down.
   * Cleanup happens in finalize, not here.
   */
  abort(): Promise<void>;

  /**
   * Update the session's internal baseRef. Called by the in-process commit tool
   * (`mains-tools.core` → CommitChanges) after a commit moves HEAD forward, so
   * subsequent live diffs and the final diff snapshot compare against the new
   * post-commit HEAD instead of the original baseRef captured at run start.
   *
   * No-op after finalize.
   */
  updateBaseRef(sha: string): void;

  /**
   * Single cleanup path for all terminal states. Idempotent.
   */
  finalize(result: RunSessionResult): Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────

export function createRunSession(ctx: RunSessionContext): RunSession {
  const { runId, accountId, providerId, workspace } = ctx;

  // ─── Lifecycle flags ───
  let finalized = false;
  let aborting = false;
  let forceFinalizeTimer: NodeJS.Timeout | null = null;

  // ─── Per-run state (was 8 module-scope Maps in runs.service.ts) ───
  let baseRef: string | null = null;
  let sleepBlockerId: number | null = null;
  let activeTurnId: number | null = null;
  let turnCounter: number = ctx.seedTurnIndex ?? -1;
  let liveDiffTimer: NodeJS.Timeout | null = null;
  let liveDiffInFlight = false;
  let liveDiffPending = false;
  const pendingToolCalls = new Map<string, number>();

  // ─── Broadcast helpers (channel names + payload shapes preserved exactly) ───
  function broadcastEventPersisted(): void {
    broadcastToWindows("runs:eventPersisted", { runId, ts: Date.now() });
  }
  function broadcastStatusChanged(status: string): void {
    broadcastToWindows("runs:statusChanged", { runId, status, ts: Date.now() });
  }
  function broadcastDiffUpdated(): void {
    broadcastToWindows("runs:diffUpdated", { runId, workspaceId: workspace.id, ts: Date.now() });
  }
  function broadcastEphemeralEvent(event: unknown): void {
    broadcastToWindows("runs:ephemeralEvent", { runId, event, ts: Date.now() });
  }

  // ─── OS notification ───
  async function sendNotification(status: string): Promise<void> {
    try {
      const settings = await appSettingsRepo.findById("default");
      if (!settings?.notifyOnRunComplete) return;
      const title = status === "succeeded" ? "Run Completed" : "Run Failed";
      const body = status === "succeeded" ? "Run finished successfully" : "Run failed";
      const notification = new Notification({ title, body });
      notification.on("click", () => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          const win = windows[0];
          if (win.isMinimized()) win.restore();
          win.focus();
        }
      });
      notification.show();
    } catch (err) {
      console.error(`[RunSession ${runId}] Failed to send notification:`, err);
    }
  }

  // ─── Sleep blocker ───
  async function acquireSleepBlocker(): Promise<void> {
    try {
      const settings = await appSettingsRepo.findById("default");
      if (!settings?.preventSleepDuringRuns) return;
      if (sleepBlockerId === null) {
        sleepBlockerId = powerSaveBlocker.start("prevent-app-suspension");
      }
    } catch (err) {
      console.error(`[RunSession ${runId}] Failed to acquire sleep blocker:`, err);
    }
  }
  function releaseSleepBlocker(): void {
    if (sleepBlockerId !== null && powerSaveBlocker.isStarted(sleepBlockerId)) {
      powerSaveBlocker.stop(sleepBlockerId);
    }
    sleepBlockerId = null;
  }

  // ─── Base ref capture ───
  async function captureBaseRef(): Promise<void> {
    try {
      const result = await gitService.getHeadSha(workspace.rootPath);
      if (result.success && result.data) {
        baseRef = result.data;
      }
    } catch {
      // Not a git repo or git error – ignore
    }
  }

  // ─── Turn boundaries ───
  async function startNextTurn(promptContent?: string): Promise<void> {
    // Close any currently-active turn (no-op on the first call for a fresh run).
    if (activeTurnId !== null) {
      await closeActiveTurn();
    }
    try {
      const nextIndex = turnCounter + 1;
      const id = await runsRepo.insertTurn({
        runId,
        turnIndex: nextIndex,
        promptContent,
        startedAt: new Date(),
      });
      activeTurnId = id;
      turnCounter = nextIndex;
    } catch (err) {
      console.error(`[RunSession ${runId}] Failed to start turn:`, err);
    }
  }

  async function closeActiveTurn(usage?: WorkRunUsage): Promise<void> {
    if (activeTurnId === null) return;
    const turnId = activeTurnId;
    try {
      const now = new Date();
      const turns = await runsRepo.findTurnsByRun(runId);
      const activeTurn = turns.find((t) => t.id === turnId);
      const elapsedMs = activeTurn?.startedAt
        ? now.getTime() - new Date(activeTurn.startedAt).getTime()
        : undefined;
      await runsRepo.updateTurn(turnId, {
        endedAt: now,
        elapsedMs,
        status: "completed",
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        cacheReadTokens: usage?.cacheReadTokens,
        cacheWriteTokens: usage?.cacheWriteTokens,
        costMicros: usage?.totalCostUsd
          ? Math.round(usage.totalCostUsd * 1_000_000)
          : undefined,
        model: usage?.model,
        modelUsage: usage?.modelUsage,
      });
      activeTurnId = null;
    } catch (err) {
      console.error(`[RunSession ${runId}] Failed to close active turn:`, err);
    }
  }

  // ─── Tool call cleanup ───
  async function closePendingToolCalls(status: "done" | "error"): Promise<void> {
    if (pendingToolCalls.size === 0) return;
    const now = new Date();
    for (const [callKey, toolCallId] of pendingToolCalls) {
      try {
        await runsRepo.updateToolCall(toolCallId, { status, endedAt: now });
      } catch (err) {
        console.error(`[RunSession ${runId}] Failed to close orphaned tool call ${callKey}:`, err);
      }
    }
    pendingToolCalls.clear();
  }

  /** Belt-and-suspenders: mark any DB-side tool calls still in "running" as ended. */
  async function closeRunningToolCallsInDb(status: "done" | "error"): Promise<void> {
    try {
      const calls = await runsRepo.findToolCallsByRun(runId);
      const now = new Date();
      for (const tc of calls) {
        if (tc.status !== "running") continue;
        try {
          await runsRepo.updateToolCall(tc.id, { status, endedAt: now });
        } catch (err) {
          console.error(`[RunSession ${runId}] Failed to close running tool call ${tc.id}:`, err);
        }
      }
    } catch (err) {
      console.error(`[RunSession ${runId}] Failed to load tool calls for cleanup:`, err);
    }
  }

  // ─── Diff snapshotting ───
  async function buildDiffSnapshot(): Promise<DiffSnapshot | null> {
    if (!baseRef) return null;
    try {
      const [diffResult, filesResult, statResult, untrackedResult] = await Promise.all([
        gitService.getDiffSince(workspace.rootPath, baseRef),
        gitService.getChangedFilesSince(workspace.rootPath, baseRef),
        gitService.getShortStatSince(workspace.rootPath, baseRef),
        gitService.getUntrackedFiles(workspace.rootPath),
      ]);
      let diffText = diffResult.success ? (diffResult.data ?? "") : "";
      const trackedFiles = filesResult.success ? (filesResult.data ?? []) : [];
      const untrackedFiles = untrackedResult.success ? (untrackedResult.data ?? []) : [];
      let shortstat = statResult.success ? (statResult.data ?? "") : "";

      const files = [...new Set([...trackedFiles, ...untrackedFiles])];

      // Inline untracked file content as synthetic diff hunks.
      let untrackedInsertions = 0;
      if (untrackedFiles.length > 0) {
        const untrackedDiffs: string[] = [];
        for (const filePath of untrackedFiles) {
          const fullPath = path.join(workspace.rootPath, filePath);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > MAX_UNTRACKED_INLINE_BYTES) {
              untrackedDiffs.push(
                `diff --git a/${filePath} b/${filePath}\nnew file\nBinary or large file (${stat.size} bytes)`,
              );
              continue;
            }
            const content = fs.readFileSync(fullPath, "utf-8");
            const lines = content.split("\n");
            untrackedInsertions += lines.length;
            const diffHeader = [
              `diff --git a/${filePath} b/${filePath}`,
              `new file mode 100644`,
              `--- /dev/null`,
              `+++ b/${filePath}`,
              `@@ -0,0 +1,${lines.length} @@`,
            ].join("\n");
            const diffBody = lines.map((l) => `+${l}`).join("\n");
            untrackedDiffs.push(`${diffHeader}\n${diffBody}`);
          } catch {
            untrackedDiffs.push(
              `diff --git a/${filePath} b/${filePath}\nnew file\n(could not read file)`,
            );
          }
        }
        if (untrackedDiffs.length > 0) {
          diffText = diffText ? `${diffText}\n${untrackedDiffs.join("\n")}` : untrackedDiffs.join("\n");
        }
      }

      if (untrackedInsertions > 0) {
        shortstat = mergeUntrackedIntoShortstat(shortstat, untrackedFiles.length, untrackedInsertions);
      }

      return { baseRef, diffText, files, untrackedFiles, shortstat };
    } catch (err) {
      console.error(`[RunSession ${runId}] buildDiffSnapshot failed:`, err);
      return null;
    }
  }

  async function upsertDiff(snapshot: DiffSnapshot): Promise<void> {
    const existing = await workspaceRepo.findDiffByRun(runId);
    const filesJson = JSON.stringify(snapshot.files);
    const statsJson = JSON.stringify({
      shortstat: snapshot.shortstat,
      files: snapshot.files.length,
      newFiles: snapshot.untrackedFiles.length,
    });
    if (existing) {
      await workspaceRepo.updateDiff(existing.id, {
        diffText: snapshot.diffText,
        filesJson,
        statsJson,
        baseRef: snapshot.baseRef,
      });
    } else {
      // First persisted diff for this run — wipe the workspace's prior (stale) row.
      await workspaceRepo.deleteLatestDiffByWorkspace(workspace.id);
      await workspaceService.createDiff({
        id: generateUuid(),
        workspaceId: workspace.id,
        runId,
        baseRef: snapshot.baseRef,
        diffText: snapshot.diffText,
        filesJson,
        statsJson,
      });
    }
  }

  // ─── Live diff scheduler ───
  async function recomputeLiveDiff(): Promise<void> {
    const snapshot = await buildDiffSnapshot();
    if (!snapshot || snapshot.files.length === 0) return;
    const existing = await workspaceRepo.findDiffByRun(runId);
    if (existing && hashContent(existing.diffText) === hashContent(snapshot.diffText)) {
      return;
    }
    try {
      await upsertDiff(snapshot);
      broadcastDiffUpdated();
    } catch (err) {
      console.error(`[RunSession ${runId}] recomputeLiveDiff failed:`, err);
    }
  }

  async function runLiveDiff(): Promise<void> {
    if (liveDiffInFlight) {
      liveDiffPending = true;
      return;
    }
    liveDiffInFlight = true;
    try {
      await recomputeLiveDiff();
    } finally {
      liveDiffInFlight = false;
      if (liveDiffPending) {
        liveDiffPending = false;
        void runLiveDiff();
      }
    }
  }

  function scheduleLiveDiff(): void {
    if (liveDiffTimer) clearTimeout(liveDiffTimer);
    liveDiffTimer = setTimeout(() => {
      liveDiffTimer = null;
      void runLiveDiff();
    }, LIVE_DIFF_DEBOUNCE_MS);
  }

  function clearLiveDiffSchedule(): void {
    if (liveDiffTimer) {
      clearTimeout(liveDiffTimer);
      liveDiffTimer = null;
    }
    liveDiffPending = false;
  }

  // ─── Final diff persistence at completion ───
  async function persistFinalDiff(): Promise<void> {
    clearLiveDiffSchedule();
    const snapshot = await buildDiffSnapshot();
    if (!snapshot || snapshot.files.length === 0) return;

    try {
      // Incremental file count vs a prior diff sharing the same baseRef (not our own
      // live row): activity log reflects only what changed since the last snapshot.
      const recentDiffs = await workspaceRepo.findDiffsByWorkspace(workspace.id, 10);
      let incrementalFileCount = snapshot.files.length;
      let incrementalFileNames: string[] = snapshot.files;
      const prevDiffWithSameBase = recentDiffs.find(
        (d) => d.baseRef === snapshot.baseRef && d.runId !== runId,
      );
      if (prevDiffWithSameBase) {
        const prevPerFile = buildPerFileDiffHashes(prevDiffWithSameBase.diffText);
        const currPerFile = buildPerFileDiffHashes(snapshot.diffText);
        const changedFiles: string[] = [];
        for (const [file, hash] of currPerFile) {
          if (prevPerFile.get(file) !== hash) changedFiles.push(file);
        }
        incrementalFileCount = changedFiles.length;
        incrementalFileNames = changedFiles;
      }

      await upsertDiff(snapshot);
      broadcastDiffUpdated();

      if (incrementalFileCount > 0) {
        const summaryLines = incrementalFileNames.map((f) => f.split("/").pop() ?? f).join(", ");
        logWorkspaceActivity({
          workspaceId: workspace.id,
          type: "diff",
          title: `${incrementalFileCount} file${incrementalFileCount === 1 ? "" : "s"} changed`,
          summary: summaryLines,
          refId: runId,
          metadata: { files: incrementalFileCount, fileNames: incrementalFileNames },
        });
      }
    } catch (err) {
      console.error(`[RunSession ${runId}] persistFinalDiff failed:`, err);
    }
  }

  // ─── Projection rules (was handleRunEvent's switch in runs.service.ts) ───
  async function projectLog(event: Extract<WorkRunEvent, { type: "log" }>): Promise<void> {
    await runsRepo.insertArtifact({
      runId,
      kind: "log",
      content: event.message,
      metadata: { level: event.level, ts: event.ts },
    });
    // Auto-generated title from provider (e.g. Codex CLI thread/name/updated)
    const threadTitle = (event.metadata as Record<string, unknown> | undefined)?.threadTitle as
      | string
      | undefined;
    if (threadTitle) {
      await runsRepo.updateRun(runId, { title: threadTitle });
    }
  }

  async function projectToolCall(
    event: Extract<WorkRunEvent, { type: "tool_call" }>,
  ): Promise<void> {
    const phase = (event.metadata as Record<string, unknown> | undefined)?.phase;
    if (phase === "start") {
      const toolCallId = await runsRepo.insertToolCall({
        accountId,
        runId,
        providerId,
        toolName: event.toolName,
        status: "running",
        input: event.input,
        startedAt: event.startedAt ? new Date(event.startedAt) : new Date(),
      });
      const metadataToolCallId = (event.metadata as Record<string, unknown> | undefined)?.toolCallId;
      const callKey = metadataToolCallId
        ? String(metadataToolCallId)
        : `${event.toolName}-${event.startedAt || Date.now()}`;
      pendingToolCalls.set(callKey, toolCallId);
      return;
    }
    if (phase === "end" || phase === "complete") {
      const metadataToolCallId = (event.metadata as Record<string, unknown> | undefined)?.toolCallId;
      let callKey: string | undefined;
      if (metadataToolCallId) {
        callKey = String(metadataToolCallId);
        if (!pendingToolCalls.has(callKey)) {
          callKey = Array.from(pendingToolCalls.keys()).find((k) =>
            k.startsWith(`${event.toolName}-`),
          );
        }
      } else {
        callKey = Array.from(pendingToolCalls.keys()).find((k) =>
          k.startsWith(`${event.toolName}-`),
        );
      }
      if (callKey && pendingToolCalls.has(callKey)) {
        const toolCallId = pendingToolCalls.get(callKey)!;
        pendingToolCalls.delete(callKey);
        const latencyMs =
          event.startedAt && event.endedAt ? event.endedAt - event.startedAt : undefined;
        await runsRepo.updateToolCall(toolCallId, {
          status: event.error ? "error" : "done",
          input: event.input as Record<string, unknown> | undefined,
          output: event.output,
          error: event.error,
          endedAt: event.endedAt ? new Date(event.endedAt) : new Date(),
          latencyMs,
          metadata: event.metadata,
        });
      }
      // Live diff: if this tool could have touched the filesystem, schedule a recomputation.
      if (!event.error && couldModifyFiles(event.toolName)) {
        scheduleLiveDiff();
      }
    }
  }

  async function projectArtifact(
    event: Extract<WorkRunEvent, { type: "artifact" }>,
  ): Promise<boolean> {
    // Streaming chunks: push to renderer only, skip DB and the persisted-event broadcast.
    if (event.ephemeral) {
      broadcastEphemeralEvent({
        type: event.type,
        kind: event.kind,
        content: event.content,
        metadata: event.metadata,
        streamId: event.streamId,
      });
      return false;
    }

    await runsRepo.insertArtifact({
      runId,
      kind: event.kind as "patch" | "file" | "log" | "report" | "command_result" | "result",
      path: event.path,
      content: event.content,
      contentHash: event.content ? hashContent(event.content) : undefined,
      metadata: event.metadata,
    });

    // Turn boundary side-effects
    const artifactKind = (event.metadata as Record<string, unknown> | undefined)?.kind;
    if (artifactKind === "user-prompt") {
      await startNextTurn(event.content);
    }
    if (artifactKind === "result" && event.content && activeTurnId !== null) {
      try {
        await runsRepo.appendResponseContent(activeTurnId, event.content);
      } catch (err) {
        console.error(`[RunSession ${runId}] Failed to append response for turn ${activeTurnId}:`, err);
      }
    }
    return true;
  }

  async function projectPromptSuggestion(
    event: Extract<WorkRunEvent, { type: "prompt_suggestion" }>,
  ): Promise<void> {
    await runsRepo.insertArtifact({
      runId,
      kind: "prompt_suggestion",
      content: event.suggestion,
      metadata: { ts: event.ts },
    });
  }

  // ─── Public methods ───
  async function project(event: WorkRunEvent): Promise<void> {
    if (finalized) return;
    let didPersist = false;
    switch (event.type) {
      case "log":
        await projectLog(event);
        didPersist = true;
        break;
      case "tool_call":
        await projectToolCall(event);
        didPersist = true;
        break;
      case "artifact":
        didPersist = await projectArtifact(event);
        break;
      case "prompt_suggestion":
        await projectPromptSuggestion(event);
        didPersist = true;
        break;
      case "status":
        console.log(`[RunSession ${runId}] status event: ${event.status}`);
        break;
      // WorkRunSubagentEvent currently has no projection — matches legacy behavior.
    }
    if (didPersist) broadcastEventPersisted();
  }

  function updateBaseRef(sha: string): void {
    if (finalized) return;
    baseRef = sha;
  }

  async function abort(): Promise<void> {
    if (finalized || aborting) return;
    aborting = true;
    try {
      const provider = await providersRepo.findById(providerId);
      if (provider) {
        const adapter = createWorkAdapter(provider);
        if (adapter.abortRun) await adapter.abortRun(runId);
      }
    } catch (err) {
      console.error(`[RunSession ${runId}] adapter.abortRun failed:`, err);
    }
    // Belt-and-suspenders: if adapter doesn't wind down, force-finalize.
    forceFinalizeTimer = setTimeout(() => {
      if (!finalized) {
        void finalize({
          status: "canceled",
          summary: "Forced abort: adapter did not wind down within timeout",
        });
      }
    }, FORCE_FINALIZE_TIMEOUT_MS);
  }

  async function finalize(result: RunSessionResult): Promise<void> {
    if (finalized) return;
    finalized = true;
    if (forceFinalizeTimer) {
      clearTimeout(forceFinalizeTimer);
      forceFinalizeTimer = null;
    }
    clearLiveDiffSchedule();

    const toolCallStatus = result.status === "succeeded" ? "done" : "error";

    try {
      // Persist diff before status flip — renderer polling sees status change
      // with the diff already available.
      if (result.status === "succeeded") {
        await persistFinalDiff();
      } else {
        baseRef = null;
      }

      await runsRepo.updateRun(runId, {
        status: result.status,
        endedAt: new Date(),
        lastError: result.status === "failed" ? result.summary : undefined,
        stopReason: result.stopReason ?? null,
      });

      await closeActiveTurn(result.usage);
      await closePendingToolCalls(toolCallStatus);
      await closeRunningToolCallsInDb(toolCallStatus);
    } catch (cleanupErr) {
      console.error(`[RunSession ${runId}] Cleanup failed:`, cleanupErr);
    } finally {
      releaseSleepBlocker();
      broadcastStatusChanged(result.status);
      broadcastEventPersisted();
      void sendNotification(result.status);
      runSessionRegistry.unregister(runId);
    }
  }

  // ─── Initialize ───
  const session: RunSession = { runId, project, abort, finalize, updateBaseRef };
  runSessionRegistry.register(runId, session);

  // Fire-and-forget initialization. Each helper handles its own errors.
  void captureBaseRef();
  void acquireSleepBlocker();
  void startNextTurn(ctx.initialPromptContent);

  return session;
}
