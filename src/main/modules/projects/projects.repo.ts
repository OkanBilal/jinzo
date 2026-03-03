import { eq, desc, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { projects } from "../../db/schema";
import type { CreateProjectPayload, UpdateProjectPayload, ProjectResponse } from "./projects.dto";

// ─────────────────────────────────────────────────────────────
// Projects Repository
// ─────────────────────────────────────────────────────────────
export const projectsRepo = {
  async findAll(includeArchived = false): Promise<ProjectResponse[]> {
    const db = getDb();
    const query = db.select().from(projects);
    const rows = includeArchived
      ? await query.orderBy(desc(projects.updatedAt))
      : await query.where(eq(projects.isArchived, false)).orderBy(desc(projects.updatedAt));
    return rows.map(mapRowToResponse);
  },

  async findById(id: string): Promise<ProjectResponse | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return rows[0] ? mapRowToResponse(rows[0]) : null;
  },

  async findByAccountId(accountId: string, includeArchived = false): Promise<ProjectResponse[]> {
    const db = getDb();
    const condition = includeArchived
      ? eq(projects.accountId, accountId)
      : and(eq(projects.accountId, accountId), eq(projects.isArchived, false));
    const rows = await db
      .select()
      .from(projects)
      .where(condition)
      .orderBy(desc(projects.updatedAt));
    return rows.map(mapRowToResponse);
  },

  async findByRemoteOrigin(
    accountId: string,
    normalizedOrigin: string,
  ): Promise<ProjectResponse | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.accountId, accountId),
          eq(projects.remoteOrigin, normalizedOrigin),
        ),
      )
      .limit(1);
    return rows[0] ? mapRowToResponse(rows[0]) : null;
  },

  async insert(payload: CreateProjectPayload & { id: string }): Promise<string> {
    const db = getDb();
    await db.insert(projects).values({
      id: payload.id,
      accountId: payload.accountId,
      name: payload.name,
      rootPath: payload.rootPath,
      workspacesPath: payload.workspacesPath,
      branches: payload.branches ? JSON.stringify(payload.branches) : null,
      remoteOrigin: payload.remoteOrigin,
      defaultBranch: payload.defaultBranch,
      setupScript: payload.setupScript,
      runScript: payload.runScript,
      archiveScript: payload.archiveScript,
      icon: payload.icon,
      commitInstructions: payload.commitInstructions,
      prInstructions: payload.prInstructions,
    });
    return payload.id;
  },

  async update(id: string, payload: UpdateProjectPayload): Promise<ProjectResponse | null> {
    const db = getDb();
    const updateData: Record<string, unknown> = { updatedAt: sql`(unixepoch())` };

    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.rootPath !== undefined) updateData.rootPath = payload.rootPath;
    if (payload.workspacesPath !== undefined) updateData.workspacesPath = payload.workspacesPath;
    if (payload.branches !== undefined) updateData.branches = JSON.stringify(payload.branches);
    if (payload.remoteOrigin !== undefined) updateData.remoteOrigin = payload.remoteOrigin;
    if (payload.defaultBranch !== undefined) updateData.defaultBranch = payload.defaultBranch;
    if (payload.setupScript !== undefined) updateData.setupScript = payload.setupScript;
    if (payload.runScript !== undefined) updateData.runScript = payload.runScript;
    if (payload.archiveScript !== undefined) updateData.archiveScript = payload.archiveScript;
    if (payload.icon !== undefined) updateData.icon = payload.icon;
    if (payload.commitInstructions !== undefined) updateData.commitInstructions = payload.commitInstructions;
    if (payload.prInstructions !== undefined) updateData.prInstructions = payload.prInstructions;

    await db.update(projects).set(updateData).where(eq(projects.id, id));
    return this.findById(id);
  },

  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.delete(projects).where(eq(projects.id, id));
  },

  async archive(id: string): Promise<ProjectResponse | null> {
    const db = getDb();
    await db
      .update(projects)
      .set({ isArchived: true, updatedAt: sql`(unixepoch())` })
      .where(eq(projects.id, id));
    return this.findById(id);
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function mapRowToResponse(row: typeof projects.$inferSelect): ProjectResponse {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    rootPath: row.rootPath,
    workspacesPath: row.workspacesPath,
    branches: row.branches ? JSON.parse(row.branches) : null,
    remoteOrigin: row.remoteOrigin,
    defaultBranch: row.defaultBranch,
    setupScript: row.setupScript,
    runScript: row.runScript,
    archiveScript: row.archiveScript,
    icon: row.icon,
    commitInstructions: row.commitInstructions,
    prInstructions: row.prInstructions,
    isArchived: row.isArchived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
