import { getDb } from "../../../../main/db/client";
import { feedItems } from "../../../../main/db/schema";
import { and, desc, gte, lte, or, like, inArray, sql } from "drizzle-orm";
import type {
  FeedListParams,
  FeedSearchParams,
  FeedListResult,
  FeedSearchResult,
  FeedItemResult,
  OllamaToolDefinition,
} from "../types";

function toFeedItemResult(row: any): FeedItemResult {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    description: row.description,
    itemType: row.itemType,
    date: row.date.toISOString(),
    source: row.source,
    imageUrl: row.imageUrl,
    metadata: row.metadata,
  };
}

export async function feedList(
  params: FeedListParams
): Promise<FeedListResult> {
  const db = getDb();
  const limit = params.limit || 10;
  const offset = params.offset || 0;

  const conditions = [];

  if (params.sources && params.sources.length > 0) {
    conditions.push(inArray(feedItems.source, params.sources));
  }

  if (params.itemTypes && params.itemTypes.length > 0) {
    conditions.push(inArray(feedItems.itemType, params.itemTypes));
  }

  if (params.startDate) {
    conditions.push(gte(feedItems.date, new Date(params.startDate)));
  }
  if (params.endDate) {
    conditions.push(lte(feedItems.date, new Date(params.endDate)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(feedItems)
    .where(whereClause)
    .orderBy(desc(feedItems.date))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(feedItems)
    .where(whereClause);

  const total = totalResult[0]?.count || 0;

  return {
    items: items.map(toFeedItemResult),
    total,
    limit,
    offset,
  };
}

export async function feedSearch(
  params: FeedSearchParams
): Promise<FeedSearchResult> {
  const db = getDb();
  const limit = params.limit || 10;
  const conditions = [];

  const searchPattern = `%${params.query}%`;
  conditions.push(
    or(
      like(feedItems.title, searchPattern),
      like(feedItems.description, searchPattern),
      like(feedItems.url, searchPattern)
    )!
  );

  if (params.sources && params.sources.length > 0) {
    conditions.push(inArray(feedItems.source, params.sources));
  }

  if (params.itemTypes && params.itemTypes.length > 0) {
    conditions.push(inArray(feedItems.itemType, params.itemTypes));
  }

  if (params.startDate) {
    conditions.push(gte(feedItems.date, new Date(params.startDate)));
  }
  if (params.endDate) {
    conditions.push(lte(feedItems.date, new Date(params.endDate)));
  }

  const whereClause = and(...conditions);

  const items = await db
    .select()
    .from(feedItems)
    .where(whereClause)
    .orderBy(desc(feedItems.date))
    .limit(limit);

  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(feedItems)
    .where(whereClause);

  const total = totalResult[0]?.count || 0;

  return {
    items: items.map(toFeedItemResult),
    total,
    query: params.query,
  };
}

export const FEED_TOOLS: OllamaToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "feed_list",
      description:
        "List feed items with optional filtering by source, item type, and date range. Returns paginated results sorted by date (newest first).",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of items to return (default: 10)",
          },
          offset: {
            type: "number",
            description: "Number of items to skip for pagination (default: 0)",
          },
          sources: {
            type: "array",
            items: { type: "string" },
            description:
              "Filter by sources (e.g., ['github', 'hackernews', 'raindrop'])",
          },
          itemTypes: {
            type: "array",
            items: { type: "string" },
            description:
              "Filter by item types (e.g., ['repository', 'article', 'bookmark'])",
          },
          startDate: {
            type: "string",
            description:
              "Filter items from this date onwards (ISO 8601 format)",
          },
          endDate: {
            type: "string",
            description: "Filter items up to this date (ISO 8601 format)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "feed_search",
      description:
        "Search feed items by keyword. Searches in title, description, and URL. Can be filtered by source, item type, and date range.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search query to match against title, description, or URL",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 10)",
          },
          sources: {
            type: "array",
            items: { type: "string" },
            description:
              "Filter by sources (e.g., ['github', 'hackernews', 'raindrop'])",
          },
          itemTypes: {
            type: "array",
            items: { type: "string" },
            description:
              "Filter by item types (e.g., ['repository', 'article', 'bookmark'])",
          },
          startDate: {
            type: "string",
            description:
              "Filter items from this date onwards (ISO 8601 format)",
          },
          endDate: {
            type: "string",
            description: "Filter items up to this date (ISO 8601 format)",
          },
        },
        required: ["query"],
      },
    },
  },
];

export async function executeFeedTool(
  toolName: string,
  params: any
): Promise<any> {
  switch (toolName) {
    case "feed_list":
      return feedList(params as FeedListParams);
    case "feed_search":
      return feedSearch(params as FeedSearchParams);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
