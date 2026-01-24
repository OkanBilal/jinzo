import { eq, desc } from "drizzle-orm";
import { getDb } from "../../db/client";
import { mcpServers } from "../../db/schema";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
export type McpTransport = "stdio" | "http" | "ws";
export type McpServerStatus = "active" | "disabled" | "error";

export interface McpServerMetadata {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  [key: string]: unknown;
}

export interface CreateMcpServerPayload {
  id: string;
  accountId: string;
  name: string;
  transport: McpTransport;
  endpoint?: string;
  status?: McpServerStatus;
  metadata?: McpServerMetadata;
}

export interface UpdateMcpServerPayload {
  name?: string;
  transport?: McpTransport;
  endpoint?: string;
  status?: McpServerStatus;
  metadata?: McpServerMetadata;
}

export interface McpServerResponse {
  id: string;
  accountId: string;
  name: string;
  transport: McpTransport;
  endpoint: string | null;
  status: McpServerStatus;
  metadata: McpServerMetadata | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────
// MCP Servers Repository
// ─────────────────────────────────────────────────────────────
export const mcpServersRepo = {
  async findAll(): Promise<McpServerResponse[]> {
    const db = getDb();
    const rows = await db.select().from(mcpServers).orderBy(desc(mcpServers.updatedAt));
    return rows.map(mapRowToResponse);
  },

  async findById(id: string): Promise<McpServerResponse | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id))
      .limit(1);
    return rows[0] ? mapRowToResponse(rows[0]) : null;
  },

  async findByAccountId(accountId: string): Promise<McpServerResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.accountId, accountId))
      .orderBy(desc(mcpServers.updatedAt));
    return rows.map(mapRowToResponse);
  },

  async findActive(): Promise<McpServerResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.status, "active"))
      .orderBy(desc(mcpServers.updatedAt));
    return rows.map(mapRowToResponse);
  },

  async insert(payload: CreateMcpServerPayload): Promise<string> {
    const db = getDb();
    await db.insert(mcpServers).values({
      id: payload.id,
      accountId: payload.accountId,
      name: payload.name,
      transport: payload.transport,
      endpoint: payload.endpoint,
      status: payload.status ?? "active",
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
    });
    return payload.id;
  },

  async update(id: string, payload: UpdateMcpServerPayload): Promise<McpServerResponse | null> {
    const db = getDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.transport !== undefined) updateData.transport = payload.transport;
    if (payload.endpoint !== undefined) updateData.endpoint = payload.endpoint;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.metadata !== undefined) updateData.metadata = JSON.stringify(payload.metadata);

    await db.update(mcpServers).set(updateData).where(eq(mcpServers.id, id));
    return this.findById(id);
  },

  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.delete(mcpServers).where(eq(mcpServers.id, id));
  },

  async setStatus(id: string, status: McpServerStatus): Promise<void> {
    const db = getDb();
    await db
      .update(mcpServers)
      .set({ status, updatedAt: new Date() })
      .where(eq(mcpServers.id, id));
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function mapRowToResponse(row: typeof mcpServers.$inferSelect): McpServerResponse {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    transport: row.transport,
    endpoint: row.endpoint,
    status: row.status,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
