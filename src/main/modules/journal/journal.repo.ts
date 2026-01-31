import { desc, eq, and, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { entities, feedItems, documentRevisions } from "../../db/schema";
import { JOURNAL_KIND } from "./journal.constants";
import type { DocumentRevision } from "./journal.dto";

// Raw entity type from database
type EntityRow = typeof entities.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Journal Repository
// ─────────────────────────────────────────────────────────────
export const journalRepo = {
  async findAll(limit: number = 50): Promise<EntityRow[]> {
    const db = getDb();
    return db
      .select()
      .from(entities)
      .where(and(eq(entities.kind, JOURNAL_KIND), eq(entities.isDeleted, false)))
      .orderBy(desc(entities.updatedAt))
      .limit(limit);
  },

  async findById(entityId: string): Promise<EntityRow | undefined> {
    const db = getDb();
    const items = await db
      .select()
      .from(entities)
      .where(and(eq(entities.id, entityId), eq(entities.kind, JOURNAL_KIND)))
      .limit(1);
    return items[0];
  },

  async create(data: {
    id: string;
    accountId: string;
    kind: string;
    title: string;
    body: string;
    summary: string;
    metadata: string;
    occurredAt: Date;
  }): Promise<void> {
    const db = getDb();
    await db.insert(entities).values(data);
  },

  async update(
    entityId: string,
    data: {
      title?: string | null;
      body?: string | null;
      summary?: string | null;
      metadata?: string;
      updatedAt?: Date;
      isDeleted?: boolean;
    }
  ): Promise<void> {
    const db = getDb();
    await db.update(entities).set(data).where(eq(entities.id, entityId));
  },

  async updateMetadata(entityId: string, metadata: string): Promise<void> {
    const db = getDb();
    await db
      .update(entities)
      .set({ metadata })
      .where(eq(entities.id, entityId));
  },

  async softDelete(entityId: string): Promise<void> {
    const db = getDb();
    await db
      .update(entities)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(entities.id, entityId), eq(entities.kind, JOURNAL_KIND)));
  },

  // Feed Items
  async createFeedItem(data: {
    accountId: string;
    entityId: string;
    eventType: string;
    itemType: string;
    title: string;
    snapshot: string;
    occurredAt: Date;
  }): Promise<void> {
    const db = getDb();
    await db.insert(feedItems).values(data);
  },

  // Revisions
  async createRevision(data: {
    entityId: string;
    title: string | null;
    body: string | null;
    wordCount: number;
  }): Promise<void> {
    const db = getDb();
    await db.insert(documentRevisions).values(data);
  },

  async getRevisionCount(entityId: string): Promise<number> {
    const db = getDb();
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(documentRevisions)
      .where(eq(documentRevisions.entityId, entityId));
    return result[0]?.count || 0;
  },

  async getOldestRevisions(entityId: string, count: number): Promise<{ id: number }[]> {
    const db = getDb();
    return db
      .select({ id: documentRevisions.id })
      .from(documentRevisions)
      .where(eq(documentRevisions.entityId, entityId))
      .orderBy(documentRevisions.createdAt)
      .limit(count);
  },

  async deleteRevision(revisionId: number): Promise<void> {
    const db = getDb();
    await db.delete(documentRevisions).where(eq(documentRevisions.id, revisionId));
  },

  async findRevisions(entityId: string, limit: number = 20): Promise<DocumentRevision[]> {
    const db = getDb();
    return db
      .select()
      .from(documentRevisions)
      .where(eq(documentRevisions.entityId, entityId))
      .orderBy(desc(documentRevisions.createdAt))
      .limit(limit) as unknown as Promise<DocumentRevision[]>;
  },
};
