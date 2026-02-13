import { eq, desc } from "drizzle-orm";
import { getDb } from "../../db/client";
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

  async findByRun(runId: string): Promise<WorkspaceDiffResponse | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaceDiffs)
      .where(eq(workspaceDiffs.runId, runId))
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
    files: row.filesJson ? JSON.parse(row.filesJson) : null,
    stats: row.statsJson ? JSON.parse(row.statsJson) : null,
    createdAt: row.createdAt,
  };
}
