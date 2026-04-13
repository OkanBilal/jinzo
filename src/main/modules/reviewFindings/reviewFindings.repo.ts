import { eq, desc } from "drizzle-orm";
import { getDb } from "../../db/client";
import { safeJsonParse } from "../../db/utils";
import { reviewFindings, reviews } from "../../db/schema";
import type {
  CreateReviewFindingPayload,
  UpdateReviewFindingPayload,
  ReviewFindingResponse,
} from "./reviewFindings.dto";

// ─────────────────────────────────────────────────────────────
// Review Findings Repository
// ─────────────────────────────────────────────────────────────
export const reviewFindingsRepo = {
  async findByReview(
    reviewId: string,
    limit = 200,
  ): Promise<ReviewFindingResponse[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(reviewFindings)
      .where(eq(reviewFindings.reviewId, reviewId))
      .orderBy(desc(reviewFindings.createdAt))
      .limit(limit);
    return rows.map(mapRowToResponse);
  },

  async findByWorkspace(
    workspaceId: string,
    limit = 500,
  ): Promise<(ReviewFindingResponse & { reviewCreatedAt: Date })[]> {
    const db = getDb();
    const rows = await db
      .select({
        finding: reviewFindings,
        reviewCreatedAt: reviews.createdAt,
      })
      .from(reviewFindings)
      .innerJoin(reviews, eq(reviewFindings.reviewId, reviews.id))
      .where(eq(reviews.workspaceId, workspaceId))
      .orderBy(desc(reviewFindings.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      ...mapRowToResponse(r.finding),
      reviewCreatedAt: r.reviewCreatedAt,
    }));
  },

  async findById(id: string): Promise<ReviewFindingResponse | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(reviewFindings)
      .where(eq(reviewFindings.id, id))
      .limit(1);
    return rows[0] ? mapRowToResponse(rows[0]) : null;
  },

  async insert(payload: CreateReviewFindingPayload): Promise<string> {
    const db = getDb();
    const id = payload.id || generateId();
    await db.insert(reviewFindings).values({
      id,
      reviewId: payload.reviewId,
      severity: payload.severity,
      file: payload.file,
      lineStart: payload.lineStart,
      lineEnd: payload.lineEnd,
      message: payload.message,
      reason: payload.reason,
      suggestion: payload.suggestion,
      validated: payload.validated ?? false,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
    });
    return id;
  },

  async insertMany(payloads: CreateReviewFindingPayload[]): Promise<string[]> {
    const db = getDb();
    const ids: string[] = [];
    const values = payloads.map((payload) => {
      const id = payload.id || generateId();
      ids.push(id);
      return {
        id,
        reviewId: payload.reviewId,
        severity: payload.severity,
        file: payload.file,
        lineStart: payload.lineStart,
        lineEnd: payload.lineEnd,
        message: payload.message,
        reason: payload.reason,
        suggestion: payload.suggestion,
        validated: payload.validated ?? false,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      };
    });
    await db.insert(reviewFindings).values(values);
    return ids;
  },

  async update(
    id: string,
    payload: UpdateReviewFindingPayload,
  ): Promise<ReviewFindingResponse | null> {
    const db = getDb();
    const updateData: Record<string, unknown> = {};

    if (payload.severity !== undefined) updateData.severity = payload.severity;
    if (payload.file !== undefined) updateData.file = payload.file;
    if (payload.lineStart !== undefined) updateData.lineStart = payload.lineStart;
    if (payload.lineEnd !== undefined) updateData.lineEnd = payload.lineEnd;
    if (payload.message !== undefined) updateData.message = payload.message;
    if (payload.reason !== undefined) updateData.reason = payload.reason;
    if (payload.suggestion !== undefined)
      updateData.suggestion = payload.suggestion;
    if (payload.validated !== undefined) updateData.validated = payload.validated;
    if (payload.isApproved !== undefined) updateData.isApproved = payload.isApproved;
    if (payload.metadata !== undefined)
      updateData.metadata =
        payload.metadata !== null ? JSON.stringify(payload.metadata) : null;

    if (Object.keys(updateData).length > 0) {
      await db
        .update(reviewFindings)
        .set(updateData)
        .where(eq(reviewFindings.id, id));
    }
    return this.findById(id);
  },

  async remove(id: string): Promise<void> {
    const db = getDb();
    await db.delete(reviewFindings).where(eq(reviewFindings.id, id));
  },

  async removeByWorkspace(workspaceId: string): Promise<void> {
    const db = getDb();
    const rows = await db
      .select({ id: reviewFindings.id })
      .from(reviewFindings)
      .innerJoin(reviews, eq(reviewFindings.reviewId, reviews.id))
      .where(eq(reviews.workspaceId, workspaceId));
    if (rows.length > 0) {
      const { inArray } = await import("drizzle-orm");
      await db.delete(reviewFindings).where(inArray(reviewFindings.id, rows.map((r) => r.id)));
    }
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function mapRowToResponse(
  row: typeof reviewFindings.$inferSelect,
): ReviewFindingResponse {
  return {
    id: row.id,
    reviewId: row.reviewId,
    severity: row.severity,
    file: row.file,
    lineStart: row.lineStart,
    lineEnd: row.lineEnd,
    message: row.message,
    reason: row.reason,
    suggestion: row.suggestion,
    validated: row.validated,
    isApproved: row.isApproved,
    metadata: safeJsonParse(row.metadata),
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
