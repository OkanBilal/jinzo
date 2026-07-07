import { createHash } from "crypto";

import { runsRepo } from "./runs.repo";
import { providersRepo } from "../providers/providers.repo";
import { workspaceRepo } from "../workspace";
import {
  createWorkAdapter,
  type WorkRunContextItem,
  type WorkRunAdapter,
  type WorkRunEvent,
} from "../providers/adapters";
import type { WorkRunResult } from "../../../shared/adapter.types";
import { createRunSession, type RunSession, type RunSessionResult } from "./run-session";
import { emit } from "../../ipc-kit";
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
  } catch (err) {
    console.warn(`[RunsService] Title generation failed for ${runId}, using fallback:`, err);
    title = fallbackTitle(goal);
  }
  await runsRepo.updateRun(runId, { title });
}

/** Broadcast statusChanged for runs that fail before a session is created. */
function broadcastStatusChangedPreSession(runId: string, status: string): void {
  emit("runs:statusChanged", { runId, status, ts: Date.now() });
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
//
// Throw-style: methods return plain values and throw on failure; the
// ServiceResponse envelope is applied by handle() at the IPC seam.
// Single-item reads return null for absence; mutations on a missing
// target throw (see CONTEXT.md "absence rule").
// ─────────────────────────────────────────────────────────────
export const runsService = {
  // ─── Run Operations ───
  async getAllRuns(limit?: number): Promise<RunResponse[]> {
    return runsRepo.findAllRuns(limit);
  },

  async getRunById(id: string): Promise<RunResponse | null> {
    return runsRepo.findRunById(id);
  },

  async getRunsByAccount(
    accountId: string,
    limit?: number,
  ): Promise<RunResponse[]> {
    return runsRepo.findRunsByAccount(accountId, limit);
  },

  async getRunsByWorkspace(
    workspaceId: string,
    limit?: number,
  ): Promise<RunResponse[]> {
    return runsRepo.findRunsByWorkspace(workspaceId, limit);
  },

  async getRunsByStatus(
    accountId: string,
    status: RunStatus,
  ): Promise<RunResponse[]> {
    return runsRepo.findRunsByStatus(accountId, status);
  },

  async createRun(payload: CreateRunPayload): Promise<string> {
    return runsRepo.insertRun(payload);
  },

  async updateRun(id: string, payload: UpdateRunPayload): Promise<RunResponse> {
    const updated = await runsRepo.updateRun(id, payload);
    if (!updated) throw new Error("Run not found");
    return updated;
  },

  async startRun(id: string): Promise<RunResponse> {
    return this.updateRun(id, { status: "running", startedAt: new Date() });
  },

  async completeRun(id: string): Promise<RunResponse> {
    return this.updateRun(id, { status: "succeeded", endedAt: new Date() });
  },

  async failRun(id: string, error: string): Promise<RunResponse> {
    return this.updateRun(id, {
      status: "failed",
      endedAt: new Date(),
      lastError: error,
    });
  },

  async cancelRun(id: string): Promise<RunResponse> {
    return this.updateRun(id, { status: "canceled", endedAt: new Date() });
  },

  async deleteRun(id: string): Promise<void> {
    await runsRepo.deleteRun(id);
  },

  async archiveRun(id: string): Promise<RunResponse> {
    const archived = await runsRepo.archiveRun(id);
    if (!archived) throw new Error("Run not found");
    return archived;
  },

  // ─── Run Context Operations ───
  async getContextByRun(runId: string): Promise<RunContextResponse[]> {
    return runsRepo.findContextByRun(runId);
  },

  async addContext(payload: CreateRunContextPayload): Promise<number> {
    return runsRepo.insertContext(payload);
  },

  async removeContext(id: number): Promise<void> {
    await runsRepo.deleteContext(id);
  },

  // ─── Run Artifact Operations ───
  async getArtifactsByRun(
    runId: string,
    sinceId?: number,
  ): Promise<RunArtifactResponse[]> {
    return runsRepo.findArtifactsByRun(runId, sinceId);
  },

  async addArtifact(payload: CreateRunArtifactPayload): Promise<number> {
    return runsRepo.insertArtifact(payload);
  },

  async removeArtifact(id: number): Promise<void> {
    await runsRepo.deleteArtifact(id);
  },

  // ─── Tool Call Operations ───
  async getToolCallsByRun(
    runId: string,
    sinceUpdatedAt?: Date,
  ): Promise<ToolCallResponse[]> {
    return runsRepo.findToolCallsByRun(runId, sinceUpdatedAt);
  },

  async addToolCall(payload: CreateToolCallPayload): Promise<number> {
    return runsRepo.insertToolCall(payload);
  },

  async updateToolCall(
    id: number,
    payload: UpdateToolCallPayload,
  ): Promise<void> {
    await runsRepo.updateToolCall(id, payload);
  },

  // ─── Composite Read ───
  async getRunDetails(runId: string): Promise<RunDetailsResponse | null> {
    const run = await runsRepo.findRunById(runId);
    if (!run) return null;
    const [context, artifacts, toolCalls, turns] = await Promise.all([
      runsRepo.findContextByRun(runId),
      runsRepo.findArtifactsByRun(runId),
      runsRepo.findToolCallsByRun(runId),
      runsRepo.findTurnsByRun(runId),
    ]);
    return { run, context, artifacts, toolCalls, turns };
  },

  // ─── Orchestrators ───

  /**
   * Start a new run. Validates provider+workspace, creates the run row,
   * persists initial context, then spawns a RunSession wired to the adapter.
   * The session owns the lifecycle from here on; this method returns immediately.
   */
  async executeRun(payload: StartRunPayload): Promise<StartRunResponse> {
    const runId = generateRunId();
    try {
      const provider = await providersRepo.findById(payload.providerId);
      if (!provider) {
        throw new Error(`Provider "${payload.providerId}" not found`);
      }
      if (!provider.isEnabled) {
        throw new Error(`Provider "${provider.displayName}" is not enabled`);
      }
      if (provider.kind !== "agent_runtime") {
        throw new Error(
          `Provider "${provider.displayName}" is not an agent runtime`,
        );
      }

      const workspace = await workspaceRepo.findById(payload.workspaceId);
      if (!workspace) {
        throw new Error(`Workspace "${payload.workspaceId}" not found`);
      }

      await workspaceRepo.update(payload.workspaceId, { status: "in_progress" });

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

      return { runId };
    } catch (error) {
      await handlePreSessionFailure(runId, error);
      throw error;
    }
  },

  /**
   * Run a code review. Same shape as executeRun, but uses adapter.reviewRun
   * (with adapter.startRun as fallback). Workspace status transitions to in_review.
   */
  async executeReview(payload: ReviewRunPayload): Promise<StartRunResponse> {
    const runId = generateRunId();
    try {
      const provider = await providersRepo.findById(payload.providerId);
      if (!provider) {
        throw new Error(`Provider "${payload.providerId}" not found`);
      }
      if (!provider.isEnabled) {
        throw new Error(`Provider "${provider.displayName}" is not enabled`);
      }
      if (provider.kind !== "agent_runtime") {
        throw new Error(
          `Provider "${provider.displayName}" is not an agent runtime`,
        );
      }

      const workspace = await workspaceRepo.findById(payload.workspaceId);
      if (!workspace) {
        throw new Error(`Workspace "${payload.workspaceId}" not found`);
      }

      await workspaceRepo.update(payload.workspaceId, { status: "in_review" });

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

      return { runId };
    } catch (error) {
      await handlePreSessionFailure(runId, error);
      throw error;
    }
  },

  /**
   * Continue a previously-completed run, resuming the adapter session.
   * Un-finalizes the run row, recovers the turn counter from existing turns,
   * spawns a new RunSession (with seedTurnIndex so turns continue from the right index).
   */
  async continueRun(payload: ContinueRunPayload): Promise<ContinueRunResponse> {
    const { runId, accountId, message, additionalContext } = payload;
    try {
      const run = await runsRepo.findRunById(runId);
      if (!run) throw new Error("Run not found");
      if (run.accountId !== accountId) {
        throw new Error("Run does not belong to this account");
      }

      const provider = await providersRepo.findById(run.providerId);
      if (!provider) {
        throw new Error(`Provider "${run.providerId}" not found`);
      }
      if (!provider.isEnabled) {
        throw new Error(`Provider "${provider.displayName}" is not enabled`);
      }

      const workspace = run.workspaceId
        ? await workspaceRepo.findById(run.workspaceId)
        : null;

      const adapter = createWorkAdapter(provider);
      if (!adapter.continueRun) {
        throw new Error("Provider does not support session resumption");
      }
      if (adapter.canResumeSession) {
        const canResume = await adapter.canResumeSession(runId);
        if (!canResume) {
          throw new Error("Session cannot be resumed (not found or expired)");
        }
      }

      const existingTurns = await runsRepo.findTurnsByRun(runId);
      const seedTurnIndex = existingTurns.reduce(
        (max, t) => Math.max(max, t.turnIndex),
        -1,
      );

      if (workspace) {
        await workspaceRepo.update(workspace.id, { status: "in_progress" });
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

      return { runId, resumed: true };
    } catch (error) {
      await handlePreSessionFailure(runId, error);
      throw error;
    }
  },

  /**
   * Fork a completed run's session into a new run that branches from the source.
   * Creates a new run row, then spawns a RunSession wired to adapter.forkRun.
   */
  async forkRun(payload: ForkRunPayload): Promise<ForkRunResponse> {
    const { sourceRunId, accountId, message } = payload;
    const newRunId = generateRunId();
    try {
      const sourceRun = await runsRepo.findRunById(sourceRunId);
      if (!sourceRun) throw new Error("Source run not found");
      if (sourceRun.accountId !== accountId) {
        throw new Error("Source run does not belong to this account");
      }

      const provider = await providersRepo.findById(sourceRun.providerId);
      if (!provider) {
        throw new Error(`Provider "${sourceRun.providerId}" not found`);
      }
      if (!provider.isEnabled) {
        throw new Error(`Provider "${provider.displayName}" is not enabled`);
      }

      const workspace = sourceRun.workspaceId
        ? await workspaceRepo.findById(sourceRun.workspaceId)
        : null;

      const adapter = createWorkAdapter(provider);
      if (!adapter.forkRun) {
        throw new Error("Provider does not support session forking");
      }
      if (adapter.canResumeSession) {
        const canResume = await adapter.canResumeSession(sourceRunId);
        if (!canResume) {
          throw new Error(
            "Source session cannot be forked (not found or expired)",
          );
        }
      }

      if (workspace) {
        await workspaceRepo.update(workspace.id, { status: "in_progress" });
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

      return { runId: newRunId, sourceRunId };
    } catch (error) {
      await handlePreSessionFailure(newRunId, error);
      throw error;
    }
  },

  /**
   * Abort a running run. Signals the adapter via the session; cleanup happens
   * on the completion path (session.finalize). Edge case: if the DB says
   * running but no live session is registered (process restart), write
   * status="canceled" directly.
   */
  async abortRun(runId: string): Promise<void> {
    const run = await runsRepo.findRunById(runId);
    if (!run) throw new Error("Run not found");
    if (run.status !== "running") {
      throw new Error(`Run is not running (status: ${run.status})`);
    }

    const session = runSessionRegistry.get(runId);
    if (session) {
      await session.abort();
      return;
    }

    // DB says running but no live session — process restart edge case.
    await runsRepo.updateRun(runId, {
      status: "canceled",
      endedAt: new Date(),
      lastError: "Run had no live session (likely process restart mid-run)",
    });
    broadcastStatusChangedPreSession(runId, "canceled");
  },

  // ─── Session inspection / deletion ───
  async canResumeRun(runId: string): Promise<boolean> {
    const run = await runsRepo.findRunById(runId);
    if (!run) return false;

    // Can only resume runs that completed (succeeded, failed, or canceled)
    if (run.status === "running" || run.status === "queued") {
      return false;
    }

    const provider = await providersRepo.findById(run.providerId);
    if (!provider) return false;

    const adapter = createWorkAdapter(provider);
    if (!adapter.canResumeSession) return false;

    return adapter.canResumeSession(runId);
  },

  async getTurnsByRun(runId: string): Promise<RunTurnResponse[]> {
    return runsRepo.findTurnsByRun(runId);
  },

  async deleteRunSession(runId: string): Promise<void> {
    const run = await runsRepo.findRunById(runId);
    if (!run) throw new Error("Run not found");

    const provider = await providersRepo.findById(run.providerId);
    if (!provider) return;

    const adapter = createWorkAdapter(provider);
    if (adapter.deleteSession) {
      await adapter.deleteSession(runId);
    }
  },
};
