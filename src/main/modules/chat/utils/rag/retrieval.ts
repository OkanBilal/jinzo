import { generateEmbeddingCached } from "./embed";
import { float32ToBuffer } from "./float-to-buffer";
import { MIN_TOKEN_LENGTH, DEFAULT_DECAY_LAMBDA, TIME_CONSTANTS, DISTANCE_BOUNDS, BM25_PARAMS, MAX_PER_SOURCE_RATIO, ITEM_TYPES } from "../../chat.constants";
import { RetrievalOptions, RetrievedEntity, ItemTypeId, SourceId } from "./types";
import { getSqlite } from "../../../../db/client";

/**
 * Converts item type IDs to entity kinds for filtering.
 * Used when query analysis detects item types from user input.
 */
export function itemTypesToKinds(itemTypeIds: ItemTypeId[]): string[] {
  const kinds: string[] = [];
  for (const typeId of itemTypeIds) {
    const itemType = ITEM_TYPES.find((t) => t.id === typeId);
    if (itemType) {
      kinds.push(...itemType.entityKinds);
    } else {
      kinds.push(typeId);
    }
  }
  return kinds;
}

/**
 * Converts source IDs (provider names) to connection IDs for filtering.
 * Looks up connections by provider name in the database.
 */
export function sourcesToConnectionIds(sourceIds: SourceId[]): string[] {
  if (sourceIds.length === 0) return [];
  try {
    const sqlite = getSqlite();
    const placeholders = sourceIds.map(() => "?").join(",");
    const rows = sqlite
      .prepare(`SELECT id FROM connections WHERE provider IN (${placeholders})`)
      .all(...sourceIds) as { id: string }[];
    return rows.map((r) => r.id);
  } catch (error) {
    console.warn("Failed to resolve sources to connectionIds:", error);
    return [];
  }
}

// Query expansion: abbreviation → full terms (bidirectional)
const QUERY_EXPANSIONS: Record<string, string[]> = {
  pr: ["pull request"],
  prs: ["pull requests"],
  hn: ["hacker news"],
  yt: ["youtube"],
  gh: ["github"],
  repo: ["repository"],
  repos: ["repositories"],
  js: ["javascript"],
  ts: ["typescript"],
  db: ["database"],
  api: ["endpoint", "interface"],
  auth: ["authentication", "authorization"],
  deps: ["dependencies"],
  env: ["environment"],
  config: ["configuration"],
  docs: ["documentation"],
};

function expandQuery(query: string): string {
  const tokens = query.toLowerCase().split(/\s+/);
  const expanded = new Set(tokens);

  for (const token of tokens) {
    const expansions = QUERY_EXPANSIONS[token];
    if (expansions) {
      for (const expansion of expansions) {
        expanded.add(expansion);
      }
    }
  }

  return Array.from(expanded).join(" ");
}

let cachedAvgDocLength: number | null = null;
let cachedTotalDocs: number | null = null;
let corpusStatsTimestamp = 0;
const CORPUS_STATS_TTL = 5 * 60 * 1000; // 5 minutes

function invalidateCorpusStatsIfStale(): void {
  if (Date.now() - corpusStatsTimestamp > CORPUS_STATS_TTL) {
    cachedAvgDocLength = null;
    cachedTotalDocs = null;
  }
}

function getCorpusStats(): { avgDocLength: number; totalDocs: number } {
  invalidateCorpusStatsIfStale();

  if (cachedAvgDocLength !== null && cachedTotalDocs !== null) {
    return { avgDocLength: cachedAvgDocLength, totalDocs: cachedTotalDocs };
  }

  const sqlite = getSqlite();
  const result = sqlite
    .prepare(
      `
    SELECT
      AVG(LENGTH(title) + COALESCE(LENGTH(body), 0)) as avg_length,
      COUNT(*) as total_docs
    FROM entities
  `
    )
    .get() as { avg_length: number; total_docs: number };

  cachedAvgDocLength = result.avg_length || 500;
  cachedTotalDocs = result.total_docs || 1;
  corpusStatsTimestamp = Date.now();

  return { avgDocLength: cachedAvgDocLength, totalDocs: cachedTotalDocs };
}

