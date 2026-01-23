import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { feedItems } from "../../db/schema";
import type { SQL } from "drizzle-orm";
import type { FeedItemRecord } from "./feed.dto";

// ─────────────────────────────────────────────────────────────
// Feed Repository
// ─────────────────────────────────────────────────────────────
export const feedRepo = {
  async findMany(whereClause: SQL | undefined, limit: number): Promise<FeedItemRecord[]> {
    const db = getDb();
    return db.query.feedItems.findMany({
      where: whereClause,
      orderBy: [desc(feedItems.occurredAt)],
      limit,
    }) as unknown as Promise<FeedItemRecord[]>;
  },

  async findById(id: number): Promise<FeedItemRecord | null> {
    const db = getDb();
    const items = await db.query.feedItems.findMany({
      where: eq(feedItems.id, id),
      limit: 1,
    });
    return (items[0] as FeedItemRecord) || null;
  },

  async findByEntityId(entityId: string): Promise<FeedItemRecord[]> {
    const db = getDb();
    return db.query.feedItems.findMany({
      where: eq(feedItems.entityId, entityId),
      orderBy: [desc(feedItems.occurredAt)],
    }) as unknown as Promise<FeedItemRecord[]>;
  },
};
