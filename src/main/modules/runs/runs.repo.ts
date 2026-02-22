import { eq, desc, and, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { runs, runContext, runArtifacts, runCommands, toolCalls } from "../../db/schema";
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
} from "./runs.dto";

// ─────────────────────────────────────────────────────────────
// Runs Repository
// ─────────────────────────────────────────────────────────────
export const runsRepo = {
  // ─────────────────────────────────────────────────────────────
  // Run Operations
  // ─────────────────────────────────────────────────────────────
  async findAllRuns(limit = 100, includeArchived = false): Promise<RunResponse[]> {
    const db = getDb();
    const query = db.select().from(runs);
    const rows = includeArchived
      ? await query.orderBy(desc(runs.createdAt)).limit(limit)
      : await query.where(eq(runs.isArchived, false)).orderBy(desc(runs.createdAt)).limit(limit);
    return rows.map(mapRunRowToResponse);
  },

  async findRunById(id: string): Promise<RunResponse | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(runs)
      .where(eq(runs.id, id))
      .limit(1);
    return rows[0] ? mapRunRowToResponse(rows[0]) : null;
  },

  async findRunsByAccount(accountId: string, limit = 100, includeArchived = false): Promise<RunResponse[]> {
    const db = getDb();
    const condition = includeArchived
      ? eq(runs.accountId, accountId)
      : and(eq(runs.accountId, accountId), eq(runs.isArchived, false));
    const rows = await db
      .select()
      .from(runs)
      .where(condition)
      .orderBy(desc(runs.createdAt))
      .limit(limit);
    return rows.map(mapRunRowToResponse);
  },

  async findRunsByWorkspace(workspaceId: string, limit = 100, includeArchived = false): Promise<RunResponse[]> {
    const db = getDb();
    const condition = includeArchived
      ? eq(runs.workspaceId, workspaceId)
      : and(eq(runs.workspaceId, workspaceId), eq(runs.isArchived, false));
    const rows = await db
      .select()
      .from(runs)
      .where(condition)
      .orderBy(desc(runs.createdAt))
      .limit(limit);
    return rows.map(mapRunRowToResponse);
  },

  async findRunsByStatus(
    accountId: string,
    status: "queued" | "running" | "succeeded" | "failed" | "canceled"
  ): Promise<RunResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(runs)
      .where(and(eq(runs.accountId, accountId), eq(runs.status, status)))
      .orderBy(desc(runs.createdAt));
    return rows.map(mapRunRowToResponse);
  },

  async insertRun(payload: CreateRunPayload): Promise<string> {
    const db = getDb();
    await db.insert(runs).values({
      id: payload.id,
      accountId: payload.accountId,
      workspaceId: payload.workspaceId,
      moodId: payload.moodId,
      providerId: payload.providerId,
      model: payload.model,
      title: payload.title,
      goal: payload.goal,
      status: payload.status ?? "queued",
      systemPrompt: payload.systemPrompt,
      configSnapshot: payload.configSnapshot ? JSON.stringify(payload.configSnapshot) : null,
      toolPolicySnapshot: payload.toolPolicySnapshot
        ? JSON.stringify(payload.toolPolicySnapshot)
        : null,
    });
    return payload.id;
  },

  async updateRun(id: string, payload: UpdateRunPayload): Promise<RunResponse | null> {
    const db = getDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (payload.title !== undefined) updateData.title = payload.title;
    if (payload.goal !== undefined) updateData.goal = payload.goal;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.model !== undefined) updateData.model = payload.model;
    if (payload.systemPrompt !== undefined) updateData.systemPrompt = payload.systemPrompt;
    if (payload.configSnapshot !== undefined)
      updateData.configSnapshot = JSON.stringify(payload.configSnapshot);
    if (payload.toolPolicySnapshot !== undefined)
      updateData.toolPolicySnapshot = JSON.stringify(payload.toolPolicySnapshot);
    if (payload.startedAt !== undefined) updateData.startedAt = payload.startedAt;
    if (payload.endedAt !== undefined) updateData.endedAt = payload.endedAt;
    if (payload.lastError !== undefined) updateData.lastError = payload.lastError;
    if (payload.stopReason !== undefined) updateData.stopReason = payload.stopReason;
    if (payload.sessionId !== undefined) updateData.sessionId = payload.sessionId;

    await db.update(runs).set(updateData).where(eq(runs.id, id));
    return this.findRunById(id);
  },

  async deleteRun(id: string): Promise<void> {
    const db = getDb();
    await db.delete(runs).where(eq(runs.id, id));
  },

  async deleteRunsByWorkspaceId(workspaceId: string): Promise<void> {
    const db = getDb();
    await db.delete(runs).where(eq(runs.workspaceId, workspaceId));
  },

  async archiveRun(id: string): Promise<RunResponse | null> {
    const db = getDb();
    await db
      .update(runs)
      .set({ isArchived: true, updatedAt: sql`(unixepoch())` })
      .where(eq(runs.id, id));
    return this.findRunById(id);
  },

  // ─────────────────────────────────────────────────────────────
  // Run Context Operations
  // ─────────────────────────────────────────────────────────────
  async findContextByRun(runId: string): Promise<RunContextResponse[]> {
    const db = getDb();
    const rows = await db.select().from(runContext).where(eq(runContext.runId, runId));
    return rows.map(mapContextRowToResponse);
  },

  async insertContext(payload: CreateRunContextPayload): Promise<number> {
    const db = getDb();
    const result = await db
      .insert(runContext)
      .values({
        runId: payload.runId,
        kind: payload.kind,
        ref: payload.ref,
        content: payload.content,
        entityId: payload.entityId,
        contentHash: payload.contentHash,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      })
      .returning({ id: runContext.id });
    return result[0]?.id ?? 0;
  },

  async deleteContext(id: number): Promise<void> {
    const db = getDb();
    await db.delete(runContext).where(eq(runContext.id, id));
  },

  // ─────────────────────────────────────────────────────────────
  // Run Artifact Operations
  // ─────────────────────────────────────────────────────────────
  async findArtifactsByRun(runId: string): Promise<RunArtifactResponse[]> {
    const db = getDb();
    const rows = await db.select().from(runArtifacts).where(eq(runArtifacts.runId, runId));
    return rows.map(mapArtifactRowToResponse);
  },

  async insertArtifact(payload: CreateRunArtifactPayload): Promise<number> {
    const db = getDb();
    const result = await db
      .insert(runArtifacts)
      .values({
        runId: payload.runId,
        kind: payload.kind,
        path: payload.path,
        content: payload.content,
        blobData: payload.blobData,
        entityId: payload.entityId,
        contentHash: payload.contentHash,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      })
      .returning({ id: runArtifacts.id });
    return result[0]?.id ?? 0;
  },

  async deleteArtifact(id: number): Promise<void> {
    const db = getDb();
    await db.delete(runArtifacts).where(eq(runArtifacts.id, id));
  },

  // ─────────────────────────────────────────────────────────────
  // Run Command Operations
  // ─────────────────────────────────────────────────────────────
  async findCommandsByRun(runId: string): Promise<RunCommandResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(runCommands)
      .where(eq(runCommands.runId, runId))
      .orderBy(runCommands.createdAt);
    return rows.map(mapCommandRowToResponse);
  },

  async insertCommand(payload: CreateRunCommandPayload): Promise<number> {
    const db = getDb();
    const result = await db
      .insert(runCommands)
      .values({
        runId: payload.runId,
        cwd: payload.cwd,
        command: payload.command,
        envKeys: payload.envKeys ? JSON.stringify(payload.envKeys) : null,
        status: payload.status ?? "queued",
      })
      .returning({ id: runCommands.id });
    return result[0]?.id ?? 0;
  },

  async updateCommand(id: number, payload: UpdateRunCommandPayload): Promise<void> {
    const db = getDb();
    const updateData: Record<string, unknown> = {};

    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.startedAt !== undefined) updateData.startedAt = payload.startedAt;
    if (payload.endedAt !== undefined) updateData.endedAt = payload.endedAt;
    if (payload.exitCode !== undefined) updateData.exitCode = payload.exitCode;
    if (payload.stdout !== undefined) updateData.stdout = payload.stdout;
    if (payload.stderr !== undefined) updateData.stderr = payload.stderr;
    if (payload.metadata !== undefined) updateData.metadata = JSON.stringify(payload.metadata);

    await db.update(runCommands).set(updateData).where(eq(runCommands.id, id));
  },

  async deleteCommand(id: number): Promise<void> {
    const db = getDb();
    await db.delete(runCommands).where(eq(runCommands.id, id));
  },

  // ─────────────────────────────────────────────────────────────
  // Tool Call Operations
  // ─────────────────────────────────────────────────────────────
  async findToolCallsByRun(runId: string): Promise<ToolCallResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(toolCalls)
      .where(eq(toolCalls.runId, runId))
      .orderBy(toolCalls.createdAt);
    return rows.map(mapToolCallRowToResponse);
  },

  async insertToolCall(payload: CreateToolCallPayload): Promise<number> {
    const db = getDb();
    const result = await db
      .insert(toolCalls)
      .values({
        accountId: payload.accountId,
        runId: payload.runId,
        providerId: payload.providerId,
        toolId: payload.toolId,
        toolName: payload.toolName,
        status: payload.status ?? "queued",
        input: payload.input ? JSON.stringify(payload.input) : null,
        startedAt: payload.startedAt,
      })
      .returning({ id: toolCalls.id });
    return result[0]?.id ?? 0;
  },

  async updateToolCall(id: number, payload: UpdateToolCallPayload): Promise<void> {
    const db = getDb();
    const updateData: Record<string, unknown> = {};

    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.output !== undefined) updateData.output = JSON.stringify(payload.output);
    if (payload.error !== undefined) updateData.error = payload.error;
    if (payload.startedAt !== undefined) updateData.startedAt = payload.startedAt;
    if (payload.endedAt !== undefined) updateData.endedAt = payload.endedAt;
    if (payload.latencyMs !== undefined) updateData.latencyMs = payload.latencyMs;
    if (payload.costMicros !== undefined) updateData.costMicros = payload.costMicros;
    if (payload.metadata !== undefined) updateData.metadata = JSON.stringify(payload.metadata);

    await db.update(toolCalls).set(updateData).where(eq(toolCalls.id, id));
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function mapRunRowToResponse(row: typeof runs.$inferSelect): RunResponse {
  return {
    id: row.id,
    accountId: row.accountId,
    workspaceId: row.workspaceId,
    moodId: row.moodId,
    providerId: row.providerId,
    model: row.model,
    title: row.title,
    goal: row.goal,
    status: row.status,
    systemPrompt: row.systemPrompt,
    configSnapshot: row.configSnapshot ? JSON.parse(row.configSnapshot) : null,
    toolPolicySnapshot: row.toolPolicySnapshot ? JSON.parse(row.toolPolicySnapshot) : null,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    lastError: row.lastError,
    stopReason: row.stopReason,
    sessionId: row.sessionId,
    isArchived: row.isArchived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapContextRowToResponse(row: typeof runContext.$inferSelect): RunContextResponse {
  return {
    id: row.id,
    runId: row.runId,
    kind: row.kind,
    ref: row.ref,
    content: row.content,
    entityId: row.entityId,
    contentHash: row.contentHash,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.createdAt,
  };
}

function mapArtifactRowToResponse(row: typeof runArtifacts.$inferSelect): RunArtifactResponse {
  return {
    id: row.id,
    runId: row.runId,
    kind: row.kind,
    path: row.path,
    content: row.content,
    blobData: row.blobData as Buffer | null,
    entityId: row.entityId,
    contentHash: row.contentHash,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.createdAt,
  };
}

function mapCommandRowToResponse(row: typeof runCommands.$inferSelect): RunCommandResponse {
  return {
    id: row.id,
    runId: row.runId,
    cwd: row.cwd,
    command: row.command,
    envKeys: row.envKeys ? JSON.parse(row.envKeys) : null,
    status: row.status,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    exitCode: row.exitCode,
    stdout: row.stdout,
    stderr: row.stderr,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.createdAt,
  };
}

function mapToolCallRowToResponse(row: typeof toolCalls.$inferSelect): ToolCallResponse {
  return {
    id: row.id,
    accountId: row.accountId,
    runId: row.runId,
    providerId: row.providerId,
    toolId: row.toolId,
    toolName: row.toolName,
    status: row.status,
    input: row.input ? JSON.parse(row.input) : null,
    output: row.output ? JSON.parse(row.output) : null,
    error: row.error,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    latencyMs: row.latencyMs,
    costMicros: row.costMicros,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.createdAt,
  };
}
