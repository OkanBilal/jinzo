import { runsRepo } from "./runs.repo";
import { providersRepo } from "../providers/providers.repo";
import { workspacesRepo } from "../workspaces/workspaces.repo";
import { gitService } from "../git/git.service";
import { reviewsService } from "../reviews/reviews.service";
import {
  createWorkAdapter,
  type WorkRunEvent,
  type WorkRunContextItem,
} from "../providers/adapters";
import type {
  CreateRunPayload,
  UpdateRunPayload,
  RunResponse,
  CreateRunContextPayload,
  RunContextResponse,
  CreateRunArtifactPayload,
  RunArtifactResponse,
  CreateRunCommandPayload,
  UpdateRunCommandPayload,
  RunCommandResponse,
  CreateToolCallPayload,
  UpdateToolCallPayload,
  ToolCallResponse,
  ServiceResponse,
  RunStatus,
  StartRunPayload,
  StartRunResponse,
  ContinueRunPayload,
  ContinueRunResponse,
  RunDetailsResponse,
} from "./runs.dto";
import { createHash } from "crypto";

// In-memory map: runId -> git HEAD sha captured at run start
const runBaseRefs = new Map<string, string>();

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

/**
 * Compute git diff since baseRef and persist into run_diffs.
 * Called after a run succeeds.
 */
