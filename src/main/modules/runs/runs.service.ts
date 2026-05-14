import { BrowserWindow } from "electron";
import { createHash } from "crypto";

import { runsRepo } from "./runs.repo";
import { providersRepo } from "../providers/providers.repo";
import { workspacesRepo } from "../workspaces/workspaces.repo";
import {
  createWorkAdapter,
  type WorkRunContextItem,
  type WorkRunAdapter,
  type WorkRunEvent,
} from "../providers/adapters";
import type { WorkRunResult } from "../../../shared/adapter.types";
import { createRunSession, type RunSession, type RunSessionResult } from "./run-session";
import { runSessionRegistry } from "./run-session-registry";
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
  ReviewRunPayload,
  RunDetailsResponse,
  RunTurnResponse,
} from "./runs.dto";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function generateRunId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").substring(0, 16);
}

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

/** Broadcast statusChanged for runs that fail before a session is created. */
function broadcastStatusChangedPreSession(runId: string, status: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("runs:statusChanged", { runId, status, ts: Date.now() });
    }
  }
}

/** Wire an adapter run promise to session.finalize. Idempotent on both sides. */
function wireSessionCompletion(
  runPromise: Promise<WorkRunResult>,
  session: RunSession,
): void {
  runPromise
    .then((result) => {
      const status: RunSessionResult["status"] =
        result.status === "succeeded"
          ? "succeeded"
          : result.status === "canceled"
            ? "canceled"
            : "failed";
      return session.finalize({
        status,
        summary: result.status === "failed" ? result.summary : undefined,
        stopReason: result.stopReason,
        usage: result.usage,
      });
    })
    .catch((err) =>
      session.finalize({
        status: "failed",
        summary: err instanceof Error ? err.message : String(err),
      }),
    );
}

/**
 * Pre-session failure recovery — the orchestrator threw before adapter wiring.
 * If a session somehow registered, finalize it; else write status directly.
 */
