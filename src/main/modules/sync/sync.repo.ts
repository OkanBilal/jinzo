import { eq, and, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, getSqlite } from "../../db/client";
import { entities, entityChunks, issues } from "../../db/schema";
import type { ChunkData, ItemChunkInfo, EntityInput, SyncJobStats } from "./sync.dto";

const DEFAULT_ACCOUNT_ID = "default";

// ─────────────────────────────────────────────────────────────
// Repository - Database operations
// ─────────────────────────────────────────────────────────────
export interface UpsertEntityResult {
  status: "inserted" | "updated" | "error";
  entityId?: string;
  error?: string;
}

export const syncRepo = {
  async findEntityByUrl(url: string, connectionId: string | null): Promise<{ id: string } | null> {
    const db = getDb();
    const connectionFilter = connectionId
      ? eq(entities.connectionId, connectionId)
      : isNull(entities.connectionId);

    const result = await db
      .select({ id: entities.id })
      .from(entities)
      .where(and(eq(entities.url, url), connectionFilter))
      .limit(1);

    return result[0] ?? null;
  },

  async upsertEntity(
    item: EntityInput,
    accountId: string = DEFAULT_ACCOUNT_ID
  ): Promise<UpsertEntityResult> {
    try {
      const db = getDb();
      const existing = await this.findEntityByUrl(item.url, item.connectionId ?? null);

      const metadataJson = item.metadata ? JSON.stringify(item.metadata) : null;
      const occurredAt = item.occurredAt ? new Date(item.occurredAt) : new Date();

      let entityId: string;

      if (existing) {
        entityId = existing.id;
        await db.update(entities)
          .set({
            title: item.title,
            body: item.body,
            summary: item.summary,
            occurredAt,
            metadata: metadataJson,
            externalId: item.externalId || null,
            resourceId: item.resourceId || null,
            updatedAt: sql`(unixepoch())`,
          })
          .where(eq(entities.id, entityId));
      } else {
        entityId = nanoid();
        await db.insert(entities).values({
          id: entityId,
          accountId,
          kind: item.kind,
          title: item.title,
          url: item.url,
          body: item.body,
          summary: item.summary,
          occurredAt,
          connectionId: item.connectionId || null,
          resourceId: item.resourceId || null,
          externalId: item.externalId || null,
          metadata: metadataJson,
        });
      }

      // Upsert issues table for issue entities
      if (item.kind === "issue" && item.metadata && typeof item.metadata === "object") {
        await this.upsertIssue(entityId, item.metadata as Record<string, unknown>);
      }

      return { status: existing ? "updated" : "inserted", entityId };
    } catch (err) {
      console.error(`❌ Error upserting entity ${item.url}:`, err);
      return {
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async upsertIssue(entityId: string, meta: Record<string, unknown>): Promise<void> {
    const db = getDb();

    let closedAtDate: Date | null = null;
    const closedAtValue = meta.closedAt || meta.completedAt;
    if (closedAtValue) {
      closedAtDate = typeof closedAtValue === "string"
        ? new Date(closedAtValue)
        : closedAtValue instanceof Date
          ? closedAtValue
          : null;
    }

    const issueValues = {
      provider: (meta.provider as string) || "unknown",
      state: (meta.state as string) || "open",
      number: typeof meta.number === "number" ? meta.number : null,
      repo: (meta.repo as string) || null,
      assignee: (meta.assignee as string) || null,
      labels: Array.isArray(meta.labels) ? JSON.stringify(meta.labels) : null,
      closedAt: closedAtDate,
      priority: typeof meta.priority === "number" ? meta.priority : 0,
    };

    const existing = await db
      .select({ entityId: issues.entityId })
      .from(issues)
      .where(eq(issues.entityId, entityId))
      .limit(1);

    if (existing.length > 0) {
      await db.update(issues).set(issueValues).where(eq(issues.entityId, entityId));
    } else {
      await db.insert(issues).values({ entityId, ...issueValues });
    }
  },

  async upsertEntities(
    items: EntityInput[],
    accountId: string = DEFAULT_ACCOUNT_ID
  ): Promise<SyncJobStats> {
    const db = getDb();
    const stats: SyncJobStats = { inserted: 0, updated: 0, skipped: 0, errors: 0, totalChunks: 0 };

    db.transaction(() => {
      for (const item of items) {
        const result = this.upsertEntitySync(item, accountId);
        const key = result.status === "error" ? "errors" : result.status;
        stats[key]++;
      }
    });

    return stats;
  },

  upsertEntitySync(
    item: EntityInput,
    accountId: string = DEFAULT_ACCOUNT_ID
  ): UpsertEntityResult {
    try {
      const db = getDb();
      const connectionId = item.connectionId ?? null;
      const connectionFilter = connectionId
        ? eq(entities.connectionId, connectionId)
        : isNull(entities.connectionId);

      const existing = db
        .select({ id: entities.id })
        .from(entities)
        .where(and(eq(entities.url, item.url), connectionFilter))
        .limit(1)
        .get();

      const metadataJson = item.metadata ? JSON.stringify(item.metadata) : null;
      const occurredAt = item.occurredAt ? new Date(item.occurredAt) : new Date();

      let entityId: string;

      if (existing) {
        entityId = existing.id;
        db.update(entities)
          .set({
            title: item.title,
            body: item.body,
            summary: item.summary,
            occurredAt,
            metadata: metadataJson,
            externalId: item.externalId || null,
            resourceId: item.resourceId || null,
            updatedAt: sql`(unixepoch())`,
          })
          .where(eq(entities.id, entityId))
          .run();
      } else {
        entityId = nanoid();
        db.insert(entities).values({
          id: entityId,
          accountId,
          kind: item.kind,
          title: item.title,
          url: item.url,
          body: item.body,
          summary: item.summary,
          occurredAt,
          connectionId: connectionId,
          resourceId: item.resourceId || null,
          externalId: item.externalId || null,
          metadata: metadataJson,
        }).run();
      }

      if (item.kind === "issue" && item.metadata && typeof item.metadata === "object") {
        this.upsertIssueSync(entityId, item.metadata as Record<string, unknown>);
      }

      return { status: existing ? "updated" : "inserted", entityId };
    } catch (err) {
      console.error(`❌ Error upserting entity ${item.url}:`, err);
      return {
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  upsertIssueSync(entityId: string, meta: Record<string, unknown>): void {
    const db = getDb();

    let closedAtDate: Date | null = null;
    const closedAtValue = meta.closedAt || meta.completedAt;
    if (closedAtValue) {
      closedAtDate = typeof closedAtValue === "string"
        ? new Date(closedAtValue)
        : closedAtValue instanceof Date
          ? closedAtValue
          : null;
    }

    const issueValues = {
      provider: (meta.provider as string) || "unknown",
      state: (meta.state as string) || "open",
      number: typeof meta.number === "number" ? meta.number : null,
      repo: (meta.repo as string) || null,
      assignee: (meta.assignee as string) || null,
      labels: Array.isArray(meta.labels) ? JSON.stringify(meta.labels) : null,
      closedAt: closedAtDate,
      priority: typeof meta.priority === "number" ? meta.priority : 0,
    };

    const existing = db
      .select({ entityId: issues.entityId })
      .from(issues)
      .where(eq(issues.entityId, entityId))
      .limit(1)
      .get();

    if (existing) {
      db.update(issues).set(issueValues).where(eq(issues.entityId, entityId)).run();
    } else {
      db.insert(issues).values({ entityId, ...issueValues }).run();
    }
  },

  // TODO: Re-enable when chunking & embedding pipeline is restored
  async insertEntityChunks(
    entityId: string,
    chunks: ChunkData[],
    embeddings: number[][],
    itemChunks: ItemChunkInfo[]
  ): Promise<number> {
    const db = getDb();
    const sqlite = getSqlite();
    let insertedChunks = 0;

    for (const { embeddingIndex } of itemChunks) {
      const chunkData = chunks[embeddingIndex];
      const embedding = embeddings[embeddingIndex];

      if (!embedding || embedding.length === 0) {
        console.warn(`⚠️  Missing embedding for chunk at index ${embeddingIndex}`);
        continue;
      }

      try {
        const chunkEmbeddingBuf = Buffer.from(
          Float32Array.from(embedding).buffer
        );

        const chunkResult = await db.insert(entityChunks).values({
          entityId,
          chunkIndex: chunkData.chunk.index,
          content: chunkData.chunk.content,
          tokenCount: chunkData.chunk.tokenCount,
        });

        if (chunkResult.changes > 0) {
          const chunkId = chunkResult.lastInsertRowid;

          const vecResult = sqlite
            .prepare(`INSERT INTO vec_entity_chunks(embedding) VALUES (?)`)
            .run(chunkEmbeddingBuf);

          sqlite
            .prepare(`INSERT INTO vec_entity_chunk_map(vec_rowid, chunk_id) VALUES (?, ?)`)
            .run(vecResult.lastInsertRowid, chunkId);

          insertedChunks++;
        }
      } catch (err) {
        console.error(`❌ Error inserting chunk for entity ${entityId}:`, err);
      }
    }

    return insertedChunks;
  },

  async processAndInsertEntities(
    items: EntityInput[],
    chunks: ChunkData[],
    embeddings: number[][],
    itemChunkMap: Map<number, ItemChunkInfo[]>,
    accountId: string = DEFAULT_ACCOUNT_ID
  ): Promise<SyncJobStats> {
    console.log("💾 Processing and inserting entities...");

    const stats: SyncJobStats = {
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      totalChunks: 0,
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemChunks = itemChunkMap.get(i) || [];

      if (itemChunks.length === 0) {
        console.warn(`⚠️  No chunks for entity: ${item.url}`);
        stats.errors++;
        continue;
      }

      const insertResult = await this.upsertEntity(item, accountId);

      if (insertResult.status === "error") {
        stats.errors++;
        continue;
      }

      stats[insertResult.status]++;

      const chunksInserted = await this.insertEntityChunks(
        insertResult.entityId!,
        chunks,
        embeddings,
        itemChunks
      );

      stats.totalChunks += chunksInserted;
    }

    console.log(`✅ Insertion complete:`, stats);

    return stats;
  },
};
