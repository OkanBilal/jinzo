import { generateEmbeddingCached } from "./embed";
import { float32ToBuffer } from "./float-to-buffer";
import { MIN_TOKEN_LENGTH, DEFAULT_DECAY_LAMBDA, TIME_CONSTANTS, DISTANCE_BOUNDS, BM25_PARAMS, MAX_PER_SOURCE_RATIO } from "../../chat.constants";
import { RetrievalOptions, RetrievedEntity } from "./types";
import { getSqlite } from "../../../../db/client";

// TODO: query expansion, synonym handling

let cachedAvgDocLength: number | null = null;

// TODO: move db query to api
function getAverageDocLength(): number {
  if (cachedAvgDocLength !== null) {
    return cachedAvgDocLength;
  }

  const sqlite = getSqlite();
  const result = sqlite
    .prepare(
      `
    SELECT AVG(LENGTH(title) + COALESCE(LENGTH(body), 0)) as avg_length
    FROM entities
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
  kindFilter?: string[],
  connectionIdFilter?: string[]
): string[] {
  const conditions: string[] = [];

  if (kindFilter && kindFilter.length > 0) {
    conditions.push(`e.kind IN (${kindFilter.map(() => "?").join(",")})`);
  }
  if (connectionIdFilter && connectionIdFilter.length > 0) {
    conditions.push(
      `e.connection_id IN (${connectionIdFilter.map(() => "?").join(",")})`
    );
  }
  return conditions;
}

function buildQueryParams(
  qVecBuffer: Buffer,
  kindFilter?: string[],
  connectionIdFilter?: string[],
  limit?: number
): any[] {
  const params: any[] = [qVecBuffer];

  if (kindFilter && kindFilter.length > 0) {
    params.push(...kindFilter);
  }
  if (connectionIdFilter && connectionIdFilter.length > 0) {
    params.push(...connectionIdFilter);
  }
  if (limit) {
    params.push(limit);
  }
  return params;
}

export async function findRelevantEntities(
  question: string,
  options: RetrievalOptions = {}
): Promise<RetrievedEntity[]> {
  const {
    topK = 5,
    minScore = -1,
    recencyWeight = 0.1,
    semanticWeight = 0.7,
    keywordWeight = 0.3,
    kindFilter,
    connectionIdFilter,
    rerank = true,
  } = options;

  try {
    const sqlite = getSqlite();
    const qVec = await generateEmbeddingCached(question);
    const qVecBuffer = float32ToBuffer(qVec);
    const chunkLimit = rerank ? topK * 10 : topK * 3;
    let query = `
      SELECT 
        e.id,
        e.title,
        e.url,
        e.body,
        e.summary,
        e.kind,
        e.occurred_at as occurredAt,
        e.connection_id as connectionId,
        e.metadata,
        c.content as chunk_content,
        c.chunk_index as chunk_index,
        vec_distance_cosine(v.embedding, ?) as distance
      FROM vec_entity_chunks v
      JOIN vec_entity_chunk_map m ON m.vec_rowid = v.rowid
      JOIN entity_chunks c ON c.id = m.chunk_id
      JOIN entities e ON e.id = c.entity_id
    `;
    const whereConditions = buildFilterConditions(kindFilter, connectionIdFilter);
    const params = buildQueryParams(qVecBuffer, kindFilter, connectionIdFilter);
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }
    query += `
      ORDER BY distance
      LIMIT ?
    `;
    params.push(chunkLimit);
    const chunkRows = sqlite.prepare(query).all(...params) as any[];
    const entityScores = new Map<
      string,
      {
        entity: any;
        bestChunkDistance: number;
        chunks: Array<{ content: string; distance: number; index: number }>;
      }
    >();
    for (const row of chunkRows) {
      if (!entityScores.has(row.id)) {
        entityScores.set(row.id, {
          entity: row,
          bestChunkDistance: row.distance,
          chunks: [],
        });
      }
      const entityData = entityScores.get(row.id)!;
      entityData.chunks.push({
        content: row.chunk_content,
        distance: row.distance,
        index: row.chunk_index,
      });
      if (row.distance < entityData.bestChunkDistance) {
        entityData.bestChunkDistance = row.distance;
      }
    }
    const rows = Array.from(entityScores.values()).map(
      ({ entity, bestChunkDistance, chunks }) => ({
        ...entity,
        distance: bestChunkDistance,
        chunkCount: chunks.length,
        relevantChunks: chunks.slice(0, 3),
      })
    );
    let scored: RetrievedEntity[] = rows.map((r) => {
      const semanticSimilarity = distanceToSimilarity(r.distance);
      const chunkTexts =
        r.relevantChunks?.map((c: any) => c.content).join(" ") || "";
      const textContent = [r.title, r.body || r.summary, chunkTexts]
        .filter(Boolean)
        .join(" ");
      const kwScore = keywordScore(question, textContent);
      const chunkBonus = calculateChunkBonus(r.chunkCount);
      const recency = timestampDecayBoost(
        new Date(r.occurredAt),
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
        body: r.body,
        summary: r.summary,
        kind: r.kind,
        occurredAt: new Date(r.occurredAt),
        connectionId: r.connectionId,
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
      `🔍 Chunk-based search: Found ${chunkRows.length} chunks from ${entityScores.size} entities, returning ${scored.length} entities`
    );
    return scored;
  } catch (error) {
    console.error("Error in vector search:", error);
    return [];
  }
}

function diversityRerank(
  items: RetrievedEntity[],
  topK: number
): RetrievedEntity[] {
  const result: RetrievedEntity[] = [];
  const kindCounts = new Map<string, number>();
  const MAX_PER_KIND = Math.ceil(topK * MAX_PER_SOURCE_RATIO);

  for (const item of items) {
    const currentCount = kindCounts.get(item.kind) || 0;
    if (currentCount < MAX_PER_KIND && result.length < topK) {
      result.push(item);
      kindCounts.set(item.kind, currentCount + 1);
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
