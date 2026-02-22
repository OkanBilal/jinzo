import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../../db/client";
import { workspaces } from "../../db/schema";
import type {
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  WorkspaceResponse,
  WorkspaceStatus,
} from "./workspaces.dto";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────
// Workspaces Repository
// ─────────────────────────────────────────────────────────────
export const workspacesRepo = {
  async findAll(includeArchived = false): Promise<WorkspaceResponse[]> {
    const db = getDb();
    const query = db.select().from(workspaces);
    const rows = includeArchived
      ? await query.orderBy(desc(workspaces.updatedAt))
      : await query.where(eq(workspaces.isArchived, false)).orderBy(desc(workspaces.updatedAt));
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

  async findByAccountId(accountId: string, includeArchived = false): Promise<WorkspaceResponse[]> {
    const db = getDb();
    const condition = includeArchived
      ? eq(workspaces.accountId, accountId)
      : and(eq(workspaces.accountId, accountId), eq(workspaces.isArchived, false));
    const rows = await db
      .select()
      .from(workspaces)
      .where(condition)
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
      projectId: payload.projectId,
      name: payload.name,
      rootPath: payload.rootPath,
      repoUrl: payload.repoUrl,
      defaultBranch: payload.defaultBranch,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      status: (payload as CreateWorkspacePayload & { status?: WorkspaceStatus }).status ?? "todo",
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
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.projectId !== undefined) updateData.projectId = payload.projectId;

    await db.update(workspaces).set(updateData).where(eq(workspaces.id, id));
    return this.findById(id);
  },

  async findByProjectId(projectId: string): Promise<WorkspaceResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.projectId, projectId))
      .orderBy(desc(workspaces.updatedAt));
    return rows.map(mapRowToResponse);
  },

  async deleteByProjectId(projectId: string): Promise<void> {
    const db = getDb();
    await db.delete(workspaces).where(eq(workspaces.projectId, projectId));
  },

  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.delete(workspaces).where(eq(workspaces.id, id));
  },

  async archive(id: string): Promise<WorkspaceResponse | null> {
    const db = getDb();
    await db
      .update(workspaces)
      .set({ isArchived: true, updatedAt: sql`(unixepoch())` })
      .where(eq(workspaces.id, id));
    return this.findById(id);
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function mapRowToResponse(row: typeof workspaces.$inferSelect): WorkspaceResponse {
  return {
    id: row.id,
    accountId: row.accountId,
    projectId: row.projectId,
    name: row.name,
    rootPath: row.rootPath,
    repoUrl: row.repoUrl,
    defaultBranch: row.defaultBranch,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    status: row.status as WorkspaceStatus,
    isArchived: row.isArchived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
