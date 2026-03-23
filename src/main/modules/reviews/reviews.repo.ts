import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { safeJsonParse } from "../../db/utils";
import { reviews } from "../../db/schema";
import type {
  CreateReviewPayload,
  UpdateReviewPayload,
  ReviewResponse,
} from "./reviews.dto";

// ─────────────────────────────────────────────────────────────
// Reviews Repository
// ─────────────────────────────────────────────────────────────
export const reviewsRepo = {
  async findByWorkspace(
    workspaceId: string,
    limit = 50,
  ): Promise<ReviewResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(reviews)
      .where(eq(reviews.workspaceId, workspaceId))
      .orderBy(desc(reviews.updatedAt))
      .limit(limit);
    return rows.map(mapRowToResponse);
  },

  async findById(id: string): Promise<ReviewResponse | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);
    return rows[0] ? mapRowToResponse(rows[0]) : null;
  },

  async insert(payload: CreateReviewPayload): Promise<string> {
    const db = getDb();
    const id = payload.id || generateId();
    await db.insert(reviews).values({
      id,
      workspaceId: payload.workspaceId,
      title: payload.title,
      summary: payload.summary,
      status: payload.status ?? "open",
      runId: payload.runId,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
    });
    return id;
  },

  async update(
    id: string,
    payload: UpdateReviewPayload,
  ): Promise<ReviewResponse | null> {
    const db = getDb();
    const updateData: Record<string, unknown> = {
      updatedAt: sql`(unixepoch())`,
    };

    if (payload.title !== undefined) updateData.title = payload.title;
    if (payload.summary !== undefined) updateData.summary = payload.summary;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.runId !== undefined) updateData.runId = payload.runId;
    if (payload.metadata !== undefined)
      updateData.metadata = JSON.stringify(payload.metadata);

    await db.update(reviews).set(updateData).where(eq(reviews.id, id));
    return this.findById(id);
  },

  async remove(id: string): Promise<void> {
    const db = getDb();
    await db.delete(reviews).where(eq(reviews.id, id));
  },

  async deleteByWorkspaceId(workspaceId: string): Promise<void> {
    const db = getDb();
    await db.delete(reviews).where(eq(reviews.workspaceId, workspaceId));
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function mapRowToResponse(row: typeof reviews.$inferSelect): ReviewResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    summary: row.summary,
    status: row.status,
    runId: row.runId,
    metadata: safeJsonParse(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