async function persistRunDiff(runId: string, rootPath: string): Promise<void> {
  const baseRef = runBaseRefs.get(runId);
  runBaseRefs.delete(runId);

  if (!baseRef) return;

  try {
    const [diffResult, filesResult, statResult] = await Promise.all([
      gitService.getDiffSince(rootPath, baseRef),
      gitService.getChangedFilesSince(rootPath, baseRef),
      gitService.getShortStatSince(rootPath, baseRef),
    ]);

    const diffText = diffResult.success ? (diffResult.data ?? "") : "";
    const files = filesResult.success ? (filesResult.data ?? []) : [];
    const shortstat = statResult.success ? (statResult.data ?? "") : "";

    await runsRepo.insertRunDiff({
      id: generateRunId(),
      runId,
      baseRef,
      diffText,
      filesJson: JSON.stringify(files),
      statsJson: JSON.stringify({ shortstat, files: files.length }),
    });
  } catch (err) {
    console.error(`[RunsService] Failed to persist run diff for ${runId}:`, err);
  }
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
  // Run Command Operations
  // ─────────────────────────────────────────────────────────────
  async getCommandsByRun(
    runId: string,
  ): Promise<ServiceResponse<RunCommandResponse[]>> {
    try {
      const commands = await runsRepo.findCommandsByRun(runId);
      return { success: true, data: commands };
    } catch (error) {
      console.error(
        `[RunsService] Failed to get commands for run ${runId}:`,
        error,
      );
      return { success: false, error: "Failed to get commands" };
    }
  },

  async addCommand(
    payload: CreateRunCommandPayload,
  ): Promise<ServiceResponse<number>> {
    try {
      const id = await runsRepo.insertCommand(payload);
      return { success: true, data: id };
    } catch (error) {
      console.error("[RunsService] Failed to add command:", error);
      return { success: false, error: "Failed to add command" };
    }
  },

  async updateCommand(
    id: number,
    payload: UpdateRunCommandPayload,
  ): Promise<ServiceResponse<void>> {
    try {
      await runsRepo.updateCommand(id, payload);
      return { success: true };
    } catch (error) {
      console.error(`[RunsService] Failed to update command ${id}:`, error);
      return { success: false, error: "Failed to update command" };
    }
  },

  async startCommand(id: number): Promise<ServiceResponse<void>> {
    return this.updateCommand(id, { status: "running", startedAt: new Date() });
  },

  async completeCommand(
    id: number,
    exitCode: number,
    stdout?: string,
    stderr?: string,
  ): Promise<ServiceResponse<void>> {
    return this.updateCommand(id, {
      status: exitCode === 0 ? "done" : "error",
      endedAt: new Date(),
      exitCode,
      stdout,
      stderr,
    });
  },

  async removeCommand(id: number): Promise<ServiceResponse<void>> {
    try {
      await runsRepo.deleteCommand(id);
      return { success: true };
    } catch (error) {
      console.error(`[RunsService] Failed to remove command ${id}:`, error);
      return { success: false, error: "Failed to remove command" };
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

      const [context, artifacts, commands, toolCalls] = await Promise.all([
        runsRepo.findContextByRun(runId),
        runsRepo.findArtifactsByRun(runId),
        runsRepo.findCommandsByRun(runId),
        runsRepo.findToolCallsByRun(runId),
      ]);

      return {
        success: true,
        data: {
          run,
          context,
          artifacts,
          commands,
          toolCalls,
        },
      };
    } catch (error) {
      console.error(`[RunsService] Failed to get run details ${runId}:`, error);
      return { success: false, error: "Failed to get run details" };
    }
  },

  // ─────────────────────────────────────────────────────────────
  // Run Diff Operations
  // ─────────────────────────────────────────────────────────────
  async getRunDiff(
    runId: string,
  ): Promise<ServiceResponse<import("./runs.dto").RunDiffResponse>> {
    try {
      const diff = await runsRepo.findRunDiffByRun(runId);
      if (!diff) {
        return { success: false, error: "No diff found for this run" };
      }
      return { success: true, data: diff };
    } catch (error) {
      console.error(`[RunsService] Failed to get run diff ${runId}:`, error);
      return { success: false, error: "Failed to get run diff" };
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

      // 3. Create run record with status=running
      const createPayload: CreateRunPayload = {
        id: runId,
        accountId: payload.accountId,
        workspaceId: payload.workspaceId,
        moodId: payload.moodId,
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

      // Track tool calls for updating when completed
      const pendingToolCalls = new Map<string, number>();

      // 6. Start run with event handler (runs in background)
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
            await persistRunDiff(runId, workspace.rootPath);
          } else {
            runBaseRefs.delete(runId);
          }
         // TODO: hasReviewSkill too strict 
          // Auto-create review if the run used the review-code skill
          try {
            const toolCallRecords = await runsRepo.findToolCallsByRun(runId);
            const hasReviewSkill = toolCallRecords.some((tc) => {
              if (tc.toolName !== "Skill") return false;
              const input = tc.input as Record<string, unknown> | null;
              return input?.skill === "review-code";
            });

            if (hasReviewSkill) {
              const artifacts = await runsRepo.findArtifactsByRun(runId);
              const resultArtifact = [...artifacts]
                .reverse()
                .find((a) => a.kind === "report");

              if (resultArtifact?.content) {
                const firstLine = resultArtifact.content.split("\n")[0] || "";
                const title = firstLine.replace(/^#+\s*/, "").slice(0, 120) || "Code Review";

                await reviewsService.create({
                  workspaceId: payload.workspaceId,
                  runId,
                  title,
                  summary: resultArtifact.content,
                  status: "open",
                });
              }
            }
          } catch (err) {
            console.error(`[RunsService] Failed to auto-create review for run ${runId}:`, err);
          }

          console.log(
            `[RunsService] Run ${runId} completed with status: ${finalStatus}`,
          );
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
        });

      // Return immediately with runId
      return { success: true, data: { runId } };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[RunsService] Failed to execute run:`, errorMessage);

      runBaseRefs.delete(runId);

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

      case "command": {
        // Insert command record
        const commandId = await runsRepo.insertCommand({
          runId,
          cwd: event.cwd,
          command: event.command,
          status:
            event.exitCode !== undefined
              ? event.exitCode === 0
                ? "done"
                : "error"
              : "done",
        });

        // Update with results
        await runsRepo.updateCommand(commandId, {
          stdout: event.stdout,
          stderr: event.stderr,
          exitCode: event.exitCode,
          startedAt: event.startedAt ? new Date(event.startedAt) : undefined,
          endedAt: event.endedAt ? new Date(event.endedAt) : new Date(),
          metadata: event.metadata,
        });
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

      // 9. Continue the run
      const runPromise = adapter.continueRun(
        {
          runId,
          accountId,
          workspace: workspace
            ? { id: workspace.id, rootPath: workspace.rootPath }
            : { id: "", rootPath: process.cwd() },
          message,
          context: additionalContext as any,
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
            await persistRunDiff(runId, workspace.rootPath);
          } else {
            runBaseRefs.delete(runId);
          }

          console.log(
            `[RunsService] Continued run ${runId} completed with status: ${finalStatus}`,
          );
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
        });

      return { success: true, data: { runId, resumed: true } };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[RunsService] Failed to continue run:`, errorMessage);

      runBaseRefs.delete(runId);

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
