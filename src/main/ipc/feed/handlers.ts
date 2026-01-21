import { ipcMain } from "electron";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { feedItems } from "../../db/schema";
import { parseQueryParams, buildWhereClause } from "./utils";
import type { FeedQueryOptions } from "./types";

/**
 * Register all IPC handlers for feed event operations
 */
export function registerFeedHandlers() {
  // Get feed events with optional filters and pagination
  ipcMain.handle("feed:getEvents", async (_, options?: FeedQueryOptions) => {
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
  });

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

  console.log("Feed handlers registered");
}

/**
 * Unregister all feed handlers
 */
export function unregisterFeedHandlers() {
  ipcMain.removeHandler("feed:getEvents");
  ipcMain.removeHandler("feed:getEventById");
  ipcMain.removeHandler("feed:getEventsByEntity");
}
