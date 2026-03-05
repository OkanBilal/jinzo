import { powerSaveBlocker, Notification, BrowserWindow } from "electron";
import { runsRepo } from "./runs.repo";
import { providersRepo } from "../providers/providers.repo";
import { workspacesRepo } from "../workspaces/workspaces.repo";
import { appSettingsRepo } from "../appSettings/appSettings.repo";
import { gitService } from "../git/git.service";
import { workspaceDiffsService } from "../workspaceDiffs/workspaceDiffs.service";
import { workspaceActivityService } from "../workspaceActivity/workspaceActivity.service";
import { workspaceDiffsRepo } from "../workspaceDiffs/workspaceDiffs.repo";
import {
  createWorkAdapter,
  type WorkRunEvent,
  type WorkRunContextItem,
  type WorkRunAdapter,
} from "../providers/adapters";
import type {
  CreateRunPayload,
  UpdateRunPayload,
  RunResponse,
  CreateRunContextPayload,
  RunContextResponse,
  CreateRunArtifactPayload,
  RunArtifactResponse,
  CreateToolCallPayload,
  UpdateToolCallPayload,
  ToolCallResponse,
  ServiceResponse,
  RunStatus,
  StartRunPayload,
  StartRunResponse,
  StartRunContextItem,
  ContinueRunPayload,
  ContinueRunResponse,
  ForkRunPayload,
  ForkRunResponse,
  RunDetailsResponse,
  RunTurnResponse,
} from "./runs.dto";
import type { WorkRunUsage } from "../providers/adapters/adapter.types";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";

// In-memory map: runId -> git HEAD sha captured at run start
const runBaseRefs = new Map<string, string>();

// In-memory map: runId -> powerSaveBlocker id
const sleepBlockers = new Map<string, number>();

// In-memory maps for turn tracking
const activeTurnIds = new Map<string, number>(); // runId → active turn DB id
const turnCounters = new Map<string, number>(); // runId → last turnIndex

async function acquireSleepBlocker(runId: string): Promise<void> {
  const settings = await appSettingsRepo.findById("default");
  if (!settings?.preventSleepDuringRuns) return;
  if (!sleepBlockers.has(runId)) {
    const id = powerSaveBlocker.start("prevent-app-suspension");
    sleepBlockers.set(runId, id);
  }
}

function releaseSleepBlocker(runId: string): void {
  const id = sleepBlockers.get(runId);
  if (id !== undefined && powerSaveBlocker.isStarted(id)) {
    powerSaveBlocker.stop(id);
  }
  sleepBlockers.delete(runId);
}

export function releaseAllSleepBlockers(): void {
  for (const [runId] of sleepBlockers) {
    releaseSleepBlocker(runId);
  }
}

async function sendRunNotification(runId: string, status: string): Promise<void> {
  try {
    const settings = await appSettingsRepo.findById("default");
    if (!settings?.notifyOnRunComplete) return;

    const title = status === "succeeded" ? "Run Completed" : "Run Failed";
    const body = status === "succeeded"
      ? `Run ${runId.slice(0, 8)} finished successfully`
      : `Run ${runId.slice(0, 8)} failed`;

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
    console.error("[RunsService] Failed to send run notification:", err);
  }
}

/**
 * Update the base ref for a run (e.g. after a commit so persistRunDiff
 * compares against the post-commit HEAD instead of the pre-commit one).
 */
export function updateRunBaseRef(runId: string, sha: string): void {
  runBaseRefs.set(runId, sha);
}

/**
 * Capture HEAD sha at run start for later diff computation.
 * Silently no-ops if the workspace is not a git repo.
 */
async function captureBaseRef(runId: string, rootPath: string): Promise<void> {
  try {
    const result = await gitService.getHeadSha(rootPath);
    if (result.success && result.data) {
      runBaseRefs.set(runId, result.data);
    }
  } catch {
    // Not a git repo or git error – ignore
  }
}

// ─────────────────────────────────────────────────────────────
// Turn Tracking Helpers
// ─────────────────────────────────────────────────────────────

async function createInitialTurn(runId: string, promptContent?: string): Promise<void> {
  try {
    const turnIndex = 0;
    const id = await runsRepo.insertTurn({
      runId,
      turnIndex,
      promptContent,
      startedAt: new Date(),
    });
    activeTurnIds.set(runId, id);
    turnCounters.set(runId, turnIndex);
  } catch (err) {
    console.error(`[RunsService] Failed to create initial turn for ${runId}:`, err);
  }
}

async function closeActiveTurn(runId: string, usage?: WorkRunUsage): Promise<void> {
  const turnId = activeTurnIds.get(runId);
  if (turnId === undefined) return;

  try {
    const now = new Date();
    // Find the turn to compute elapsed
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

    activeTurnIds.delete(runId);
  } catch (err) {
    console.error(`[RunsService] Failed to close active turn for ${runId}:`, err);
  }
}

async function startNewTurn(runId: string, promptContent?: string): Promise<void> {
  // Close current active turn without usage (usage comes at completion)
  await closeActiveTurn(runId);

  try {
    const nextIndex = (turnCounters.get(runId) ?? -1) + 1;
    const id = await runsRepo.insertTurn({
      runId,
      turnIndex: nextIndex,
      promptContent,
      startedAt: new Date(),
    });
    activeTurnIds.set(runId, id);
    turnCounters.set(runId, nextIndex);
  } catch (err) {
    console.error(`[RunsService] Failed to start new turn for ${runId}:`, err);
  }
}

