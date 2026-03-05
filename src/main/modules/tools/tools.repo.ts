import { eq, desc, and, isNull } from "drizzle-orm";
import { getDb } from "../../db/client";
import { tools, toolCalls } from "../../db/schema";
import type {
  CreateToolPayload,
  UpdateToolPayload,
  ToolResponse,
  CreateToolCallPayload,
  UpdateToolCallPayload,
  ToolCallResponse,
} from "./tools.dto";

// ─────────────────────────────────────────────────────────────
// Tools Repository
// ─────────────────────────────────────────────────────────────
export const toolsRepo = {
  // ─────────────────────────────────────────────────────────────
  // Tool Operations
  // ─────────────────────────────────────────────────────────────
  async findAllTools(): Promise<ToolResponse[]> {
    const db = getDb();
    const rows = await db.select().from(tools).orderBy(desc(tools.updatedAt));
    return rows.map(mapToolRowToResponse);
  },

  async findToolById(id: string): Promise<ToolResponse | null> {
    const db = getDb();
    const rows = await db.select().from(tools).where(eq(tools.id, id)).limit(1);
    return rows[0] ? mapToolRowToResponse(rows[0]) : null;
  },

  async findToolsBySource(
    source: "local" | "mcp" | "provider_builtin",
  ): Promise<ToolResponse[]> {
    const db = getDb();
    const rows = await db.select().from(tools).where(eq(tools.source, source));
    return rows.map(mapToolRowToResponse);
  },

  async findToolsByMcpServer(mcpServerId: string): Promise<ToolResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(tools)
      .where(eq(tools.mcpServerId, mcpServerId));
    return rows.map(mapToolRowToResponse);
  },

  async findEnabledTools(): Promise<ToolResponse[]> {
    const db = getDb();
    const rows = await db.select().from(tools).where(eq(tools.isEnabled, true));
    return rows.map(mapToolRowToResponse);
  },

  async insertTool(payload: CreateToolPayload): Promise<string> {
    const db = getDb();
    await db.insert(tools).values({
      id: payload.id,
      source: payload.source,
      name: payload.name,
      description: payload.description,
      version: payload.version,
      isEnabled: payload.isEnabled ?? true,
      schema: payload.schema ? JSON.stringify(payload.schema) : null,
      mcpServerId: payload.mcpServerId,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
    });
    return payload.id;
  },

  async updateTool(
    id: string,
    payload: UpdateToolPayload,
  ): Promise<ToolResponse | null> {
    const db = getDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.description !== undefined)
      updateData.description = payload.description;
    if (payload.version !== undefined) updateData.version = payload.version;
    if (payload.isEnabled !== undefined)
      updateData.isEnabled = payload.isEnabled;
    if (payload.schema !== undefined)
      updateData.schema = JSON.stringify(payload.schema);
    if (payload.metadata !== undefined)
      updateData.metadata = JSON.stringify(payload.metadata);

    await db.update(tools).set(updateData).where(eq(tools.id, id));
    return this.findToolById(id);
  },

  async deleteTool(id: string): Promise<void> {
    const db = getDb();
    await db.delete(tools).where(eq(tools.id, id));
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
      .orderBy(desc(toolCalls.createdAt));
    return rows.map(mapToolCallRowToResponse);
  },

  async findToolCallsByAccount(
    accountId: string,
    limit = 100,
  ): Promise<ToolCallResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(toolCalls)
      .where(eq(toolCalls.accountId, accountId))
      .orderBy(desc(toolCalls.createdAt))
      .limit(limit);
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
        toolCallId: payload.toolCallId ?? null,
        parentToolCallId: payload.parentToolCallId ?? null,
        status: payload.status ?? "queued",
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
        input: payload.input ? JSON.stringify(payload.input) : null,
      })
      .returning({ id: toolCalls.id });
    return result[0]?.id ?? 0;
  },

  async updateToolCall(
    id: number,
    payload: UpdateToolCallPayload,
  ): Promise<void> {
    const db = getDb();
    const updateData: Record<string, unknown> = {};

    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.output !== undefined)
      updateData.output = JSON.stringify(payload.output);
    if (payload.error !== undefined) updateData.error = payload.error;
    if (payload.startedAt !== undefined)
      updateData.startedAt = payload.startedAt;
    if (payload.endedAt !== undefined) updateData.endedAt = payload.endedAt;
    if (payload.latencyMs !== undefined)
      updateData.latencyMs = payload.latencyMs;
    if (payload.costMicros !== undefined)
      updateData.costMicros = payload.costMicros;
    if (payload.metadata !== undefined)
      updateData.metadata = JSON.stringify(payload.metadata);

    await db.update(toolCalls).set(updateData).where(eq(toolCalls.id, id));
  },

  async findToolCallRowIdByRunAndToolCallId(
    runId: string,
    toolCallId: string,
  ): Promise<number | null> {
    const db = getDb();
    const rows = await db
      .select({ id: toolCalls.id })
      .from(toolCalls)
      .where(
        and(eq(toolCalls.runId, runId), eq(toolCalls.toolCallId, toolCallId)),
      )
      .limit(1);

    return rows[0]?.id ?? null;
  },

  async findOpenToolCallRowIdByRunAndToolName(
    runId: string,
    toolName: string,
  ): Promise<number | null> {
    const db = getDb();
    const rows = await db
      .select({ id: toolCalls.id })
      .from(toolCalls)
      .where(
        and(
          eq(toolCalls.runId, runId),
          eq(toolCalls.toolName, toolName),
          isNull(toolCalls.endedAt),
        ),
      )
      .orderBy(desc(toolCalls.startedAt))
      .limit(1);

    return rows[0]?.id ?? null;
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function mapToolRowToResponse(row: typeof tools.$inferSelect): ToolResponse {
  return {
    id: row.id,
    source: row.source,
    name: row.name,
    description: row.description,
    version: row.version,
    isEnabled: row.isEnabled,
    schema: row.schema ? JSON.parse(row.schema) : null,
    mcpServerId: row.mcpServerId,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapToolCallRowToResponse(
  row: typeof toolCalls.$inferSelect,
): ToolCallResponse {
  return {
    id: row.id,
    accountId: row.accountId,
    runId: row.runId,
    providerId: row.providerId,
    toolId: row.toolId,
    toolName: row.toolName,
    toolCallId: row.toolCallId ?? null,
    parentToolCallId: row.parentToolCallId ?? null,
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

