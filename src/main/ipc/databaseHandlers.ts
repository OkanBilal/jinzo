import { ipcMain } from "electron";
import { getDb } from "../db/client";
import {
  feedItems,
  chatSessions,
  connections,
  entities,
  tasks,
  issues,
  playlistItems,
} from "../db/schema";
import { desc, sql, eq, and } from "drizzle-orm";

/**
 * Register all IPC handlers for database operations
 */
export function registerDatabaseHandlers() {
  // ==================== ENTITIES ====================

  // Get entities with optional filtering
  ipcMain.handle(
    "db:getEntities",
    async (
      _,
      options: { kind?: string; connectionId?: string; limit?: number } = {}
    ) => {
      try {
        const db = getDb();
        const { kind, connectionId, limit = 50 } = options;

        let query = db.select().from(entities);

        if (kind && connectionId) {
          query = query.where(
            and(eq(entities.kind, kind), eq(entities.connectionId, connectionId))
          ) as typeof query;
        } else if (kind) {
          query = query.where(eq(entities.kind, kind)) as typeof query;
        } else if (connectionId) {
          query = query.where(
            eq(entities.connectionId, connectionId)
          ) as typeof query;
        }

        const items = await query
          .orderBy(desc(entities.updatedAt))
          .limit(limit);

        return { success: true, data: items };
      } catch (error) {
        console.error("Error fetching entities:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Get entity by ID
  ipcMain.handle("db:getEntityById", async (_, id: string) => {
    try {
      const db = getDb();
      const items = await db
        .select()
        .from(entities)
        .where(eq(entities.id, id))
        .limit(1);
      return { success: true, data: items[0] || null };
    } catch (error) {
      console.error("Error fetching entity:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // ==================== TASKS ====================

  // Get tasks with optional status filter
  ipcMain.handle(
    "db:getTasks",
    async (
      _,
      options: { status?: "todo" | "doing" | "done" | "canceled"; limit?: number } = {}
    ) => {
      try {
        const db = getDb();
        const { status, limit = 50 } = options;

        let query = db
          .select({
            task: tasks,
            entity: entities,
          })
          .from(tasks)
          .innerJoin(entities, eq(tasks.entityId, entities.id));

        if (status) {
          query = query.where(eq(tasks.status, status)) as typeof query;
        }

        const items = await query
          .orderBy(desc(tasks.priority), tasks.dueAt)
          .limit(limit);

        return { success: true, data: items };
      } catch (error) {
        console.error("Error fetching tasks:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // ==================== ISSUES ====================

  // Get issues with optional filtering
  ipcMain.handle(
    "db:getIssues",
    async (
      _,
      options: { provider?: string; state?: string; limit?: number } = {}
    ) => {
      try {
        const db = getDb();
        const { provider, state, limit = 50 } = options;

        let query = db
          .select({
            issue: issues,
            entity: entities,
          })
          .from(issues)
          .innerJoin(entities, eq(issues.entityId, entities.id));

        if (provider && state) {
          query = query.where(
            and(eq(issues.provider, provider), eq(issues.state, state))
          ) as typeof query;
        } else if (provider) {
          query = query.where(eq(issues.provider, provider)) as typeof query;
        } else if (state) {
          query = query.where(eq(issues.state, state)) as typeof query;
        }

        const items = await query
          .orderBy(desc(issues.priority))
          .limit(limit);

        return { success: true, data: items };
      } catch (error) {
        console.error("Error fetching issues:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // ==================== PLAYLIST ITEMS ====================

  // Get playlist items for a specific playlist
  ipcMain.handle("db:getPlaylistItems", async (_, playlistEntityId: string) => {
    try {
      const db = getDb();
      const items = await db
        .select({
          playlistItem: playlistItems,
          entity: entities,
        })
        .from(playlistItems)
        .innerJoin(entities, eq(playlistItems.itemEntityId, entities.id))
        .where(eq(playlistItems.playlistEntityId, playlistEntityId))
        .orderBy(playlistItems.position);

      return { success: true, data: items };
    } catch (error) {
      console.error("Error fetching playlist items:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // ==================== FEED EVENTS ====================

  // Get recent feed events (event log)
  ipcMain.handle(
    "db:getFeedEvents",
    async (
      _,
      options: { eventType?: string; itemType?: string; limit?: number } = {}
    ) => {
      try {
        const db = getDb();
        const { eventType, itemType, limit = 50 } = options;

        let query = db.select().from(feedItems);

        if (eventType && itemType) {
          query = query.where(
            and(
              eq(feedItems.eventType, eventType),
              eq(feedItems.itemType, itemType)
            )
          ) as typeof query;
        } else if (eventType) {
          query = query.where(eq(feedItems.eventType, eventType)) as typeof query;
        } else if (itemType) {
          query = query.where(eq(feedItems.itemType, itemType)) as typeof query;
        }

        const items = await query
          .orderBy(desc(feedItems.occurredAt))
          .limit(limit);

        return { success: true, data: items };
      } catch (error) {
        console.error("Error fetching feed events:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Get feed event by ID
  ipcMain.handle("db:getFeedEventById", async (_, id: number) => {
    try {
      const db = getDb();
      const items = await db
        .select()
        .from(feedItems)
        .where(eq(feedItems.id, id))
        .limit(1);
      return { success: true, data: items[0] || null };
    } catch (error) {
      console.error("Error fetching feed event:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // ==================== CHAT SESSIONS ====================

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

  // ==================== CONNECTIONS ====================

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

  // ==================== STATISTICS ====================

  // Get database statistics
  ipcMain.handle("db:getStats", async () => {
    try {
      const db = getDb();

      // Count entities
      const entitiesCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(entities);

      // Count tasks
      const tasksCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks);

      // Count issues
      const issuesCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(issues);

      // Count feed events
      const feedEventsCount = await db
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
          entities: Number(entitiesCount[0]?.count || 0),
          tasks: Number(tasksCount[0]?.count || 0),
          issues: Number(issuesCount[0]?.count || 0),
          feedEvents: Number(feedEventsCount[0]?.count || 0),
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
  // Entities
  ipcMain.removeHandler("db:getEntities");
  ipcMain.removeHandler("db:getEntityById");
  // Tasks
  ipcMain.removeHandler("db:getTasks");
  // Issues
  ipcMain.removeHandler("db:getIssues");
  // Playlist Items
  ipcMain.removeHandler("db:getPlaylistItems");
  // Feed Events
  ipcMain.removeHandler("db:getFeedEvents");
  ipcMain.removeHandler("db:getFeedEventById");
  // Chat & Connections
  ipcMain.removeHandler("db:getChatSessions");
  ipcMain.removeHandler("db:getConnections");
  // Stats
  ipcMain.removeHandler("db:getStats");
  console.log("Database IPC handlers unregistered");
}
