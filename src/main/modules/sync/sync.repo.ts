import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb, getSqlite } from "../../db/client";
import { entities, entityChunks, issues } from "../../db/schema";
import type { ChunkData, ItemChunkInfo, EntityInput, SyncJobStats } from "./sync.dto";

const DEFAULT_ACCOUNT_ID = "default";

// ─────────────────────────────────────────────────────────────
// Repository - Database operations
// ─────────────────────────────────────────────────────────────
export interface InsertEntityResult {
  success: boolean;
  entityId?: string;
  error?: string;
}

export const syncRepo = {
  async findEntityByUrl(url: string, connectionId: string | null): Promise<{ id: string } | null> {
    const db = getDb();
    const result = await db
      .select({ id: entities.id })
      .from(entities)
      .where(
        and(
          eq(entities.url, url),
          eq(entities.connectionId, connectionId || "")
        )
      )
      .limit(1);

    return result[0] ?? null;
  },

  async insertEntity(
    item: EntityInput,
    accountId: string = DEFAULT_ACCOUNT_ID
  ): Promise<InsertEntityResult> {
    try {
      const db = getDb();
      const entityId = uuidv4();

      // Check if entity already exists
      const existing = await this.findEntityByUrl(item.url, item.connectionId ?? null);
      if (existing) {
        return { success: false }; // Duplicate
      }

      await db.insert(entities).values({
        id: entityId,
        accountId,
        kind: item.kind,
        title: item.title,
        url: item.url,
        body: item.body,
        summary: item.summary,
        occurredAt: item.occurredAt ? new Date(item.occurredAt) : new Date(),
        connectionId: item.connectionId || null,
        resourceId: item.resourceId || null,
        externalId: item.externalId || null,
        metadata: item.metadata ? JSON.stringify(item.metadata) : null,
      });

      // If entity kind is "issue", also insert into issues table
      if (item.kind === "issue" && item.metadata && typeof item.metadata === "object") {
        const meta = item.metadata as Record<string, unknown>;
        await db.insert(issues).values({
          entityId,
          provider: (meta.provider as string) || "unknown",
          state: (meta.state as string) || "open",
          number: typeof meta.number === "number" ? meta.number : null,
          repo: (meta.repo as string) || null,
          assignee: (meta.assignee as string) || null,
          labels: Array.isArray(meta.labels) ? JSON.stringify(meta.labels) : null,
          priority: 0,
        });
      }

      return { success: true, entityId };
    } catch (err) {
      console.error(`❌ Error inserting entity ${item.url}:`, err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

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

      const insertResult = await this.insertEntity(item, accountId);

      if (!insertResult.success) {
        if (insertResult.error) {
          stats.errors++;
        } else {
          stats.skipped++; // Duplicate
        }
        continue;
      }

      stats.inserted++;

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
