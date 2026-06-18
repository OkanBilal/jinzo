import { BrowserWindow, Notification, powerSaveBlocker } from "electron";

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
import {
  buildDiffSnapshot,
  hashContent,
  type DiffSnapshot,
} from "../workspace/workspace-diff-snapshot";
import { createWorkAdapter } from "../providers/adapters";
import { runSessionRegistry } from "./run-session-registry";
import { emit } from "../../ipc-kit";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const LIVE_DIFF_DEBOUNCE_MS = 300;
const FORCE_FINALIZE_TIMEOUT_MS = 30_000;

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

// Push a run event to all clients via the outbound event bus. The bus fans out
// to the local renderer today and to remote clients under `mains serve`.
function broadcastToWindows(channel: string, payload: unknown): void {
  emit(channel, payload);
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
  // Per-file diff hashes of the working tree as it stood at run start. Used at
  // finalize to report only files THIS run touched, so pre-existing dirty files
  // carried over from an earlier run aren't re-logged on every run.
  // null = baseline not captured (git error / not yet snapshotted); an empty Map
  // = captured a clean tree. persistFinalDiff treats these two cases differently.
  let initialDiffHashes: Map<string, string> | null = null;
  // Resolves when captureBaseRef finishes, so finalize can await the baseline
  // instead of racing it on near-instant runs.
  let baseRefCaptured: Promise<void> | null = null;
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
  function broadcastContextUsage(event: Extract<WorkRunEvent, { type: "context_usage" }>): void {
    broadcastToWindows("runs:contextUsage", { runId, event, ts: Date.now() });
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
        // Snapshot the working tree's pre-existing changes against baseRef so
        // the final activity log reflects only what THIS run changed. Files
        // already dirty at run start are excluded unless this run touches them.
        const snapshot = await buildDiffSnapshot({
          rootPath: workspace.rootPath,
          baseRef,
        });
        // Leave initialDiffHashes null if the snapshot failed: an empty Map means
        // "tree was clean at start" (every later change is ours), whereas null
        // means "baseline unknown" — persistFinalDiff treats these differently.
        if (snapshot) {
          initialDiffHashes = buildPerFileDiffHashes(snapshot.diffText);
        }
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
  async function snapshotCurrentDiff(): Promise<DiffSnapshot | null> {
    if (!baseRef) return null;
    return buildDiffSnapshot({ rootPath: workspace.rootPath, baseRef });
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

  /**
   * Drop the workspace's latest diff row when the working tree is clean against
   * the current baseRef. Covers the case where the user committed externally
   * (or otherwise resolved changes) between runs, leaving a stale diff row
   * pointing at a now-merged baseRef.
   */
  async function clearStaleWorkspaceDiff(): Promise<void> {
    const latest = await workspaceRepo.findLatestDiffByWorkspace(workspace.id);
    if (!latest) return;
    await workspaceRepo.deleteLatestDiffByWorkspace(workspace.id);
    broadcastDiffUpdated();
  }

  // ─── Live diff scheduler ───
  async function recomputeLiveDiff(): Promise<void> {
    const snapshot = await snapshotCurrentDiff();
    if (!snapshot) return;
    if (snapshot.files.length === 0) {
      try {
        await clearStaleWorkspaceDiff();
      } catch (err) {
        console.error(`[RunSession ${runId}] clearStaleWorkspaceDiff failed:`, err);
      }
      return;
    }
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
    // Make sure the run-start baseline finished capturing before we diff against
    // it. Normally settled long ago; this only bites runs that finish almost
    // immediately, where the fire-and-forget capture could still be in flight
    // and leave initialDiffHashes transiently null.
    if (baseRefCaptured) {
      try {
        await baseRefCaptured;
      } catch {
        // captureBaseRef swallows its own errors; guard anyway.
      }
    }
    const snapshot = await snapshotCurrentDiff();
    if (!snapshot) return;
    if (snapshot.files.length === 0) {
      try {
        await clearStaleWorkspaceDiff();
      } catch (err) {
        console.error(`[RunSession ${runId}] clearStaleWorkspaceDiff failed:`, err);
      }
      return;
    }

    try {
      await upsertDiff(snapshot);
      broadcastDiffUpdated();

      // No reliable run-start baseline: null means "baseline unknown" (the git
      // snapshot at run start failed), distinct from an empty Map ("tree was
      // clean at start"). Without a baseline we can't separate this run's edits
      // from pre-existing dirt, so skip the activity entry rather than
      // mis-attributing carry-over changes. The diff above is still persisted.
      if (initialDiffHashes === null) return;

      // Report only files THIS run changed: compare the final per-file diff
      // hashes against the baseline captured at run start. Files already dirty
      // at run start and untouched here hash identically and are skipped, so a
      // no-op run over a pre-existing dirty tree logs nothing.
      const baseline = initialDiffHashes;
      const incrementalFileNames: string[] = [];
      for (const [file, hash] of buildPerFileDiffHashes(snapshot.diffText)) {
        if (baseline.get(file) !== hash) incrementalFileNames.push(file);
      }
      const incrementalFileCount = incrementalFileNames.length;

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
        // Stable id present → match ONLY by exact id. The name-prefix fallback
        // below closes the wrong call when many same-named tools run in parallel
        // (e.g. a subagent reading 10 files), and a completion for an
        // already-resolved id (duplicate from hook + tool_result block) must be
        // a no-op rather than closing an unrelated pending call.
        callKey = String(metadataToolCallId);
      } else {
        // No id (legacy/partial providers): best-effort match the oldest pending
        // call with the same tool name.
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
      case "context_usage":
        // Renderer-only live indicator; never persisted.
        broadcastContextUsage(event);
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
  // Keep the baseRef-capture promise so finalize can await it (see persistFinalDiff).
  baseRefCaptured = captureBaseRef();
  void acquireSleepBlocker();
  void startNextTurn(ctx.initialPromptContent);

  return session;
}
