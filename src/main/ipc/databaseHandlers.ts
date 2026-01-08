import { ipcMain } from "electron";
import { getDb } from "../db/client";
import { feedItems, chatSessions, connections } from "../db/schema";
import { desc, sql } from "drizzle-orm";

/**
 * Register all IPC handlers for database operations
 */
export function registerDatabaseHandlers() {
  // Get recent feed items
  ipcMain.handle("db:getFeedItems", async (_, limit = 50) => {
    try {
      const db = getDb();
      const items = await db
        .select()
        .from(feedItems)
        .orderBy(desc(feedItems.date))
        .limit(limit);
      return { success: true, data: items };
    } catch (error) {
      console.error("Error fetching feed items:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get feed item by ID
  ipcMain.handle("db:getFeedItemById", async (_, id: number) => {
    try {
      const db = getDb();
      const items = await db
        .select()
        .from(feedItems)
        .where(sql`${feedItems.id} = ${id}`)
        .limit(1);
      return { success: true, data: items[0] || null };
    } catch (error) {
      console.error("Error fetching feed item:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get chat sessions
  ipcMain.handle("db:getChatSessions", async (_, limit = 20) => {
    try {
      const db = getDb();
      const sessions = await db
        .select()
        .from(chatSessions)
        .orderBy(desc(chatSessions.updatedAt))
        .limit(limit);
      return { success: true, data: sessions };
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get connections
  ipcMain.handle("db:getConnections", async () => {
    try {
      const db = getDb();
      const items = await db
        .select()
        .from(connections)
        .orderBy(desc(connections.connectedAt));
      return { success: true, data: items };
    } catch (error) {
      console.error("Error fetching connections:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get database statistics
  ipcMain.handle("db:getStats", async () => {
    try {
      const db = getDb();
      
      // Count feed items
      const feedItemsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(feedItems);
      
      // Count chat sessions
      const chatSessionsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatSessions);
      
      // Count connections
      const connectionsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(connections);

      return {
        success: true,
        data: {
          feedItems: Number(feedItemsCount[0]?.count || 0),
          chatSessions: Number(chatSessionsCount[0]?.count || 0),
          connections: Number(connectionsCount[0]?.count || 0),
        },
      };
    } catch (error) {
      console.error("Error fetching database stats:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  console.log("Database IPC handlers registered");
}

/**
 * Unregister all database handlers
 */
export function unregisterDatabaseHandlers() {
  ipcMain.removeHandler("db:getFeedItems");
  ipcMain.removeHandler("db:getFeedItemById");
  ipcMain.removeHandler("db:getChatSessions");
  ipcMain.removeHandler("db:getConnections");
  ipcMain.removeHandler("db:getStats");
  console.log("Database IPC handlers unregistered");
}
