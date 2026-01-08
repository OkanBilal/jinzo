import { eq } from "drizzle-orm";
import { getDb,getSqlite } from "../../../main/db/client";
import { feedItems, feedItemChunks } from "../../../main/db/schema";
import type { ChunkData, ItemChunkInfo } from "../../../renderer/lib/cron/types";
import { FeedItem } from "../../../renderer/lib/cron/types";

export interface InsertFeedItemResult {
  success: boolean;
  itemId?: number;
  error?: string;
}

export async function insertFeedItem(
  item: FeedItem,
  embedding: number[]
): Promise<InsertFeedItemResult> {
  try {
    const db = getDb();
    const sqlite = getSqlite();
    const embeddingBuf = Buffer.from(Float32Array.from(embedding).buffer);

    const result = await db
      .insert(feedItems)
      .values({
        title: item.title,
        url: item.url,
        description: item.description ?? null,
        date: new Date(item.date),
        source: item.source,
        imageUrl: item.imageUrl ?? null,
        metadata: item.metadata ? JSON.stringify(item.metadata) : null,
        embedding: embeddingBuf,
        itemType: item.itemType ?? null,
        connectionId: item.connectionId ?? null,
        resourceId: item.resourceId ?? null,
      })
      .onConflictDoNothing({ target: feedItems.url });

    if (result.changes === 0) {
      return { success: false };
    }

    const insertedItem = await db
      .select({ id: feedItems.id })
      .from(feedItems)
      .where(eq(feedItems.url, item.url))
      .limit(1)
      .then((rows) => rows[0]);

    if (!insertedItem) {
      return { success: false, error: "Failed to retrieve inserted item" };
    }

    const vecResult = sqlite
      .prepare(`INSERT INTO vec_feed_items(embedding) VALUES (?)`)
      .run(embeddingBuf);

    sqlite
      .prepare(`INSERT INTO vec_feed_item_map(vec_rowid, feed_item_id) VALUES (?, ?)`)
      .run(vecResult.lastInsertRowid, insertedItem.id);

    return { success: true, itemId: insertedItem.id };
  } catch (err) {
    console.error(`❌ Error inserting item ${item.url}:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function insertItemChunks(
  itemId: number,
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

      const chunkResult = await db.insert(feedItemChunks).values({
        feedItemId: itemId,
        chunkIndex: chunkData.chunk.index,
        content: chunkData.chunk.content,
        tokenCount: chunkData.chunk.tokenCount,
      });

      if (chunkResult.changes > 0) {
        const chunkId = chunkResult.lastInsertRowid;

        const vecResult = sqlite
          .prepare(`INSERT INTO vec_chunks(embedding) VALUES (?)`)
          .run(chunkEmbeddingBuf);

        sqlite
          .prepare(`INSERT INTO vec_chunk_map(vec_rowid, chunk_id) VALUES (?, ?)`)
          .run(vecResult.lastInsertRowid, chunkId);

        insertedChunks++;
      }
    } catch (err) {
      console.error(`❌ Error inserting chunk for item ${itemId}:`, err);
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

export async function processAndInsertItems(
  items: FeedItem[],
  chunks: ChunkData[],
  embeddings: number[][],
  itemChunkMap: Map<number, ItemChunkInfo[]>
): Promise<InsertionStats> {
  console.log("💾 Processing and inserting items...");

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
      console.warn(`⚠️  No chunks for item: ${item.url}`);
      stats.errors++;
      continue;
    }

    const firstEmbedding = embeddings[itemChunks[0].embeddingIndex];
    const insertResult = await insertFeedItem(item, firstEmbedding);

    if (!insertResult.success) {
      if (insertResult.error) {
        stats.errors++;
      } else {
        stats.skipped++; // Duplicate
      }
      continue;
    }

    stats.inserted++;

    const chunksInserted = await insertItemChunks(
      insertResult.itemId!,
      chunks,
      embeddings,
      itemChunks
    );

    stats.totalChunks += chunksInserted;
  }

  console.log(`✅ Insertion complete:`, stats);

  return stats;
}
