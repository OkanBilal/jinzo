import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../../db/client";
import { workspaces } from "../../db/schema";
import type {
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  WorkspaceResponse,
} from "./workspaces.dto";

// ─────────────────────────────────────────────────────────────
// Workspaces Repository
// ─────────────────────────────────────────────────────────────
export const workspacesRepo = {
  async findAll(): Promise<WorkspaceResponse[]> {
    const db = getDb();
    const rows = await db.select().from(workspaces).orderBy(desc(workspaces.updatedAt));
    return rows.map(mapRowToResponse);
  },

  async findById(id: string): Promise<WorkspaceResponse | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);
    return rows[0] ? mapRowToResponse(rows[0]) : null;
  },

  async findByAccountId(accountId: string): Promise<WorkspaceResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.accountId, accountId))
      .orderBy(desc(workspaces.updatedAt));
    return rows.map(mapRowToResponse);
  },

  async findByRootPath(accountId: string, rootPath: string): Promise<WorkspaceResponse | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.accountId, accountId), eq(workspaces.rootPath, rootPath)))
      .limit(1);
    return rows[0] ? mapRowToResponse(rows[0]) : null;
  },

  async insert(payload: CreateWorkspacePayload & { id: string }): Promise<string> {
    const db = getDb();
    await db.insert(workspaces).values({
      id: payload.id,
      accountId: payload.accountId,
      name: payload.name,
      rootPath: payload.rootPath,
      repoUrl: payload.repoUrl,
      defaultBranch: payload.defaultBranch,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
    });
    return payload.id;
  },

  async update(id: string, payload: UpdateWorkspacePayload): Promise<WorkspaceResponse | null> {
    const db = getDb();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.rootPath !== undefined) updateData.rootPath = payload.rootPath;
    if (payload.repoUrl !== undefined) updateData.repoUrl = payload.repoUrl;
    if (payload.defaultBranch !== undefined) updateData.defaultBranch = payload.defaultBranch;
    if (payload.metadata !== undefined) updateData.metadata = JSON.stringify(payload.metadata);

    await db.update(workspaces).set(updateData).where(eq(workspaces.id, id));
    return this.findById(id);
  },

  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.delete(workspaces).where(eq(workspaces.id, id));
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function mapRowToResponse(row: typeof workspaces.$inferSelect): WorkspaceResponse {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    rootPath: row.rootPath,
    repoUrl: row.repoUrl,
    defaultBranch: row.defaultBranch,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
