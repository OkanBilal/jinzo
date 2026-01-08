import { getSqlite } from "../../../main/db/client";
import { generateEmbeddingCached } from "./embed";
import { float32ToBuffer } from "./float-to-buffer";
import { MIN_TOKEN_LENGTH, DEFAULT_DECAY_LAMBDA, TIME_CONSTANTS, DISTANCE_BOUNDS, BM25_PARAMS,MAX_PER_SOURCE_RATIO } from "../config";
import { RetrievalOptions, RetrievedFeedItem } from "./types";

// TODO query expansion, synonym handling

let cachedAvgDocLength: number | null = null;

// TODO move db query to api
function getAverageDocLength(): number {
  if (cachedAvgDocLength !== null) {
    return cachedAvgDocLength;
  }

  const sqlite = getSqlite();
  const result = sqlite
    .prepare(
      `
    SELECT AVG(LENGTH(title) + COALESCE(LENGTH(description), 0)) as avg_length
    FROM FeedItem
  `
    )
    .get() as { avg_length: number };

  cachedAvgDocLength = result.avg_length || 500;
  return cachedAvgDocLength;
}

function keywordScore(query: string, text: string): number {
  const queryTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH);

  if (queryTokens.length === 0) return 0;

  const textLower = text.toLowerCase();
  const docLength = text.length;
  const avgDocLength = getAverageDocLength();

  let bm25Score = 0;

  for (const token of queryTokens) {
    const regex = new RegExp(`\\b${token}\\b`, "gi");
    const matches = textLower.match(regex);

    if (!matches) continue;

    const termFreq = matches.length;

    const numerator = termFreq * (BM25_PARAMS.K1 + 1);
    const denominator =
      termFreq +
      BM25_PARAMS.K1 *
        (1 - BM25_PARAMS.B + BM25_PARAMS.B * (docLength / avgDocLength));

    bm25Score += numerator / denominator;
  }

  return bm25Score;
}

function timestampDecayBoost(
  date: Date,
  lambda = DEFAULT_DECAY_LAMBDA
): number {
  const daysSince = (Date.now() - date.getTime()) / TIME_CONSTANTS.MS_PER_DAY;
  return Math.exp(-lambda * daysSince);
}

function distanceToSimilarity(distance: number): number {
  return 1 - distance / DISTANCE_BOUNDS.MAX;
}

function calculateChunkBonus(chunkCount: number): number {
  return chunkCount > 1 ? Math.log(chunkCount) * 0.05 : 0;
}

function buildFilterConditions(
  sourceFilter?: string[],
  itemTypeFilter?: string[]
): string[] {
  const conditions: string[] = [];

  if (sourceFilter && sourceFilter.length > 0) {
    conditions.push(`f.source IN (${sourceFilter.map(() => "?").join(",")})`);
  }
  if (itemTypeFilter && itemTypeFilter.length > 0) {
    conditions.push(
      `f.itemType IN (${itemTypeFilter.map(() => "?").join(",")})`
    );
  }
  return conditions;
}

function buildQueryParams(
  qVecBuffer: Buffer,
  sourceFilter?: string[],
  itemTypeFilter?: string[],
  limit?: number
): any[] {
  const params: any[] = [qVecBuffer];

  if (sourceFilter && sourceFilter.length > 0) {
    params.push(...sourceFilter);
  }
  if (itemTypeFilter && itemTypeFilter.length > 0) {
    params.push(...itemTypeFilter);
  }
  if (limit) {
    params.push(limit);
  }
  return params;
}

