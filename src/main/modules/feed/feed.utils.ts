import { eq, inArray, and, SQL } from "drizzle-orm";
import { feedItems } from "../../db/schema";
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT } from "./feed.constants";
import type { FeedQueryParams, FeedQueryOptions } from "./feed.dto";

// ─────────────────────────────────────────────────────────────
// Limit Parsing
// ─────────────────────────────────────────────────────────────
export function parseLimit(limit?: number): number {
  if (limit === undefined || limit === null) {
    return DEFAULT_LIMIT;
  }

  if (isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
}

// ─────────────────────────────────────────────────────────────
// Query Params Parsing
// ─────────────────────────────────────────────────────────────
export function parseQueryParams(options: FeedQueryOptions): FeedQueryParams {
  return {
    connectionIds: options.connectionIds || [],
    eventTypes: options.eventTypes || [],
    itemTypes: options.itemTypes || [],
    entityId: options.entityId,
    limit: parseLimit(options.limit),
  };
}

// ─────────────────────────────────────────────────────────────
// Filter Clause Building
// ─────────────────────────────────────────────────────────────
export function buildFilterClause<T extends string>(
  column: ReturnType<typeof feedItems.connectionId.getSQL> extends SQL ? typeof feedItems.connectionId : never,
  values: T[]
): SQL | undefined {
  if (values.length === 0) {
    return undefined;
  }

  if (values.length === 1) {
    return eq(column, values[0]!);
  }

  return inArray(column, values);
}

export function buildWhereClause(params: FeedQueryParams): SQL | undefined {
  const whereClauses: SQL[] = [];

  if (params.connectionIds.length > 0) {
    if (params.connectionIds.length === 1) {
      whereClauses.push(eq(feedItems.connectionId, params.connectionIds[0]!));
    } else {
      whereClauses.push(inArray(feedItems.connectionId, params.connectionIds));
    }
  }

  if (params.eventTypes.length > 0) {
    if (params.eventTypes.length === 1) {
      whereClauses.push(eq(feedItems.eventType, params.eventTypes[0]!));
    } else {
      whereClauses.push(inArray(feedItems.eventType, params.eventTypes));
    }
  }

  if (params.itemTypes.length > 0) {
    if (params.itemTypes.length === 1) {
      whereClauses.push(eq(feedItems.itemType, params.itemTypes[0]!));
    } else {
      whereClauses.push(inArray(feedItems.itemType, params.itemTypes));
    }
  }

  if (params.entityId) {
    whereClauses.push(eq(feedItems.entityId, params.entityId));
  }

  if (whereClauses.length === 0) {
    return undefined;
  }

  if (whereClauses.length === 1) {
    return whereClauses[0];
  }

  return and(...whereClauses);
}
