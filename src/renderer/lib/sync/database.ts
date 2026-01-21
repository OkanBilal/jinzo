import { eq, and } from "drizzle-orm";
import { getDb, getSqlite } from "../../../main/db/client";
import { entities, entityChunks, } from "../../../main/db/schema";
import type { ChunkData, ItemChunkInfo } from "./types";
import { EntityInput } from "./types";
import { v4 as uuidv4 } from "uuid";

const DEFAULT_ACCOUNT_ID = "default";

export interface InsertEntityResult {
  success: boolean;
  entityId?: string;
  error?: string;
}

export async function insertEntity(
  item: EntityInput,
  embedding: number[],
  accountId: string = DEFAULT_ACCOUNT_ID
): Promise<InsertEntityResult> {
  try {
    const db = getDb();
    const entityId = uuidv4();

    // Check if entity already exists by URL and connectionId
    const existing = await db
      .select({ id: entities.id })
      .from(entities)
      .where(
        and(
          eq(entities.url, item.url),
          eq(entities.connectionId, item.connectionId || "")
        )
      )
      .limit(1)
      .then((rows) => rows[0]);

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

    // Don't insert chunks here - they will be inserted via insertEntityChunks
    return { success: true, entityId };
  } catch (err) {
    console.error(`❌ Error inserting entity ${item.url}:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function insertEntityChunks(
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
      console.warn(
        `⚠️  Missing embedding for chunk at index ${embeddingIndex}`
      );
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
}

export interface InsertionStats {
  inserted: number;
  skipped: number;
  errors: number;
  totalChunks: number;
}

export async function processAndInsertEntities(
  items: EntityInput[],
  chunks: ChunkData[],
  embeddings: number[][],
  itemChunkMap: Map<number, ItemChunkInfo[]>,
  accountId: string = DEFAULT_ACCOUNT_ID
): Promise<InsertionStats> {
  console.log("💾 Processing and inserting entities...");

  const stats: InsertionStats = {
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

    const firstEmbedding = embeddings[itemChunks[0].embeddingIndex];
    const insertResult = await insertEntity(item, firstEmbedding, accountId);

    if (!insertResult.success) {
      if (insertResult.error) {
        stats.errors++;
      } else {
        stats.skipped++; // Duplicate
      }
      continue;
    }

    stats.inserted++;

    const chunksInserted = await insertEntityChunks(
      insertResult.entityId!,
      chunks,
      embeddings,
      itemChunks
    );

    stats.totalChunks += chunksInserted;
  }

  console.log(`✅ Insertion complete:`, stats);

  return stats;
}
