import { generateEmbeddingCached } from "./embed";
import { float32ToBuffer } from "./float-to-buffer";
import { MIN_TOKEN_LENGTH, DEFAULT_DECAY_LAMBDA, TIME_CONSTANTS, DISTANCE_BOUNDS, MAX_PER_SOURCE_RATIO, ITEM_TYPES } from "../../chat.constants";
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

interface FtsResult {
  id: string;
  title: string;
  url: string;
  body: string | null;
  summary: string | null;
  kind: string;
  occurredAt: number;
  connectionId: string | null;
  metadata: string | null;
  bm25Score: number;
}

function buildFtsQuery(query: string): string {
  const expanded = expandQuery(query);
  const tokens = expanded
    .split(/\s+/)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH)
    .map((t) => t.replace(/['"*(){}[\]:^~!@#$%&\\]/g, ""))
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return "";
  return tokens.map((t) => `"${t}"`).join(" OR ");
}

function fts5Search(query: string, options: {
  kindFilter?: string[];
  connectionIdFilter?: string[];
  limit: number;
}): FtsResult[] {
  const sqlite = getSqlite();
  const ftsQuery = buildFtsQuery(query);
  if (!ftsQuery) return [];

  const conditions: string[] = [];
  const params: any[] = [ftsQuery];

  if (options.kindFilter?.length) {
    conditions.push(`e.kind IN (${options.kindFilter.map(() => "?").join(",")})`);
    params.push(...options.kindFilter);
  }
  if (options.connectionIdFilter?.length) {
    conditions.push(`e.connection_id IN (${options.connectionIdFilter.map(() => "?").join(",")})`);
    params.push(...options.connectionIdFilter);
  }

  const whereExtra = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
  params.push(options.limit);

  // bm25() returns negative values (lower = better); negate for positive scores
  // Column weights: title=10.0, body=1.0, summary=5.0
  return sqlite.prepare(`
    SELECT
      e.id, e.title, e.url, e.body, e.summary, e.kind,
      e.occurred_at as occurredAt,
      e.connection_id as connectionId,
      e.metadata,
      -bm25(entities_fts, 10.0, 1.0, 5.0) as bm25Score
    FROM entities_fts fts
    JOIN entities e ON e.rowid = fts.rowid
    WHERE entities_fts MATCH ?
    ${whereExtra}
    ORDER BY bm25Score DESC
    LIMIT ?
  `).all(...params) as FtsResult[];
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
    // FTS5 keyword scoring — single indexed query instead of per-entity LIKE scans
    const ftsResults = fts5Search(question, { kindFilter, connectionIdFilter, limit: chunkLimit });
    const ftsScoreMap = new Map<string, number>();
    if (ftsResults.length > 0) {
      const maxBm25 = Math.max(...ftsResults.map((r) => r.bm25Score));
      for (const r of ftsResults) {
        ftsScoreMap.set(r.id, maxBm25 > 0 ? r.bm25Score / maxBm25 : 0);
      }
    }

    let scored: RetrievedEntity[] = rows.map((r) => {
      const semanticSimilarity = distanceToSimilarity(r.distance);
      const kwScore = ftsScoreMap.get(r.id) || 0;
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

    // Add FTS-only results (found by keyword but not by vector search)
    const vectorEntityIds = new Set(rows.map((r: any) => r.id));
    for (const ftsResult of ftsResults) {
      if (!vectorEntityIds.has(ftsResult.id)) {
        const kwScore = ftsScoreMap.get(ftsResult.id) || 0;
        const recency = timestampDecayBoost(
          new Date(ftsResult.occurredAt),
          DEFAULT_DECAY_LAMBDA
        );
        const hybridScore = kwScore * keywordWeight + recency * recencyWeight;
        scored.push({
          id: ftsResult.id,
          title: ftsResult.title,
          url: ftsResult.url,
          body: ftsResult.body,
          summary: ftsResult.summary,
          kind: ftsResult.kind,
          occurredAt: new Date(ftsResult.occurredAt),
          connectionId: ftsResult.connectionId,
          score: hybridScore,
          semanticScore: 0,
          keywordScore: kwScore,
          metadata: ftsResult.metadata ? JSON.parse(ftsResult.metadata) : undefined,
        });
      }
    }
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
    const limit = topK * 10;
    const ftsResults = fts5Search(question, { kindFilter, connectionIdFilter, limit });

    if (ftsResults.length === 0) {
      console.log("🔍 Keyword fallback: No FTS5 results found");
      return [];
    }

    // Normalize BM25 scores to [0,1]
    const maxBm25 = Math.max(...ftsResults.map((r) => r.bm25Score));

    let scored: RetrievedEntity[] = ftsResults.map((r) => {
      const kwScore = maxBm25 > 0 ? r.bm25Score / maxBm25 : 0;
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

    console.log(`🔍 Keyword fallback: Returning ${scored.length} entities from ${ftsResults.length} FTS5 results`);
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
