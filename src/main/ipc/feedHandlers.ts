import { ipcMain } from "electron";
import { desc, eq, inArray, and, SQL } from "drizzle-orm";
import { getDb } from "../db/client";
import { feedItems } from "../db/schema";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const MIN_LIMIT = 1;

interface FeedQueryParams {
  connectionIds: string[];
  eventTypes: string[];
  itemTypes: string[];
  entityId?: string;
  limit: number;
}

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
  connectionIds?: string[];
  eventTypes?: string[];
  itemTypes?: string[];
  entityId?: string;
  limit?: number;
}): FeedQueryParams {
  return {
    connectionIds: options.connectionIds || [],
    eventTypes: options.eventTypes || [],
    itemTypes: options.itemTypes || [],
    entityId: options.entityId,
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

function buildWhereClause(params: FeedQueryParams): SQL | undefined {
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

/**
 * Register all IPC handlers for feed event operations
 */
export function registerFeedHandlers() {
  // Get feed events with optional filters and pagination
  ipcMain.handle(
    "feed:getEvents",
    async (
      _,
      options?: {
        connectionIds?: string[];
        eventTypes?: string[];
        itemTypes?: string[];
        entityId?: string;
        limit?: number;
      }
    ) => {
      try {
        const db = getDb();
        const params = parseQueryParams(options || {});
        const whereClause = buildWhereClause(params);

        const items = await db.query.feedItems.findMany({
          where: whereClause,
          orderBy: [desc(feedItems.occurredAt)],
          limit: params.limit,
        });

        return { success: true, data: items };
      } catch (error) {
        console.error("Failed to fetch feed events:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to fetch feed events";
        return { success: false, error: errorMessage };
      }
    }
  );

  // Get feed event by ID
  ipcMain.handle("feed:getEventById", async (_, id: number) => {
    try {
      const db = getDb();
      const items = await db.query.feedItems.findMany({
        where: eq(feedItems.id, id),
        limit: 1,
      });
      return { success: true, data: items[0] || null };
    } catch (error) {
      console.error("Failed to fetch feed event:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch feed event";
      return { success: false, error: errorMessage };
    }
  });

  // Get events for a specific entity
  ipcMain.handle("feed:getEventsByEntity", async (_, entityId: string) => {
    try {
      const db = getDb();
      const items = await db.query.feedItems.findMany({
        where: eq(feedItems.entityId, entityId),
        orderBy: [desc(feedItems.occurredAt)],
      });
      return { success: true, data: items };
    } catch (error) {
      console.error("Failed to fetch entity events:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch entity events";
      return { success: false, error: errorMessage };
    }
  });

  console.log("Feed IPC handlers registered");
}

/**
 * Unregister all feed handlers
 */
export function unregisterFeedHandlers() {
  ipcMain.removeHandler("feed:getEvents");
  ipcMain.removeHandler("feed:getEventById");
  ipcMain.removeHandler("feed:getEventsByEntity");
  console.log("Feed IPC handlers unregistered");
}