export async function findRelevantFeedItems(
  question: string,
  options: RetrievalOptions = {}
): Promise<RetrievedFeedItem[]> {
  const {
    topK = 5,
    minScore = -1,
    recencyWeight = 0.1,
    semanticWeight = 0.7,
    keywordWeight = 0.3,
    sourceFilter,
    itemTypeFilter,
    rerank = true,
  } = options;

  try {
    const sqlite = getSqlite();
    const qVec = await generateEmbeddingCached(question);
    const qVecBuffer = float32ToBuffer(qVec);
    const chunkLimit = rerank ? topK * 10 : topK * 3;
    let query = `
      SELECT 
        f.id,
        f.title,
        f.url,
        f.description,
        f.source,
        f.date,
        f.imageUrl,
        f.itemType,
        f.metadata,
        c.content as chunk_content,
        c.chunk_index,
        vec_distance_cosine(v.embedding, ?) as distance
      FROM vec_chunks v
      JOIN vec_chunk_map m ON m.vec_rowid = v.rowid
      JOIN FeedItemChunk c ON c.id = m.chunk_id
      JOIN FeedItem f ON f.id = c.feed_item_id
    `;
    const whereConditions = buildFilterConditions(sourceFilter, itemTypeFilter);
    const params = buildQueryParams(qVecBuffer, sourceFilter, itemTypeFilter);
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }
    query += `
      ORDER BY distance
      LIMIT ?
    `;
    params.push(chunkLimit);
    const chunkRows = sqlite.prepare(query).all(...params) as any[];
    const itemScores = new Map<
      number,
      {
        item: any;
        bestChunkDistance: number;
        chunks: Array<{ content: string; distance: number; index: number }>;
      }
    >();
    for (const row of chunkRows) {
      if (!itemScores.has(row.id)) {
        itemScores.set(row.id, {
          item: row,
          bestChunkDistance: row.distance,
          chunks: [],
        });
      }
      const itemData = itemScores.get(row.id)!;
      itemData.chunks.push({
        content: row.chunk_content,
        distance: row.distance,
        index: row.chunk_index,
      });
      if (row.distance < itemData.bestChunkDistance) {
        itemData.bestChunkDistance = row.distance;
      }
    }
    const rows = Array.from(itemScores.values()).map(
      ({ item, bestChunkDistance, chunks }) => ({
        ...item,
        distance: bestChunkDistance,
        chunkCount: chunks.length,
        relevantChunks: chunks.slice(0, 3),
      })
    );
    let scored: RetrievedFeedItem[] = rows.map((r) => {
      const semanticSimilarity = distanceToSimilarity(r.distance);
      const chunkTexts =
        r.relevantChunks?.map((c: any) => c.content).join(" ") || "";
      const textContent = [r.title, r.description, chunkTexts]
        .filter(Boolean)
        .join(" ");
      const kwScore = keywordScore(question, textContent);
      const chunkBonus = calculateChunkBonus(r.chunkCount);
      const recency = timestampDecayBoost(
        new Date(r.date),
        DEFAULT_DECAY_LAMBDA
      );
      const hybridScore =
        semanticSimilarity * semanticWeight +
        kwScore * keywordWeight +
        recency * recencyWeight +
        chunkBonus;
      return {
        id: r.id,
        title: r.title,
        url: r.url,
        description: r.description,
        source: r.source,
        date: new Date(r.date),
        imageUrl: r.imageUrl,
        itemType: r.itemType,
        score: hybridScore,
        semanticScore: semanticSimilarity,
        keywordScore: kwScore,
        metadata: r.metadata
          ? JSON.parse(r.metadata)
          : {
              chunkCount: r.chunkCount,
              relevantChunks: r.relevantChunks,
            },
      };
    });
    if (rerank) {
      const candidates = scored
        .filter((s) => s.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK * 3);
      scored = diversityRerank(candidates, topK);
    } else {
      scored = scored
        .filter((s) => s.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    }
    console.log(
      `🔍 Chunk-based search: Found ${chunkRows.length} chunks from ${itemScores.size} items, returning ${scored.length} items`
    );
    return scored;
  } catch (error) {
    console.error("Error in vector search:", error);
    return [];
  }
}

function diversityRerank(
  items: RetrievedFeedItem[],
  topK: number
): RetrievedFeedItem[] {
  const result: RetrievedFeedItem[] = [];
  const sourceCounts = new Map<string, number>();
  const MAX_PER_SOURCE = Math.ceil(topK * MAX_PER_SOURCE_RATIO);

  for (const item of items) {
    const currentCount = sourceCounts.get(item.source) || 0;
    if (currentCount < MAX_PER_SOURCE && result.length < topK) {
      result.push(item);
      sourceCounts.set(item.source, currentCount + 1);
    }
    if (result.length >= topK) break;
  }
  if (result.length < topK) {
    for (const item of items) {
      if (!result.includes(item) && result.length < topK) {
        result.push(item);
      }
    }
  }
  return result;
}