function cleanupTurnState(runId: string): void {
  activeTurnIds.delete(runId);
  turnCounters.delete(runId);
}

/**
 * Compute git diff since baseRef and persist into workspace_diffs.
 * Called after a run succeeds.
 */
async function persistRunDiff(runId: string, workspaceId: string, rootPath: string): Promise<void> {
  const baseRef = runBaseRefs.get(runId);
  runBaseRefs.delete(runId);

  if (!baseRef) return;

  try {
    const [diffResult, filesResult, statResult, untrackedResult] = await Promise.all([
      gitService.getDiffSince(rootPath, baseRef),
      gitService.getChangedFilesSince(rootPath, baseRef),
      gitService.getShortStatSince(rootPath, baseRef),
      gitService.getUntrackedFiles(rootPath),
    ]);

    let diffText = diffResult.success ? (diffResult.data ?? "") : "";
    const trackedFiles = filesResult.success ? (filesResult.data ?? []) : [];
    const untrackedFiles = untrackedResult.success ? (untrackedResult.data ?? []) : [];
    let shortstat = statResult.success ? (statResult.data ?? "") : "";

    // Merge tracked and untracked file lists (deduplicated)
    const files = [...new Set([...trackedFiles, ...untrackedFiles])];

    // Generate diff entries for untracked (new) files
    // Also count their lines to include in shortstat (git diff --shortstat doesn't cover untracked files)
    let untrackedInsertions = 0;
    if (untrackedFiles.length > 0) {
      const untrackedDiffs: string[] = [];
      for (const filePath of untrackedFiles) {
        const fullPath = path.join(rootPath, filePath);
        try {
          const stat = fs.statSync(fullPath);
          // Skip binary / large files (>256KB)
          if (stat.size > 256 * 1024) {
            untrackedDiffs.push(
              `diff --git a/${filePath} b/${filePath}\nnew file\nBinary or large file (${stat.size} bytes)`
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
          // File may have been deleted between ls-files and read, skip
          untrackedDiffs.push(
            `diff --git a/${filePath} b/${filePath}\nnew file\n(could not read file)`
          );
        }
      }
      if (untrackedDiffs.length > 0) {
        diffText = diffText
          ? `${diffText}\n${untrackedDiffs.join("\n")}`
          : untrackedDiffs.join("\n");
      }
    }

    // Merge untracked file insertions into shortstat
    // git diff --shortstat only covers tracked files, so new (untracked) files are missing
    if (untrackedInsertions > 0) {
      shortstat = mergeUntrackedIntoShortstat(shortstat, untrackedFiles.length, untrackedInsertions);
    }

    // Skip if no files changed
    if (files.length === 0) {
      console.log(`[RunsService] No changes since ${baseRef} for run ${runId}, skipping diff persist`);
      return;
    }

    // Skip if identical diff content was already persisted for this workspace
    const diffHash = hashContent(diffText);
    const recentDiffs = await workspaceDiffsRepo.findByWorkspace(workspaceId, 10);
    const duplicateDiff = recentDiffs.find((d) => hashContent(d.diffText) === diffHash);
    if (duplicateDiff) {
      console.log(`[RunsService] Identical diff already exists (id: ${duplicateDiff.id}), skipping`);
      return;
    }

    await workspaceDiffsService.createDiff({
      id: generateRunId(),
      workspaceId,
      runId,
      baseRef,
      diffText,
      filesJson: JSON.stringify(files),
      statsJson: JSON.stringify({ shortstat, files: files.length, newFiles: untrackedFiles.length }),
    });

    workspaceActivityService.log({
      workspaceId,
      type: "diff",
      title: `${files.length} file${files.length === 1 ? "" : "s"} changed`,
      summary: shortstat || undefined,
      refId: runId,
      metadata: { files: files.length, shortstat },
    });
  } catch (err) {
    console.error(`[RunsService] Failed to persist run diff for ${runId}:`, err);
  }
}

// ─────────────────────────────────────────────────────────────
// Title Generation Helpers
// ─────────────────────────────────────────────────────────────

function fallbackTitle(goal: string): string {
  const firstLine = goal.split("\n")[0].trim();
  if (firstLine.length <= 60) return firstLine;
  const truncated = firstLine.substring(0, 60);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + "...";
}

async function generateRunTitle(
  runId: string,
  adapter: WorkRunAdapter,
  goal: string,
  context?: StartRunContextItem[],
): Promise<void> {
  let title: string;
  try {
    if (adapter.generateTitle) {
      title = await adapter.generateTitle(goal, context as WorkRunContextItem[]);
    } else {
      title = fallbackTitle(goal);
    }
  } catch {
    title = fallbackTitle(goal);
  }
  await runsRepo.updateRun(runId, { title });
}

// ─────────────────────────────────────────────────────────────
// Runs Service
// ─────────────────────────────────────────────────────────────
export const runsService = {
  // ─────────────────────────────────────────────────────────────
  // Run Operations
  // ─────────────────────────────────────────────────────────────
  async getAllRuns(limit?: number): Promise<ServiceResponse<RunResponse[]>> {
    try {
      const runs = await runsRepo.findAllRuns(limit);
      return { success: true, data: runs };
    } catch (error) {
      console.error("[RunsService] Failed to get all runs:", error);
      return { success: false, error: "Failed to get runs" };
    }
  },

  async getRunById(id: string): Promise<ServiceResponse<RunResponse>> {
    try {
      const run = await runsRepo.findRunById(id);
      if (!run) {
        return { success: false, error: "Run not found" };
      }
      return { success: true, data: run };
    } catch (error) {
      console.error(`[RunsService] Failed to get run ${id}:`, error);
      return { success: false, error: "Failed to get run" };
    }
  },

  async getRunsByAccount(
    accountId: string,
    limit?: number,
  ): Promise<ServiceResponse<RunResponse[]>> {
    try {
      const runs = await runsRepo.findRunsByAccount(accountId, limit);
      return { success: true, data: runs };
    } catch (error) {
      console.error(
        `[RunsService] Failed to get runs for account ${accountId}:`,
        error,
      );
      return { success: false, error: "Failed to get runs" };
    }
  },

  async getRunsByWorkspace(
    workspaceId: string,
    limit?: number,
  ): Promise<ServiceResponse<RunResponse[]>> {
    try {
      const runs = await runsRepo.findRunsByWorkspace(workspaceId, limit);
      return { success: true, data: runs };
    } catch (error) {
      console.error(
        `[RunsService] Failed to get runs for workspace ${workspaceId}:`,
        error,
      );
      return { success: false, error: "Failed to get runs" };
    }
  },

  async getRunsByStatus(
    accountId: string,
    status: RunStatus,
  ): Promise<ServiceResponse<RunResponse[]>> {
    try {
      const runs = await runsRepo.findRunsByStatus(accountId, status);
      return { success: true, data: runs };
    } catch (error) {
      console.error(`[RunsService] Failed to get runs by status:`, error);
      return { success: false, error: "Failed to get runs" };
    }
  },

  async createRun(payload: CreateRunPayload): Promise<ServiceResponse<string>> {
    try {
      const id = await runsRepo.insertRun(payload);
      return { success: true, data: id };
    } catch (error) {
      console.error("[RunsService] Failed to create run:", error);
      return { success: false, error: "Failed to create run" };
    }
  },

  async updateRun(
    id: string,
    payload: UpdateRunPayload,
  ): Promise<ServiceResponse<RunResponse>> {
    try {
      const updated = await runsRepo.updateRun(id, payload);
      if (!updated) {
        return { success: false, error: "Run not found" };
      }
      return { success: true, data: updated };
    } catch (error) {
      console.error(`[RunsService] Failed to update run ${id}:`, error);
      return { success: false, error: "Failed to update run" };
    }
  },

  async startRun(id: string): Promise<ServiceResponse<RunResponse>> {
    return this.updateRun(id, { status: "running", startedAt: new Date() });
  },

  async completeRun(id: string): Promise<ServiceResponse<RunResponse>> {
    return this.updateRun(id, { status: "succeeded", endedAt: new Date() });
  },

  async failRun(
    id: string,
    error: string,
  ): Promise<ServiceResponse<RunResponse>> {
    return this.updateRun(id, {
      status: "failed",
      endedAt: new Date(),
      lastError: error,
    });
  },

  async cancelRun(id: string): Promise<ServiceResponse<RunResponse>> {
    return this.updateRun(id, { status: "canceled", endedAt: new Date() });
  },

  async deleteRun(id: string): Promise<ServiceResponse<void>> {
    try {
      await runsRepo.deleteRun(id);
      return { success: true };
    } catch (error) {
      console.error(`[RunsService] Failed to delete run ${id}:`, error);
      return { success: false, error: "Failed to delete run" };
    }
  },

  async archiveRun(id: string): Promise<ServiceResponse<RunResponse>> {
    try {
      const archived = await runsRepo.archiveRun(id);
      if (!archived) {
        return { success: false, error: "Run not found" };
      }
      return { success: true, data: archived };
    } catch (error) {
      console.error(`[RunsService] Failed to archive run ${id}:`, error);
      return { success: false, error: "Failed to archive run" };
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Run Context Operations
  // ─────────────────────────────────────────────────────────────
  async getContextByRun(
    runId: string,
  ): Promise<ServiceResponse<RunContextResponse[]>> {
    try {
      const contexts = await runsRepo.findContextByRun(runId);
      return { success: true, data: contexts };
    } catch (error) {
      console.error(
        `[RunsService] Failed to get context for run ${runId}:`,
        error,
      );
      return { success: false, error: "Failed to get context" };
    }
  },

  async addContext(
    payload: CreateRunContextPayload,
  ): Promise<ServiceResponse<number>> {
    try {
      const id = await runsRepo.insertContext(payload);
      return { success: true, data: id };
    } catch (error) {
      console.error("[RunsService] Failed to add context:", error);
      return { success: false, error: "Failed to add context" };
    }
  },

  async removeContext(id: number): Promise<ServiceResponse<void>> {
    try {
      await runsRepo.deleteContext(id);
      return { success: true };
    } catch (error) {
      console.error(`[RunsService] Failed to remove context ${id}:`, error);
      return { success: false, error: "Failed to remove context" };
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Run Artifact Operations
  // ─────────────────────────────────────────────────────────────
  async getArtifactsByRun(
    runId: string,
  ): Promise<ServiceResponse<RunArtifactResponse[]>> {
    try {
      const artifacts = await runsRepo.findArtifactsByRun(runId);
      return { success: true, data: artifacts };
    } catch (error) {
      console.error(
        `[RunsService] Failed to get artifacts for run ${runId}:`,
        error,
      );
      return { success: false, error: "Failed to get artifacts" };
    }
  },

  async addArtifact(
    payload: CreateRunArtifactPayload,
  ): Promise<ServiceResponse<number>> {
    try {
      const id = await runsRepo.insertArtifact(payload);
      return { success: true, data: id };
    } catch (error) {
      console.error("[RunsService] Failed to add artifact:", error);
      return { success: false, error: "Failed to add artifact" };
    }
  },

  async removeArtifact(id: number): Promise<ServiceResponse<void>> {
    try {
      await runsRepo.deleteArtifact(id);
      return { success: true };
    } catch (error) {
      console.error(`[RunsService] Failed to remove artifact ${id}:`, error);
      return { success: false, error: "Failed to remove artifact" };
    }
  },


  // ─────────────────────────────────────────────────────────────
  // Tool Call Operations
  // ─────────────────────────────────────────────────────────────
  async getToolCallsByRun(
    runId: string,
  ): Promise<ServiceResponse<ToolCallResponse[]>> {
    try {
      const toolCalls = await runsRepo.findToolCallsByRun(runId);
      return { success: true, data: toolCalls };
    } catch (error) {
      console.error(
        `[RunsService] Failed to get tool calls for run ${runId}:`,
        error,
      );
      return { success: false, error: "Failed to get tool calls" };
    }
  },

  async addToolCall(
    payload: CreateToolCallPayload,
  ): Promise<ServiceResponse<number>> {
    try {
      const id = await runsRepo.insertToolCall(payload);
      return { success: true, data: id };
    } catch (error) {
      console.error("[RunsService] Failed to add tool call:", error);
      return { success: false, error: "Failed to add tool call" };
    }
  },

  async updateToolCall(
    id: number,
    payload: UpdateToolCallPayload,
  ): Promise<ServiceResponse<void>> {
    try {
      await runsRepo.updateToolCall(id, payload);
      return { success: true };
    } catch (error) {
      console.error(`[RunsService] Failed to update tool call ${id}:`, error);
      return { success: false, error: "Failed to update tool call" };
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Get Run Details (with all related data)
  // ─────────────────────────────────────────────────────────────
  async getRunDetails(
    runId: string,
  ): Promise<ServiceResponse<RunDetailsResponse>> {
    try {
      const run = await runsRepo.findRunById(runId);
      if (!run) {
        return { success: false, error: "Run not found" };
      }

      const [context, artifacts, toolCalls, turns] = await Promise.all([
        runsRepo.findContextByRun(runId),
        runsRepo.findArtifactsByRun(runId),
        runsRepo.findToolCallsByRun(runId),
        runsRepo.findTurnsByRun(runId),
      ]);

      return {
        success: true,
        data: {
          run,
          context,
          artifacts,
          toolCalls,
          turns,
        },
      };
    } catch (error) {
      console.error(`[RunsService] Failed to get run details ${runId}:`, error);
      return { success: false, error: "Failed to get run details" };
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Execute Run (main orchestration)
  // ─────────────────────────────────────────────────────────────
  async executeRun(
    payload: StartRunPayload,
  ): Promise<ServiceResponse<StartRunResponse>> {
    const runId = generateRunId();

    try {
      // 1. Load provider and verify it's enabled
      const provider = await providersRepo.findById(payload.providerId);
      if (!provider) {
        return {
          success: false,
          error: `Provider "${payload.providerId}" not found`,
        };
      }
      if (!provider.isEnabled) {
        return {
          success: false,
          error: `Provider "${provider.displayName}" is not enabled`,
        };
      }
      if (provider.kind !== "agent_runtime") {
        return {
          success: false,
          error: `Provider "${provider.displayName}" is not an agent runtime`,
        };
      }

      // 2. Load workspace
      const workspace = await workspacesRepo.findById(payload.workspaceId);
      if (!workspace) {
        return {
          success: false,
          error: `Workspace "${payload.workspaceId}" not found`,
        };
      }

      // Transition workspace to in_progress when run starts
      await workspacesRepo.update(payload.workspaceId, { status: "in_progress" });

      // 3. Create run record with status=running
      const createPayload: CreateRunPayload = {
        id: runId,
        accountId: payload.accountId,
        workspaceId: payload.workspaceId,
        spaceId: payload.spaceId,
        providerId: payload.providerId,
        model: payload.model,
        goal: payload.goal,
        status: "running",
        systemPrompt: payload.systemPrompt,
        configSnapshot: payload.configSnapshot,
        toolPolicySnapshot: payload.toolPolicySnapshot,
      };

      await runsRepo.insertRun(createPayload);
      await runsRepo.updateRun(runId, { startedAt: new Date() });

      // Capture git HEAD sha at run start for diff computation
      await captureBaseRef(runId, workspace.rootPath);

      // 4. Persist initial context
      if (payload.initialContext && payload.initialContext.length > 0) {
        for (const ctx of payload.initialContext) {
          await runsRepo.insertContext({
            runId,
            kind: ctx.kind as "file" | "selection" | "diff" | "note",
            ref: ctx.ref,
            content: ctx.content,
            contentHash: ctx.content ? hashContent(ctx.content) : undefined,
            metadata: ctx.metadata,
          });
        }
      }

      // 5. Create adapter
      const adapter = createWorkAdapter(provider);

      // Fire-and-forget: generate title in background
      generateRunTitle(runId, adapter, payload.goal, payload.initialContext).catch((err) =>
        console.error(`[RunsService] Title generation failed for ${runId}:`, err),
      );

      // Track tool calls for updating when completed
      const pendingToolCalls = new Map<string, number>();

      // 6. Create initial turn
      await createInitialTurn(runId, payload.goal);

      // 7. Acquire sleep blocker if enabled
      await acquireSleepBlocker(runId);

      // 8. Start run with event handler (runs in background)
      const runPromise = adapter.startRun(
        {
          runId,
          accountId: payload.accountId,
          workspace: {
            id: workspace.id,
            rootPath: workspace.rootPath,
          },
          goal: payload.goal,
          model: payload.model,
          systemPrompt: payload.systemPrompt,
          context: payload.initialContext as WorkRunContextItem[] | undefined,
          toolPolicy: payload.toolPolicySnapshot,
          attachments: payload.attachments,
          contextIssues: payload.contextIssues,
          contextFiles: payload.contextFiles,
        },
        async (event: WorkRunEvent) => {
          try {
            await this.handleRunEvent(
              runId,
              payload.accountId,
              payload.providerId,
              event,
              pendingToolCalls,
            );
          } catch (err) {
            console.error(
              `[RunsService] Error handling event for run ${runId}:`,
              err,
            );
          }
        },
      );

      // 7. Handle completion in background
      runPromise
        .then(async (result) => {
          const finalStatus: RunStatus =
            result.status === "succeeded"
              ? "succeeded"
              : result.status === "canceled"
                ? "canceled"
                : "failed";

          await runsRepo.updateRun(runId, {
            status: finalStatus,
            endedAt: new Date(),
            lastError: result.status === "failed" ? result.summary : undefined,
            stopReason: result.stopReason ?? null,
          });

          // Persist git diff on success
          if (finalStatus === "succeeded") {
            await persistRunDiff(runId, workspace.id, workspace.rootPath);
          } else {
            runBaseRefs.delete(runId);
          }
          await closeActiveTurn(runId, result.usage);
          cleanupTurnState(runId);
          sendRunNotification(runId, finalStatus);
          releaseSleepBlocker(runId);
        })
        .catch(async (error) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`[RunsService] Run ${runId} failed:`, errorMessage);

          runBaseRefs.delete(runId);

          await runsRepo.updateRun(runId, {
            status: "failed",
            endedAt: new Date(),
            lastError: errorMessage,
          });

          await closeActiveTurn(runId);
          cleanupTurnState(runId);
          sendRunNotification(runId, "failed");
          releaseSleepBlocker(runId);
        });

      // Return immediately with runId
      return { success: true, data: { runId } };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[RunsService] Failed to execute run:`, errorMessage);

      runBaseRefs.delete(runId);
      releaseSleepBlocker(runId);

      // Try to mark run as failed if it was created
      try {
        await runsRepo.updateRun(runId, {
          status: "failed",
          endedAt: new Date(),
          lastError: errorMessage,
        });
      } catch {
        // Ignore cleanup errors
      }

      return { success: false, error: errorMessage };
    }
  },

  /**
   * Handle events emitted during a run
   */
  async handleRunEvent(
    runId: string,
    accountId: string,
    providerId: string,
    event: WorkRunEvent,
    pendingToolCalls: Map<string, number>,
  ): Promise<void> {
    switch (event.type) {
      case "log": {
        // Store logs as artifacts with kind="log"
        await runsRepo.insertArtifact({
          runId,
          kind: "log",
          content: event.message,
          metadata: {
            level: event.level,
            ts: event.ts,
          },
        });
        break;
      }

      case "tool_call": {
        const phase = (event.metadata as Record<string, unknown> | undefined)
          ?.phase;

        if (phase === "start") {
          // Create tool call record
          const toolCallId = await runsRepo.insertToolCall({
            accountId,
            runId,
            providerId,
            toolName: event.toolName,
            status: "running",
            input: event.input,
            startedAt: event.startedAt ? new Date(event.startedAt) : new Date(),
          });

          // Track for later update using toolCallId from metadata if available
          const metadataToolCallId = (
            event.metadata as Record<string, unknown> | undefined
          )?.toolCallId;
          const callKey = metadataToolCallId
            ? String(metadataToolCallId)
            : `${event.toolName}-${event.startedAt || Date.now()}`;
          pendingToolCalls.set(callKey, toolCallId);
        } else if (phase === "end" || phase === "complete") {
          // Find the pending tool call using toolCallId from metadata first
          const metadataToolCallId = (
            event.metadata as Record<string, unknown> | undefined
          )?.toolCallId;
          let callKey: string | undefined;

          if (metadataToolCallId) {
            callKey = String(metadataToolCallId);
            if (!pendingToolCalls.has(callKey)) {
              // Try fallback to toolName-based key
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
              event.startedAt && event.endedAt
                ? event.endedAt - event.startedAt
                : undefined;

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
          // If no pending call found, skip - don't create duplicate records
          // The start event should always come first
        }
        break;
      }


      case "artifact": {
        await runsRepo.insertArtifact({
          runId,
          kind: event.kind as
            | "patch"
            | "file"
            | "log"
            | "report"
            | "command_result"
            | "result",
          path: event.path,
          content: event.content,
          contentHash: event.content ? hashContent(event.content) : undefined,
          metadata: event.metadata,
        });

        // Turn tracking: new user-prompt → start new turn
        const artifactKind = (event.metadata as Record<string, unknown> | undefined)?.kind;
        if (artifactKind === "user-prompt") {
          await startNewTurn(runId, event.content);
        }
        // Turn tracking: result → append response content
        if (artifactKind === "result" && event.content) {
          const turnId = activeTurnIds.get(runId);
          if (turnId !== undefined) {
            try {
              await runsRepo.appendResponseContent(turnId, event.content);
            } catch (err) {
              console.error(`[RunsService] Failed to append response for turn ${turnId}:`, err);
            }
          }
        }
        break;
      }

      case "status": {
        // Status changes are handled by the main run promise
        // Log them for debugging
        console.log(`[RunsService] Run ${runId} status event: ${event.status}`);
        break;
      }
    }
  },

  /**
   * Abort a running run
   */
  async abortRun(runId: string): Promise<ServiceResponse<void>> {
    try {
      const run = await runsRepo.findRunById(runId);
      if (!run) {
        return { success: false, error: "Run not found" };
      }

      if (run.status !== "running") {
        return {
          success: false,
          error: `Run is not running (status: ${run.status})`,
        };
      }

      // Get provider and abort via adapter
      const provider = await providersRepo.findById(run.providerId);
      if (provider) {
        try {
          const adapter = createWorkAdapter(provider);
          if (adapter.abortRun) {
            await adapter.abortRun(runId);
          }
        } catch (err) {
          console.error(`[RunsService] Error aborting via adapter:`, err);
        }
      }

      // Update run status
      await runsRepo.updateRun(runId, {
        status: "canceled",
        endedAt: new Date(),
        lastError: "Aborted by user",
      });

      await closeActiveTurn(runId);
      cleanupTurnState(runId);
      releaseSleepBlocker(runId);

      return { success: true };
    } catch (error) {
      console.error(`[RunsService] Failed to abort run ${runId}:`, error);
      return { success: false, error: "Failed to abort run" };
    }
  },

  /**
   * Check if a run's session can be resumed
   */
  async canResumeRun(runId: string): Promise<ServiceResponse<boolean>> {
    try {
      const run = await runsRepo.findRunById(runId);
      if (!run) {
        return { success: false, error: "Run not found" };
      }

      // Can only resume runs that completed (succeeded, failed, or canceled)
      if (run.status === "running" || run.status === "queued") {
        return { success: true, data: false };
      }

      const provider = await providersRepo.findById(run.providerId);
      if (!provider) {
        return { success: true, data: false };
      }

      const adapter = createWorkAdapter(provider);
      if (!adapter.canResumeSession) {
        return { success: true, data: false };
      }

      const canResume = await adapter.canResumeSession(runId);
      return { success: true, data: canResume };
    } catch (error) {
      console.error(
        `[RunsService] Failed to check resume for run ${runId}:`,
        error,
      );
      return { success: false, error: "Failed to check resume capability" };
    }
  },

  /**
   * Continue an existing run by resuming its session
   */
  async continueRun(
    payload: ContinueRunPayload,
  ): Promise<ServiceResponse<ContinueRunResponse>> {
    const { runId, accountId, message, additionalContext } = payload;

    try {
      // 1. Load existing run
      const run = await runsRepo.findRunById(runId);
      if (!run) {
        return { success: false, error: "Run not found" };
      }

      // 2. Verify ownership
      if (run.accountId !== accountId) {
        return { success: false, error: "Run does not belong to this account" };
      }

      // 3. Load provider
      const provider = await providersRepo.findById(run.providerId);
      if (!provider) {
        return {
          success: false,
          error: `Provider "${run.providerId}" not found`,
        };
      }
      if (!provider.isEnabled) {
        return {
          success: false,
          error: `Provider "${provider.displayName}" is not enabled`,
        };
      }

      // 4. Load workspace
      const workspace = run.workspaceId
        ? await workspacesRepo.findById(run.workspaceId)
        : null;

      // 5. Create adapter and check if it supports resume
      const adapter = createWorkAdapter(provider);
      if (!adapter.continueRun) {
        return {
          success: false,
          error: "Provider does not support session resumption",
        };
      }

      // 6. Check if session can be resumed
      if (adapter.canResumeSession) {
        const canResume = await adapter.canResumeSession(runId);
        if (!canResume) {
          return {
            success: false,
            error: "Session cannot be resumed (not found or expired)",
          };
        }
      }

      // Transition workspace to in_progress when run continues
      if (workspace) {
        await workspacesRepo.update(workspace.id, { status: "in_progress" });
      }

      // 7. Update run status to running
      await runsRepo.updateRun(runId, {
        status: "running",
        startedAt: new Date(),
        endedAt: null,
        lastError: null,
      });

      // Capture git HEAD sha at continue start for diff computation
      if (workspace) {
        await captureBaseRef(runId, workspace.rootPath);
      }

      // Recover turn counter from existing turns and start new turn
      const existingTurns = await runsRepo.findTurnsByRun(runId);
      const maxIndex = existingTurns.reduce((max, t) => Math.max(max, t.turnIndex), -1);
      turnCounters.set(runId, maxIndex);
      await startNewTurn(runId, message);

      // 8. Add any additional context
      if (additionalContext && additionalContext.length > 0) {
        for (const ctx of additionalContext) {
          await runsRepo.insertContext({
            runId,
            kind: ctx.kind as "file" | "selection" | "diff" | "note",
            ref: ctx.ref,
            content: ctx.content,
            contentHash: ctx.content ? hashContent(ctx.content) : undefined,
            metadata: ctx.metadata,
          });
        }
      }

      // Track tool calls for updating when completed
      const pendingToolCalls = new Map<string, number>();

      // 9. Acquire sleep blocker if enabled
      await acquireSleepBlocker(runId);

      // 10. Continue the run
      const runPromise = adapter.continueRun(
        {
          runId,
          accountId,
          workspace: workspace
            ? { id: workspace.id, rootPath: workspace.rootPath }
            : { id: "", rootPath: process.cwd() },
          message,
          context: additionalContext as any,
          attachments: payload.attachments,
          contextIssues: payload.contextIssues,
          contextFiles: payload.contextFiles,
        },
        async (event) => {
          try {
            await this.handleRunEvent(
              runId,
              accountId,
              run.providerId,
              event,
              pendingToolCalls,
            );
          } catch (err) {
            console.error(
              `[RunsService] Error handling event for run ${runId}:`,
              err,
            );
          }
        },
      );

      // 10. Handle completion in background
      runPromise
        .then(async (result) => {
          const finalStatus: RunStatus =
            result.status === "succeeded"
              ? "succeeded"
              : result.status === "canceled"
                ? "canceled"
                : "failed";

          await runsRepo.updateRun(runId, {
            status: finalStatus,
            endedAt: new Date(),
            lastError: result.status === "failed" ? result.summary : undefined,
            stopReason: result.stopReason ?? null,
          });

          // Persist git diff on success
          if (finalStatus === "succeeded" && workspace) {
            await persistRunDiff(runId, workspace.id, workspace.rootPath);
          } else {
            runBaseRefs.delete(runId);
          }

          console.log(
            `[RunsService] Continued run ${runId} completed with status: ${finalStatus}`,
          );

          await closeActiveTurn(runId, result.usage);
          cleanupTurnState(runId);
          sendRunNotification(runId, finalStatus);
          releaseSleepBlocker(runId);
        })
        .catch(async (error) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[RunsService] Continued run ${runId} failed:`,
            errorMessage,
          );

          runBaseRefs.delete(runId);

          await runsRepo.updateRun(runId, {
            status: "failed",
            endedAt: new Date(),
            lastError: errorMessage,
          });

          await closeActiveTurn(runId);
          cleanupTurnState(runId);
          sendRunNotification(runId, "failed");
          releaseSleepBlocker(runId);
        });

      return { success: true, data: { runId, resumed: true } };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[RunsService] Failed to continue run:`, errorMessage);

      runBaseRefs.delete(runId);
      await closeActiveTurn(runId);
      cleanupTurnState(runId);
      releaseSleepBlocker(runId);

      // Try to reset run status if it was updated
      try {
        await runsRepo.updateRun(runId, {
          status: "failed",
          endedAt: new Date(),
          lastError: errorMessage,
        });
      } catch {
        // Ignore cleanup errors
      }

      return { success: false, error: errorMessage };
    }
  },

  /**
   * Fork an existing run's session into a new run.
   * Creates a new run that branches from the source run's session state.
   */
  async forkRun(
    payload: ForkRunPayload,
  ): Promise<ServiceResponse<ForkRunResponse>> {
    const { sourceRunId, accountId, message } = payload;
    const newRunId = generateRunId();

    try {
      // 1. Load source run
      const sourceRun = await runsRepo.findRunById(sourceRunId);
      if (!sourceRun) {
        return { success: false, error: "Source run not found" };
      }

      // 2. Verify ownership
      if (sourceRun.accountId !== accountId) {
        return { success: false, error: "Source run does not belong to this account" };
      }

      // 3. Load provider
      const provider = await providersRepo.findById(sourceRun.providerId);
      if (!provider) {
        return {
          success: false,
          error: `Provider "${sourceRun.providerId}" not found`,
        };
      }
      if (!provider.isEnabled) {
        return {
          success: false,
          error: `Provider "${provider.displayName}" is not enabled`,
        };
      }

      // 4. Load workspace
      const workspace = sourceRun.workspaceId
        ? await workspacesRepo.findById(sourceRun.workspaceId)
        : null;

      // 5. Create adapter and check if it supports forkRun
      const adapter = createWorkAdapter(provider);
      if (!adapter.forkRun) {
        return {
          success: false,
          error: "Provider does not support session forking",
        };
      }

      // 6. Check if source session exists
      if (adapter.canResumeSession) {
        const canResume = await adapter.canResumeSession(sourceRunId);
        if (!canResume) {
          return {
            success: false,
            error: "Source session cannot be forked (not found or expired)",
          };
        }
      }

      // Transition workspace to in_progress
      if (workspace) {
        await workspacesRepo.update(workspace.id, { status: "in_progress" });
      }

      // 7. Create new run record
      await runsRepo.insertRun({
        id: newRunId,
        accountId,
        workspaceId: sourceRun.workspaceId ?? undefined,
        spaceId: sourceRun.spaceId ?? undefined,
        providerId: sourceRun.providerId,
        model: sourceRun.model ?? undefined,
        goal: message,
        status: "running",
        systemPrompt: sourceRun.systemPrompt ?? undefined,
      });

      // Capture git HEAD sha for diff computation
      if (workspace) {
        await captureBaseRef(newRunId, workspace.rootPath);
      }

      // Track tool calls for updating when completed
      const pendingToolCalls = new Map<string, number>();

      // Create initial turn for forked run
      await createInitialTurn(newRunId, message);

      // 8. Acquire sleep blocker
      await acquireSleepBlocker(newRunId);

      // 9. Generate title in background
      generateRunTitle(newRunId, adapter, message).catch((err) =>
        console.error(`[RunsService] Title generation failed for forked run ${newRunId}:`, err),
      );

      // 10. Fork the run
      const runPromise = adapter.forkRun(
        {
          runId: newRunId,
          sourceRunId,
          accountId,
          workspace: workspace
            ? { id: workspace.id, rootPath: workspace.rootPath }
            : { id: "", rootPath: process.cwd() },
          message,
          context: payload.additionalContext as any,
          attachments: payload.attachments,
        },
        async (event) => {
          try {
            await this.handleRunEvent(
              newRunId,
              accountId,
              sourceRun.providerId,
              event,
              pendingToolCalls,
            );
          } catch (err) {
            console.error(
              `[RunsService] Error handling event for forked run ${newRunId}:`,
              err,
            );
          }
        },
      );

      // 11. Handle completion in background
      runPromise
        .then(async (result) => {
          const finalStatus: RunStatus =
            result.status === "succeeded"
              ? "succeeded"
              : result.status === "canceled"
                ? "canceled"
                : "failed";

          await runsRepo.updateRun(newRunId, {
            status: finalStatus,
            endedAt: new Date(),
            lastError: result.status === "failed" ? result.summary : undefined,
            stopReason: result.stopReason ?? null,
          });

          // Persist git diff on success
          if (finalStatus === "succeeded" && workspace) {
            await persistRunDiff(newRunId, workspace.id, workspace.rootPath);
          } else {
            runBaseRefs.delete(newRunId);
          }

          console.log(
            `[RunsService] Forked run ${newRunId} (from ${sourceRunId}) completed with status: ${finalStatus}`,
          );

          await closeActiveTurn(newRunId, result.usage);
          cleanupTurnState(newRunId);
          sendRunNotification(newRunId, finalStatus);
          releaseSleepBlocker(newRunId);
        })
        .catch(async (error) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[RunsService] Forked run ${newRunId} failed:`,
            errorMessage,
          );

          runBaseRefs.delete(newRunId);

          await runsRepo.updateRun(newRunId, {
            status: "failed",
            endedAt: new Date(),
            lastError: errorMessage,
          });

          await closeActiveTurn(newRunId);
          cleanupTurnState(newRunId);
          sendRunNotification(newRunId, "failed");
          releaseSleepBlocker(newRunId);
        });

      return { success: true, data: { runId: newRunId, sourceRunId } };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[RunsService] Failed to fork run:`, errorMessage);

      runBaseRefs.delete(newRunId);
      await closeActiveTurn(newRunId);
      cleanupTurnState(newRunId);
      releaseSleepBlocker(newRunId);

      // Try to reset run status
      try {
        await runsRepo.updateRun(newRunId, {
          status: "failed",
          endedAt: new Date(),
          lastError: errorMessage,
        });
      } catch {
        // Ignore cleanup errors
      }

      return { success: false, error: errorMessage };
    }
  },

  /**
   * Get turns for a run
   */
  async getTurnsByRun(
    runId: string,
  ): Promise<ServiceResponse<RunTurnResponse[]>> {
    try {
      const turns = await runsRepo.findTurnsByRun(runId);
      return { success: true, data: turns };
    } catch (error) {
      console.error(`[RunsService] Failed to get turns for run ${runId}:`, error);
      return { success: false, error: "Failed to get run turns" };
    }
  },

  /**
   * Delete a run's persisted session
   */
  async deleteRunSession(runId: string): Promise<ServiceResponse<void>> {
    try {
      const run = await runsRepo.findRunById(runId);
      if (!run) {
        return { success: false, error: "Run not found" };
      }

      const provider = await providersRepo.findById(run.providerId);
      if (!provider) {
        return { success: true }; // No provider, nothing to delete
      }

      const adapter = createWorkAdapter(provider);
      if (adapter.deleteSession) {
        await adapter.deleteSession(runId);
      }

      return { success: true };
    } catch (error) {
      console.error(
        `[RunsService] Failed to delete session for run ${runId}:`,
        error,
      );
      return { success: false, error: "Failed to delete session" };
    }
  },
};

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

function generateRunId(): string {
  // UUID v4 format
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
 * Merge untracked file stats into a git shortstat string.
 * git diff --shortstat only covers tracked files, so new (untracked) files
 * and their insertions are missing from the shortstat output.
 *
 * Input shortstat format: "N file(s) changed, X insertion(s)(+), Y deletion(s)(-)"
 * Any part may be missing if count is 0.
 */
function mergeUntrackedIntoShortstat(shortstat: string, newFileCount: number, newInsertions: number): string {
  if (newFileCount === 0 && newInsertions === 0) return shortstat;

  // Parse existing values from shortstat
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