function getDocumentFrequency(term: string): number {
  const sqlite = getSqlite();
  const result = sqlite
    .prepare(
      `
    SELECT COUNT(*) as df
    FROM entities
    WHERE LOWER(title || ' ' || COALESCE(body, '') || ' ' || COALESCE(summary, '')) LIKE ?
  `
    )
    .get(`%${term.toLowerCase()}%`) as { df: number };

  return result.df || 0;
}

function keywordScore(query: string, text: string): number {
  const expandedQuery = expandQuery(query);
  const queryTokens = expandedQuery
    .split(/\s+/)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH);

  if (queryTokens.length === 0) return 0;

  const textLower = text.toLowerCase();
  const docLength = text.length;
  const { avgDocLength, totalDocs } = getCorpusStats();

  let bm25Score = 0;

  for (const token of queryTokens) {
    const regex = new RegExp(`\\b${token}\\b`, "gi");
    const matches = textLower.match(regex);

    if (!matches) continue;

    const termFreq = matches.length;
    const df = getDocumentFrequency(token);

    // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
    const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);

    const numerator = termFreq * (BM25_PARAMS.K1 + 1);
    const denominator =
      termFreq +
      BM25_PARAMS.K1 *
        (1 - BM25_PARAMS.B + BM25_PARAMS.B * (docLength / avgDocLength));

    bm25Score += idf * (numerator / denominator);
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
    minScore = 0.1,
    recencyWeight = 0.1,
    semanticWeight = 0.7,
    keywordWeight = 0.3,
    rerank = true,
    kindFilter,
    connectionIdFilter,
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
    console.error("Error in vector search, falling back to keyword-only:", error);
    return keywordOnlyFallback(question, {
      topK,
      minScore,
      recencyWeight,
      keywordWeight,
      kindFilter,
      connectionIdFilter,
      rerank,
    });
  }
}

function keywordOnlyFallback(
  question: string,
  opts: {
    topK: number;
    minScore: number;
    recencyWeight: number;
    keywordWeight: number;
    kindFilter?: string[];
    connectionIdFilter?: string[];
    rerank: boolean;
  }
): RetrievedEntity[] {
  const { topK, minScore, recencyWeight, keywordWeight, kindFilter, connectionIdFilter, rerank } = opts;

  try {
    const sqlite = getSqlite();
    const conditions: string[] = [];
    const params: any[] = [];

    if (kindFilter && kindFilter.length > 0) {
      conditions.push(`kind IN (${kindFilter.map(() => "?").join(",")})`);
      params.push(...kindFilter);
    }
    if (connectionIdFilter && connectionIdFilter.length > 0) {
      conditions.push(`connection_id IN (${connectionIdFilter.map(() => "?").join(",")})`);
      params.push(...connectionIdFilter);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = topK * 10;
    params.push(limit);

    const rows = sqlite
      .prepare(
        `
      SELECT id, title, url, body, summary, kind, occurred_at as occurredAt,
             connection_id as connectionId, metadata
      FROM entities
      ${whereClause}
      ORDER BY occurred_at DESC
      LIMIT ?
    `
      )
      .all(...params) as any[];

    let scored: RetrievedEntity[] = rows
      .map((r) => {
        const textContent = [r.title, r.body || r.summary].filter(Boolean).join(" ");
        const kwScore = keywordScore(question, textContent);
        const recency = timestampDecayBoost(new Date(r.occurredAt), DEFAULT_DECAY_LAMBDA);
        const score = kwScore * keywordWeight + recency * recencyWeight;

        return {
          id: r.id,
          title: r.title,
          url: r.url,
          body: r.body,
          summary: r.summary,
          kind: r.kind,
          occurredAt: new Date(r.occurredAt),
          connectionId: r.connectionId,
          score,
          semanticScore: 0,
          keywordScore: kwScore,
          metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
        };
      })
      .filter((r) => r.keywordScore > 0);

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

    console.log(`🔍 Keyword fallback: Returning ${scored.length} entities from ${rows.length} candidates`);
    return scored;
  } catch (fallbackError) {
    console.error("Keyword fallback also failed:", fallbackError);
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
