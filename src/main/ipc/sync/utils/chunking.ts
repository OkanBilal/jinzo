import { chunkEntity, generateEmbeddingsBatch, getOptimalChunkConfig, preprocessTextForEmbedding } from "../../chat/utils/rag";
import type { ChunkData, ItemChunkInfo, EntityInput } from "./types";



export function createChunksForEntities(entities: EntityInput[]): ChunkData[] {
  console.log("✂️  Creating chunks for entities...");

  const allChunks: ChunkData[] = [];

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const fullText = [entity.title, entity.body || entity.summary]
      .filter(Boolean)
      .join("\n\n");

    const config = getOptimalChunkConfig(fullText.length);
    const chunks = chunkEntity(entity.title, entity.body || entity.summary, config);

    chunks.forEach((chunk) => {
      allChunks.push({ itemIndex: i, chunk });
    });
  }

  const avgChunksPerEntity = (allChunks.length / entities.length).toFixed(1);
  console.log(
    `📝 Created ${allChunks.length} chunks from ${entities.length} entities (avg: ${avgChunksPerEntity} chunks/entity)`
  );

  return allChunks;
}

export function createEntityChunkMap(
  chunks: ChunkData[]
): Map<number, ItemChunkInfo[]> {
  const entityChunkMap = new Map<number, ItemChunkInfo[]>();

  chunks.forEach(({ itemIndex, chunk }, embeddingIndex) => {
    if (!entityChunkMap.has(itemIndex)) {
      entityChunkMap.set(itemIndex, []);
    }
    entityChunkMap.get(itemIndex)!.push({
      chunkIndex: chunk.index,
      embeddingIndex,
    });
  });

  return entityChunkMap;
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
