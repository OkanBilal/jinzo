import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../../db/client";
import { safeJsonParse } from "../../db/utils";
import { workspaceDiffs } from "../../db/schema";
import type { WorkspaceDiffResponse } from "./workspaceDiffs.dto";

// ─────────────────────────────────────────────────────────────
// Workspace Diffs Repository
// ─────────────────────────────────────────────────────────────
export const workspaceDiffsRepo = {
  async insertDiff(payload: {
    id: string;
    workspaceId: string;
    runId?: string;
    baseRef?: string;
    diffText: string;
    filesJson?: string;
    statsJson?: string;
  }): Promise<string> {
    const db = getDb();
    await db.insert(workspaceDiffs).values({
      id: payload.id,
      workspaceId: payload.workspaceId,
      runId: payload.runId ?? null,
      baseRef: payload.baseRef ?? null,
      diffText: payload.diffText,
      filesJson: payload.filesJson ?? null,
      statsJson: payload.statsJson ?? null,
    });
    return payload.id;
  },

  async updateDiff(
    id: string,
    payload: {
      diffText: string;
      filesJson?: string | null;
      statsJson?: string | null;
      baseRef?: string | null;
    },
  ): Promise<void> {
    const db = getDb();
    await db
      .update(workspaceDiffs)
      .set({
        diffText: payload.diffText,
        filesJson: payload.filesJson ?? null,
        statsJson: payload.statsJson ?? null,
        ...(payload.baseRef !== undefined ? { baseRef: payload.baseRef } : {}),
      })
      .where(eq(workspaceDiffs.id, id));
  },

  async findByWorkspace(
    workspaceId: string,
    limit = 20,
  ): Promise<WorkspaceDiffResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaceDiffs)
      .where(eq(workspaceDiffs.workspaceId, workspaceId))
      .orderBy(desc(workspaceDiffs.createdAt))
      .limit(limit);
    return rows.map(mapRowToResponse);
  },

  async findLatestByWorkspace(
    workspaceId: string,
  ): Promise<WorkspaceDiffResponse | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaceDiffs)
      .where(eq(workspaceDiffs.workspaceId, workspaceId))
      .orderBy(desc(workspaceDiffs.createdAt))
      .limit(1);
    return rows[0] ? mapRowToResponse(rows[0]) : null;
  },

  async findLatestSummaryByWorkspace(
    workspaceId: string,
  ): Promise<Omit<WorkspaceDiffResponse, "diffText"> | null> {
    const db = getDb();
    const rows = await db
      .select({
        id: workspaceDiffs.id,
        workspaceId: workspaceDiffs.workspaceId,
        runId: workspaceDiffs.runId,
        baseRef: workspaceDiffs.baseRef,
        filesJson: workspaceDiffs.filesJson,
        statsJson: workspaceDiffs.statsJson,
        createdAt: workspaceDiffs.createdAt,
      })
      .from(workspaceDiffs)
      .where(eq(workspaceDiffs.workspaceId, workspaceId))
      .orderBy(desc(workspaceDiffs.createdAt))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      runId: row.runId,
      baseRef: row.baseRef,
      files: safeJsonParse<string[]>(row.filesJson),
      stats: safeJsonParse(row.statsJson),
      createdAt: row.createdAt,
    };
  },

  async findByRun(runId: string): Promise<WorkspaceDiffResponse | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaceDiffs)
      .where(eq(workspaceDiffs.runId, runId))
      .limit(1);
    return rows[0] ? mapRowToResponse(rows[0]) : null;
  },

  async deleteByWorkspace(workspaceId: string): Promise<void> {
    const db = getDb();
    await db.delete(workspaceDiffs).where(eq(workspaceDiffs.workspaceId, workspaceId));
  },

  async deleteByRun(runId: string): Promise<void> {
    const db = getDb();
    await db.delete(workspaceDiffs).where(eq(workspaceDiffs.runId, runId));
  },

  async deleteLatestByWorkspace(workspaceId: string): Promise<void> {
    const db = getDb();
    const rows = await db
      .select({ id: workspaceDiffs.id })
      .from(workspaceDiffs)
      .where(eq(workspaceDiffs.workspaceId, workspaceId))
      .orderBy(desc(workspaceDiffs.createdAt))
      .limit(1);
    if (rows[0]) {
      await db.delete(workspaceDiffs).where(eq(workspaceDiffs.id, rows[0].id));
    }
  },

  async findByWorkspaceAndBaseRef(
    workspaceId: string,
    baseRef: string,
  ): Promise<WorkspaceDiffResponse | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaceDiffs)
      .where(
        and(
          eq(workspaceDiffs.workspaceId, workspaceId),
          eq(workspaceDiffs.baseRef, baseRef),
        ),
      )
      .limit(1);
    return rows[0] ? mapRowToResponse(rows[0]) : null;
  },
};

function mapRowToResponse(
  row: typeof workspaceDiffs.$inferSelect,
): WorkspaceDiffResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    runId: row.runId,
    baseRef: row.baseRef,
    diffText: row.diffText,
    files: safeJsonParse<string[]>(row.filesJson),
    stats: safeJsonParse(row.statsJson),
    createdAt: row.createdAt,
  };
}
