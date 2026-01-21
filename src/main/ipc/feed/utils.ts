import { eq, inArray, and, SQL } from "drizzle-orm";
import { feedItems } from "../../db/schema";
import { DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT } from "./constants";
import type { FeedQueryParams, FeedQueryOptions } from "./types";

export function parseLimit(limit?: number): number {
  if (limit === undefined || limit === null) {
    return DEFAULT_LIMIT;
  }

  if (isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
}

export function parseQueryParams(options: FeedQueryOptions): FeedQueryParams {
  return {
    connectionIds: options.connectionIds || [],
    eventTypes: options.eventTypes || [],
    itemTypes: options.itemTypes || [],
    entityId: options.entityId,
    limit: parseLimit(options.limit),
  };
}

export function buildFilterClause<T extends string>(
  column: any,
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

  const connectionClause = buildFilterClause(
    feedItems.connectionId,
    params.connectionIds
  );
  if (connectionClause) {
    whereClauses.push(connectionClause);
  }

  const eventTypeClause = buildFilterClause(
    feedItems.eventType,
    params.eventTypes
  );
  if (eventTypeClause) {
    whereClauses.push(eventTypeClause);
  }

  const itemTypeClause = buildFilterClause(
    feedItems.itemType,
    params.itemTypes
  );
  if (itemTypeClause) {
    whereClauses.push(itemTypeClause);
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
