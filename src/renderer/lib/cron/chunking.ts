import type  { ChunkData, ItemChunkInfo } from "../../../renderer/lib/cron/types";
import { chunkFeedItem, getOptimalChunkConfig } from "../../../renderer/lib/rag/chunking";
import { generateEmbeddingsBatch, preprocessTextForEmbedding } from "../rag";
import type { FeedItem } from "../../../renderer/lib/cron";


export function createChunksForItems(items: FeedItem[]): ChunkData[] {
  console.log("✂️  Creating chunks for items...");

  const allChunks: ChunkData[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const fullText = [item.title, item.description]
      .filter(Boolean)
      .join("\n\n");

    const config = getOptimalChunkConfig(fullText.length);
    const chunks = chunkFeedItem(item.title, item.description ?? null, config);

    chunks.forEach((chunk) => {
      allChunks.push({ itemIndex: i, chunk });
    });
  }

  const avgChunksPerItem = (allChunks.length / items.length).toFixed(1);
  console.log(
    `📝 Created ${allChunks.length} chunks from ${items.length} items (avg: ${avgChunksPerItem} chunks/item)`
  );

  return allChunks;
}

export function createItemChunkMap(
  chunks: ChunkData[]
): Map<number, ItemChunkInfo[]> {
  const itemChunkMap = new Map<number, ItemChunkInfo[]>();

  chunks.forEach(({ itemIndex, chunk }, embeddingIndex) => {
    if (!itemChunkMap.has(itemIndex)) {
      itemChunkMap.set(itemIndex, []);
    }
    itemChunkMap.get(itemIndex)!.push({
      chunkIndex: chunk.index,
      embeddingIndex,
    });
  });

  return itemChunkMap;
}

export async function generateChunkEmbeddings(
  chunks: ChunkData[]
): Promise<number[][]> {
  console.log(`🧮 Generating ${chunks.length} embeddings in batch...`);

  const textsToEmbed = chunks.map(({ chunk }) =>
    preprocessTextForEmbedding(chunk.content)
  );

  const embeddings = await generateEmbeddingsBatch(textsToEmbed);
  console.log(`✓ Generated ${embeddings.length} embeddings`);

  return embeddings;
}
