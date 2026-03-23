import { eq, desc } from "drizzle-orm";
import { getDb } from "../../db/client";
import { safeJsonParse } from "../../db/utils";
import { workspaceActivity } from "../../db/schema";
import type { ActivityResponse, CreateActivityPayload } from "./workspaceActivity.dto";

// ─────────────────────────────────────────────────────────────
// Workspace Activity Repository
// ─────────────────────────────────────────────────────────────
export const workspaceActivityRepo = {
  async findByWorkspace(
    workspaceId: string,
    limit = 50,
  ): Promise<ActivityResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaceActivity)
      .where(eq(workspaceActivity.workspaceId, workspaceId))
      .orderBy(desc(workspaceActivity.createdAt))
      .limit(limit);
    return rows.map(mapRowToResponse);
  },

  async insert(payload: CreateActivityPayload): Promise<string> {
    const db = getDb();
    const id = payload.id || generateId();
    await db.insert(workspaceActivity).values({
      id,
      workspaceId: payload.workspaceId,
      type: payload.type,
      title: payload.title,
      summary: payload.summary ?? null,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      refId: payload.refId ?? null,
    });
    return id;
  },

  async insertMany(payloads: CreateActivityPayload[]): Promise<string[]> {
    const db = getDb();
    const ids = payloads.map((p) => p.id || generateId());
    await db.insert(workspaceActivity).values(
      payloads.map((p, i) => ({
        id: ids[i],
        workspaceId: p.workspaceId,
        type: p.type,
        title: p.title,
        summary: p.summary ?? null,
        metadata: p.metadata ? JSON.stringify(p.metadata) : null,
        refId: p.refId ?? null,
      })),
    );
    return ids;
  },

  async remove(id: string): Promise<void> {
    const db = getDb();
    await db.delete(workspaceActivity).where(eq(workspaceActivity.id, id));
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function mapRowToResponse(
  row: typeof workspaceActivity.$inferSelect,
): ActivityResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    title: row.title,
    summary: row.summary,
    metadata: safeJsonParse(row.metadata),
    refId: row.refId,
    createdAt: row.createdAt,
  };
}

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
