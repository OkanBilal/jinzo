import { ipcMain } from "electron";
import { desc, eq, inArray, and, SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import { feedItems } from "../db/schema";
import { ParsedQueryParams } from "../../renderer/lib/cron/types";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MIN_LIMIT = 1;

function parseLimit(limit?: number): number {
  if (limit === undefined || limit === null) {
    return DEFAULT_LIMIT;
  }

  if (isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
}

function parseQueryParams(options: {
  sources?: string[];
  itemTypes?: string[];
  limit?: number;
}): ParsedQueryParams {
  return {
    sources: options.sources || [],
    itemTypes: options.itemTypes || [],
    limit: parseLimit(options.limit),
  };
}

function buildFilterClause<T extends string>(
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

function buildWhereClause(params: ParsedQueryParams): SQL | undefined {
  const whereClauses: SQL[] = [];

  const sourceClause = buildFilterClause(feedItems.source, params.sources);
  if (sourceClause) {
    whereClauses.push(sourceClause);
  }

  const itemTypeClause = buildFilterClause(feedItems.itemType, params.itemTypes);
  if (itemTypeClause) {
    whereClauses.push(itemTypeClause);
  }

  if (whereClauses.length === 0) {
    return undefined;
  }
  
  if (whereClauses.length === 1) {
    return whereClauses[0];
  }
  
  return and(...whereClauses);
}

/**
 * Register all IPC handlers for feed operations
 */
export function registerFeedHandlers() {
  // Get feed items with optional filters and pagination
  ipcMain.handle("feed:getItems", async (_, options?: {
    sources?: string[];
    itemTypes?: string[];
    limit?: number;
  }) => {
    try {
      const db = getDb();
      const params = parseQueryParams(options || {});
      const whereClause = buildWhereClause(params);

      const items = await db.query.feedItems.findMany({
        where: whereClause,
        orderBy: [desc(feedItems.date)],
        limit: params.limit,
      });

      return { success: true, data: items };
    } catch (error) {
      console.error("Failed to fetch feed items:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch feed items";
      return { success: false, error: errorMessage };
    }
  });
}
