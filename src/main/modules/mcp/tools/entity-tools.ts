import { getDb } from "../../../db/client";
import { entities } from "../../../db/schema";
import { and, desc, gte, lte, or, like, inArray, sql } from "drizzle-orm";
import type {
  EntityListParams,
  EntitySearchParams,
  EntityListResult,
  EntitySearchResult,
  EntityResult,
  OllamaToolDefinition,
} from "../mcp.dto";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function toEntityResult(row: typeof entities.$inferSelect): EntityResult {
  return {
    id: row.id,
    title: row.title ?? "",
    url: row.url ?? "",
    body: row.body,
    summary: row.summary,
    kind: row.kind,
    occurredAt: row.occurredAt instanceof Date ? row.occurredAt.toISOString() : String(row.occurredAt),
    connectionId: row.connectionId,
    metadata: row.metadata,
  };
}

// ─────────────────────────────────────────────────────────────
// Entity Tools
// ─────────────────────────────────────────────────────────────
export async function entityList(
  params: EntityListParams
): Promise<EntityListResult> {
  const db = getDb();
  const limit = params.limit || 10;
  const offset = params.offset || 0;

  const conditions = [];

  if (params.kinds && params.kinds.length > 0) {
    conditions.push(inArray(entities.kind, params.kinds));
  }

  if (params.connectionIds && params.connectionIds.length > 0) {
    conditions.push(inArray(entities.connectionId, params.connectionIds));
  }

  if (params.startDate) {
    conditions.push(gte(entities.occurredAt, new Date(params.startDate)));
  }
  if (params.endDate) {
    conditions.push(lte(entities.occurredAt, new Date(params.endDate)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(entities)
    .where(whereClause)
    .orderBy(desc(entities.occurredAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(entities)
    .where(whereClause);

  const total = totalResult[0]?.count || 0;

  return {
    entities: items.map(toEntityResult),
    total,
    limit,
    offset,
  };
}

export async function entitySearch(
  params: EntitySearchParams
): Promise<EntitySearchResult> {
  const db = getDb();
  const limit = params.limit || 10;
  const conditions = [];

  const searchPattern = `%${params.query}%`;
  conditions.push(
    or(
      like(entities.title, searchPattern),
      like(entities.body, searchPattern),
      like(entities.summary, searchPattern),
      like(entities.url, searchPattern)
    )!
  );

  if (params.kinds && params.kinds.length > 0) {
    conditions.push(inArray(entities.kind, params.kinds));
  }

  if (params.connectionIds && params.connectionIds.length > 0) {
    conditions.push(inArray(entities.connectionId, params.connectionIds));
  }

  if (params.startDate) {
    conditions.push(gte(entities.occurredAt, new Date(params.startDate)));
  }
  if (params.endDate) {
    conditions.push(lte(entities.occurredAt, new Date(params.endDate)));
  }

  const whereClause = and(...conditions);

  const items = await db
    .select()
    .from(entities)
    .where(whereClause)
    .orderBy(desc(entities.occurredAt))
    .limit(limit);

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(entities)
    .where(whereClause);

  const total = totalResult[0]?.count || 0;

  return {
    entities: items.map(toEntityResult),
    total,
    query: params.query,
  };
}

// ─────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────
export const ENTITY_TOOLS: OllamaToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "entity_list",
      description:
        "View and browse existing entities already stored in the database with optional filtering by kind, connection, and date range. Returns paginated results sorted by date (newest first). NOTE: This does NOT fetch new items from external sources - use trigger_entity_sync to refresh/update with new items.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of entities to return (default: 10)",
          },
          offset: {
            type: "number",
            description: "Number of entities to skip for pagination (default: 0)",
          },
          kinds: {
            type: "array",
            items: { type: "string" },
            description:
              "Filter by entity kinds (e.g., ['issue', 'bookmark', 'podcast_episode', 'hn_story'])",
          },
          connectionIds: {
            type: "array",
            items: { type: "string" },
            description: "Filter by connection IDs",
          },
          startDate: {
            type: "string",
            description: "Filter entities from this date onwards (ISO 8601 format)",
          },
          endDate: {
            type: "string",
            description: "Filter entities up to this date (ISO 8601 format)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "entity_search",
      description:
        "Search existing entities already in the database by keyword. Searches in title, body, summary, and URL. Can be filtered by kind, connection, and date range. NOTE: This searches only stored entities - use trigger_entity_sync first if you need the latest data.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to match against title, body, summary, or URL",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 10)",
          },
          kinds: {
            type: "array",
            items: { type: "string" },
            description:
              "Filter by entity kinds (e.g., ['issue', 'bookmark', 'podcast_episode'])",
          },
          connectionIds: {
            type: "array",
            items: { type: "string" },
            description: "Filter by connection IDs",
          },
          startDate: {
            type: "string",
            description: "Filter entities from this date onwards (ISO 8601 format)",
          },
          endDate: {
            type: "string",
            description: "Filter entities up to this date (ISO 8601 format)",
          },
        },
        required: ["query"],
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Tool Executor
// ─────────────────────────────────────────────────────────────
export async function executeEntityTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<EntityListResult | EntitySearchResult> {
  switch (toolName) {
    case "entity_list":
    case "feed_list":
      return entityList(params as unknown as EntityListParams);
    case "entity_search":
    case "feed_search":
      return entitySearch(params as unknown as EntitySearchParams);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