async function handlePreSessionFailure(runId: string, error: unknown): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[RunsService] Pre-session failure for ${runId}:`, errorMessage);
  const session = runSessionRegistry.get(runId);
  if (session) {
    await session.finalize({ status: "failed", summary: errorMessage });
    return;
  }
  try {
    await runsRepo.updateRun(runId, {
      status: "failed",
      endedAt: new Date(),
      lastError: errorMessage,
    });
  } catch {
    // Run row may not exist yet — ignore
  }
  broadcastStatusChangedPreSession(runId, "failed");
}

// ─────────────────────────────────────────────────────────────
// Runs Service
// ─────────────────────────────────────────────────────────────
export const runsService = {
  // ─── Run Operations ───
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
      if (!run) return { success: false, error: "Run not found" };
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
      console.error(`[RunsService] Failed to get runs for account ${accountId}:`, error);
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
      console.error(`[RunsService] Failed to get runs for workspace ${workspaceId}:`, error);
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
      if (!updated) return { success: false, error: "Run not found" };
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

  async failRun(id: string, error: string): Promise<ServiceResponse<RunResponse>> {
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
      if (!archived) return { success: false, error: "Run not found" };
      return { success: true, data: archived };
    } catch (error) {
      console.error(`[RunsService] Failed to archive run ${id}:`, error);
      return { success: false, error: "Failed to archive run" };
    }
  },

  // ─── Run Context Operations ───
  async getContextByRun(runId: string): Promise<ServiceResponse<RunContextResponse[]>> {
    try {
      const contexts = await runsRepo.findContextByRun(runId);
      return { success: true, data: contexts };
    } catch (error) {
      console.error(`[RunsService] Failed to get context for run ${runId}:`, error);
      return { success: false, error: "Failed to get context" };
    }
  },

  async addContext(payload: CreateRunContextPayload): Promise<ServiceResponse<number>> {
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

  // ─── Run Artifact Operations ───
  async getArtifactsByRun(runId: string): Promise<ServiceResponse<RunArtifactResponse[]>> {
    try {
      const artifacts = await runsRepo.findArtifactsByRun(runId);
      return { success: true, data: artifacts };
    } catch (error) {
      console.error(`[RunsService] Failed to get artifacts for run ${runId}:`, error);
      return { success: false, error: "Failed to get artifacts" };
    }
  },

  async addArtifact(payload: CreateRunArtifactPayload): Promise<ServiceResponse<number>> {
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

  // ─── Tool Call Operations ───
  async getToolCallsByRun(runId: string): Promise<ServiceResponse<ToolCallResponse[]>> {
    try {
      const toolCalls = await runsRepo.findToolCallsByRun(runId);
      return { success: true, data: toolCalls };
    } catch (error) {
      console.error(`[RunsService] Failed to get tool calls for run ${runId}:`, error);
      return { success: false, error: "Failed to get tool calls" };
    }
  },

  async addToolCall(payload: CreateToolCallPayload): Promise<ServiceResponse<number>> {
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

  // ─── Composite Read ───
  async getRunDetails(runId: string): Promise<ServiceResponse<RunDetailsResponse>> {
    try {
      const run = await runsRepo.findRunById(runId);
      if (!run) return { success: false, error: "Run not found" };
      const [context, artifacts, toolCalls, turns] = await Promise.all([
        runsRepo.findContextByRun(runId),
        runsRepo.findArtifactsByRun(runId),
        runsRepo.findToolCallsByRun(runId),
        runsRepo.findTurnsByRun(runId),
      ]);
      return {
        success: true,
        data: { run, context, artifacts, toolCalls, turns },
      };
    } catch (error) {
      console.error(`[RunsService] Failed to get run details ${runId}:`, error);
      return { success: false, error: "Failed to get run details" };
    }
  },

  // ─── Orchestrators ───

  /**
   * Start a new run. Validates provider+workspace, creates the run row,
   * persists initial context, then spawns a RunSession wired to the adapter.
   * The session owns the lifecycle from here on; this method returns immediately.
   */
  async executeRun(payload: StartRunPayload): Promise<ServiceResponse<StartRunResponse>> {
    const runId = generateRunId();
    try {
      const provider = await providersRepo.findById(payload.providerId);
      if (!provider) {
        return { success: false, error: `Provider "${payload.providerId}" not found` };
      }
      if (!provider.isEnabled) {
        return { success: false, error: `Provider "${provider.displayName}" is not enabled` };
      }
      if (provider.kind !== "agent_runtime") {
        return {
          success: false,
          error: `Provider "${provider.displayName}" is not an agent runtime`,
        };
      }

      const workspace = await workspacesRepo.findById(payload.workspaceId);
      if (!workspace) {
        return { success: false, error: `Workspace "${payload.workspaceId}" not found` };
      }

      await workspacesRepo.update(payload.workspaceId, { status: "in_progress" });

      await runsRepo.insertRun({
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
      });
      await runsRepo.updateRun(runId, { startedAt: new Date() });

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

      const session = createRunSession({
        runId,
        accountId: payload.accountId,
        providerId: payload.providerId,
        workspace: { id: workspace.id, rootPath: workspace.rootPath },
        initialPromptContent: payload.goal,
      });

      const adapter = createWorkAdapter(provider);
      generateRunTitle(runId, adapter, payload.goal, payload.initialContext).catch((err) =>
        console.error(`[RunsService] Title generation failed for ${runId}:`, err),
      );

      const runPromise = adapter.startRun(
        {
          runId,
          accountId: payload.accountId,
          workspace: { id: workspace.id, rootPath: workspace.rootPath },
          goal: payload.goal,
          model: payload.model,
          systemPrompt: payload.systemPrompt,
          context: payload.initialContext as WorkRunContextItem[] | undefined,
          toolPolicy: payload.toolPolicySnapshot,
          configSnapshot: payload.configSnapshot ?? null,
          attachments: payload.attachments,
          contextIssues: payload.contextIssues,
          contextSignals: payload.contextSignals,
          contextFiles: payload.contextFiles,
          skills: payload.contextSkills,
        },
        (event: WorkRunEvent) =>
          session.project(event).catch((err) =>
            console.error(`[RunsService] project failed for ${runId}:`, err),
          ),
      );

      wireSessionCompletion(runPromise, session);

      return { success: true, data: { runId } };
    } catch (error) {
      await handlePreSessionFailure(runId, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Run a code review. Same shape as executeRun, but uses adapter.reviewRun
   * (with adapter.startRun as fallback). Workspace status transitions to in_review.
   */
  async executeReview(
    payload: ReviewRunPayload,
  ): Promise<ServiceResponse<StartRunResponse>> {
    const runId = generateRunId();
    try {
      const provider = await providersRepo.findById(payload.providerId);
      if (!provider) {
        return { success: false, error: `Provider "${payload.providerId}" not found` };
      }
      if (!provider.isEnabled) {
        return { success: false, error: `Provider "${provider.displayName}" is not enabled` };
      }
      if (provider.kind !== "agent_runtime") {
        return {
          success: false,
          error: `Provider "${provider.displayName}" is not an agent runtime`,
        };
      }

      const workspace = await workspacesRepo.findById(payload.workspaceId);
      if (!workspace) {
        return { success: false, error: `Workspace "${payload.workspaceId}" not found` };
      }

      await workspacesRepo.update(payload.workspaceId, { status: "in_review" });

      const goalDescription = `Review ${
        payload.target.type === "uncommittedChanges"
          ? "uncommitted changes"
          : payload.target.type === "baseBranch"
            ? `changes vs ${payload.target.branch ?? "base branch"}`
            : payload.target.type === "commit"
              ? `commit ${payload.target.sha ?? ""}`
              : "code changes"
      }`;

      await runsRepo.insertRun({
        id: runId,
        accountId: payload.accountId,
        workspaceId: payload.workspaceId,
        spaceId: payload.spaceId,
        providerId: payload.providerId,
        model: payload.model,
        goal: goalDescription,
        status: "running",
        systemPrompt: payload.systemPrompt,
        configSnapshot: payload.configSnapshot,
        toolPolicySnapshot: payload.toolPolicySnapshot,
      });
      await runsRepo.updateRun(runId, { startedAt: new Date() });

      const session = createRunSession({
        runId,
        accountId: payload.accountId,
        providerId: payload.providerId,
        workspace: { id: workspace.id, rootPath: workspace.rootPath },
        initialPromptContent: goalDescription,
      });

      const adapter = createWorkAdapter(provider);

      const eventCallback = (event: WorkRunEvent) =>
        session.project(event).catch((err) =>
          console.error(`[RunsService] project failed for review run ${runId}:`, err),
        );

      let runPromise: Promise<WorkRunResult>;
      if (adapter.reviewRun) {
        runPromise = adapter.reviewRun(
          {
            runId,
            accountId: payload.accountId,
            workspace: { id: workspace.id, rootPath: workspace.rootPath },
            target: payload.target,
            delivery: payload.delivery,
            model: payload.model,
          },
          eventCallback,
        );
      } else {
        // Fallback: use startRun with a review goal text
        runPromise = adapter.startRun(
          {
            runId,
            accountId: payload.accountId,
            workspace: { id: workspace.id, rootPath: workspace.rootPath },
            goal: "review code changes in this workspace",
            model: payload.model,
            systemPrompt: payload.systemPrompt,
          },
          eventCallback,
        );
      }

      wireSessionCompletion(runPromise, session);

      return { success: true, data: { runId } };
    } catch (error) {
      await handlePreSessionFailure(runId, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Continue a previously-completed run, resuming the adapter session.
   * Un-finalizes the run row, recovers the turn counter from existing turns,
   * spawns a new RunSession (with seedTurnIndex so turns continue from the right index).
   */
  async continueRun(
    payload: ContinueRunPayload,
  ): Promise<ServiceResponse<ContinueRunResponse>> {
    const { runId, accountId, message, additionalContext } = payload;
    try {
      const run = await runsRepo.findRunById(runId);
      if (!run) return { success: false, error: "Run not found" };
      if (run.accountId !== accountId) {
        return { success: false, error: "Run does not belong to this account" };
      }

      const provider = await providersRepo.findById(run.providerId);
      if (!provider) {
        return { success: false, error: `Provider "${run.providerId}" not found` };
      }
      if (!provider.isEnabled) {
        return { success: false, error: `Provider "${provider.displayName}" is not enabled` };
      }

      const workspace = run.workspaceId
        ? await workspacesRepo.findById(run.workspaceId)
        : null;

      const adapter = createWorkAdapter(provider);
      if (!adapter.continueRun) {
        return { success: false, error: "Provider does not support session resumption" };
      }
      if (adapter.canResumeSession) {
        const canResume = await adapter.canResumeSession(runId);
        if (!canResume) {
          return {
            success: false,
            error: "Session cannot be resumed (not found or expired)",
          };
        }
      }

      const existingTurns = await runsRepo.findTurnsByRun(runId);
      const seedTurnIndex = existingTurns.reduce(
        (max, t) => Math.max(max, t.turnIndex),
        -1,
      );

      if (workspace) {
        await workspacesRepo.update(workspace.id, { status: "in_progress" });
      }

      await runsRepo.updateRun(runId, {
        status: "running",
        startedAt: new Date(),
        endedAt: null,
        lastError: null,
      });

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

      const workspaceCtx = workspace
        ? { id: workspace.id, rootPath: workspace.rootPath }
        : { id: "", rootPath: process.cwd() };

      const session = createRunSession({
        runId,
        accountId,
        providerId: run.providerId,
        workspace: workspaceCtx,
        initialPromptContent: message,
        seedTurnIndex,
      });

      const runPromise = adapter.continueRun(
        {
          runId,
          accountId,
          workspace: workspaceCtx,
          message,
          model: payload.model,
          context: additionalContext as any,
          attachments: payload.attachments,
          contextIssues: payload.contextIssues,
          contextSignals: payload.contextSignals,
          contextFiles: payload.contextFiles,
          skills: payload.contextSkills,
        },
        (event: WorkRunEvent) =>
          session.project(event).catch((err) =>
            console.error(`[RunsService] project failed for ${runId}:`, err),
          ),
      );

      wireSessionCompletion(runPromise, session);

      return { success: true, data: { runId, resumed: true } };
    } catch (error) {
      await handlePreSessionFailure(runId, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Fork a completed run's session into a new run that branches from the source.
   * Creates a new run row, then spawns a RunSession wired to adapter.forkRun.
   */
  async forkRun(payload: ForkRunPayload): Promise<ServiceResponse<ForkRunResponse>> {
    const { sourceRunId, accountId, message } = payload;
    const newRunId = generateRunId();
    try {
      const sourceRun = await runsRepo.findRunById(sourceRunId);
      if (!sourceRun) return { success: false, error: "Source run not found" };
      if (sourceRun.accountId !== accountId) {
        return { success: false, error: "Source run does not belong to this account" };
      }

      const provider = await providersRepo.findById(sourceRun.providerId);
      if (!provider) {
        return { success: false, error: `Provider "${sourceRun.providerId}" not found` };
      }
      if (!provider.isEnabled) {
        return { success: false, error: `Provider "${provider.displayName}" is not enabled` };
      }

      const workspace = sourceRun.workspaceId
        ? await workspacesRepo.findById(sourceRun.workspaceId)
        : null;

      const adapter = createWorkAdapter(provider);
      if (!adapter.forkRun) {
        return { success: false, error: "Provider does not support session forking" };
      }
      if (adapter.canResumeSession) {
        const canResume = await adapter.canResumeSession(sourceRunId);
        if (!canResume) {
          return {
            success: false,
            error: "Source session cannot be forked (not found or expired)",
          };
        }
      }

      if (workspace) {
        await workspacesRepo.update(workspace.id, { status: "in_progress" });
      }

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

      const workspaceCtx = workspace
        ? { id: workspace.id, rootPath: workspace.rootPath }
        : { id: "", rootPath: process.cwd() };

      const session = createRunSession({
        runId: newRunId,
        accountId,
        providerId: sourceRun.providerId,
        workspace: workspaceCtx,
        initialPromptContent: message,
      });

      generateRunTitle(newRunId, adapter, message).catch((err) =>
        console.error(`[RunsService] Title generation failed for forked run ${newRunId}:`, err),
      );

      const runPromise = adapter.forkRun(
        {
          runId: newRunId,
          sourceRunId,
          accountId,
          workspace: workspaceCtx,
          message,
          context: payload.additionalContext as any,
          attachments: payload.attachments,
        },
        (event: WorkRunEvent) =>
          session.project(event).catch((err) =>
            console.error(`[RunsService] project failed for forked run ${newRunId}:`, err),
          ),
      );

      wireSessionCompletion(runPromise, session);

      return { success: true, data: { runId: newRunId, sourceRunId } };
    } catch (error) {
      await handlePreSessionFailure(newRunId, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Abort a running run. Signals the adapter via the session; cleanup happens
   * on the completion path (session.finalize). Edge case: if the DB says
   * running but no live session is registered (process restart), write
   * status="canceled" directly.
   */
  async abortRun(runId: string): Promise<ServiceResponse<void>> {
    try {
      const run = await runsRepo.findRunById(runId);
      if (!run) return { success: false, error: "Run not found" };
      if (run.status !== "running") {
        return {
          success: false,
          error: `Run is not running (status: ${run.status})`,
        };
      }

      const session = runSessionRegistry.get(runId);
      if (session) {
        await session.abort();
        return { success: true };
      }

      // DB says running but no live session — process restart edge case.
      await runsRepo.updateRun(runId, {
        status: "canceled",
        endedAt: new Date(),
        lastError: "Run had no live session (likely process restart mid-run)",
      });
      broadcastStatusChangedPreSession(runId, "canceled");
      return { success: true };
    } catch (error) {
      console.error(`[RunsService] Failed to abort run ${runId}:`, error);
      return { success: false, error: "Failed to abort run" };
    }
  },

  // ─── Session inspection / deletion ───
  async canResumeRun(runId: string): Promise<ServiceResponse<boolean>> {
    try {
      const run = await runsRepo.findRunById(runId);
      if (!run) return { success: false, error: "Run not found" };

      // Can only resume runs that completed (succeeded, failed, or canceled)
      if (run.status === "running" || run.status === "queued") {
        return { success: true, data: false };
      }

      const provider = await providersRepo.findById(run.providerId);
      if (!provider) return { success: true, data: false };

      const adapter = createWorkAdapter(provider);
      if (!adapter.canResumeSession) return { success: true, data: false };

      const canResume = await adapter.canResumeSession(runId);
      return { success: true, data: canResume };
    } catch (error) {
      console.error(`[RunsService] Failed to check resume for run ${runId}:`, error);
      return { success: false, error: "Failed to check resume capability" };
    }
  },

  async getTurnsByRun(runId: string): Promise<ServiceResponse<RunTurnResponse[]>> {
    try {
      const turns = await runsRepo.findTurnsByRun(runId);
      return { success: true, data: turns };
    } catch (error) {
      console.error(`[RunsService] Failed to get turns for run ${runId}:`, error);
      return { success: false, error: "Failed to get run turns" };
    }
  },

  async deleteRunSession(runId: string): Promise<ServiceResponse<void>> {
    try {
      const run = await runsRepo.findRunById(runId);
      if (!run) return { success: false, error: "Run not found" };

      const provider = await providersRepo.findById(run.providerId);
      if (!provider) return { success: true }; // No provider, nothing to delete

      const adapter = createWorkAdapter(provider);
      if (adapter.deleteSession) {
        await adapter.deleteSession(runId);
      }
      return { success: true };
    } catch (error) {
      console.error(`[RunsService] Failed to delete session for run ${runId}:`, error);
      return { success: false, error: "Failed to delete session" };
    }
  },
};
