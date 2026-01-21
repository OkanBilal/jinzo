import { ipcMain } from "electron";
import { desc, eq, and, like, or, sql, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  entities,
  tasks,
  issues,
  playlistItems,
} from "../db/schema";
import { v4 as uuidv4 } from "uuid";

// ==================== TYPES ====================

interface CreateEntityPayload {
  accountId: string;
  kind: string;
  connectionId?: string;
  resourceId?: string;
  externalId?: string;
  url?: string;
  title?: string;
  body?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

interface UpdateEntityPayload {
  title?: string;
  body?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  url?: string;
  isDeleted?: boolean;
}

interface CreateTaskPayload {
  entity: CreateEntityPayload;
  status?: "todo" | "doing" | "done" | "canceled";
  dueAt?: Date;
  priority?: number;
  labels?: string[];
}

interface UpdateTaskPayload {
  status?: "todo" | "doing" | "done" | "canceled";
  dueAt?: Date | null;
  priority?: number;
  labels?: string[];
}

interface CreateIssuePayload {
  entity: CreateEntityPayload;
  provider: string;
  state: string;
  number?: number;
  repo?: string;
  assignee?: string;
  labels?: string[];
  priority?: number;
}

interface UpdateIssuePayload {
  state?: string;
  assignee?: string;
  labels?: string[];
  priority?: number;
  closedAt?: Date | null;
}

// ==================== HELPER FUNCTIONS ====================

function serializeLabels(labels?: string[]): string | null {
  if (!labels || labels.length === 0) return null;
  return JSON.stringify(labels);
}

function serializeMetadata(
  metadata?: Record<string, unknown>
): string | null {
  if (!metadata) return null;
  return JSON.stringify(metadata);
}

// ==================== REGISTER HANDLERS ====================

export function registerEntitiesHandlers() {
  // ==================== ENTITIES ====================

  // Get all entities with optional filtering
  ipcMain.handle(
    "entities:getAll",
    async (
      _,
      options: { kinds?: string[]; kind?: string; connectionIds?: string[]; connectionId?: string; limit?: number } = {}
    ) => {
      try {
        const db = getDb();
        const { kinds, kind, connectionIds, connectionId, limit = 50 } = options;

        const conditions = [];
        // Support both 'kinds' array and legacy 'kind' string
        if (kinds && kinds.length > 0) {
          conditions.push(inArray(entities.kind, kinds));
        } else if (kind) {
          conditions.push(eq(entities.kind, kind));
        }
        // Support both 'connectionIds' array and legacy 'connectionId' string
        if (connectionIds && connectionIds.length > 0) {
          conditions.push(inArray(entities.connectionId, connectionIds));
        } else if (connectionId) {
          conditions.push(eq(entities.connectionId, connectionId));
        }
        conditions.push(eq(entities.isDeleted, false));

        const whereClause =
          conditions.length > 1 ? and(...conditions) : conditions[0];

        const items = await db
          .select()
          .from(entities)
          .where(whereClause)
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
  ipcMain.handle("entities:getById", async (_, id: string) => {
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

  // Create entity
  ipcMain.handle(
    "entities:create",
    async (_, payload: CreateEntityPayload) => {
      try {
        const db = getDb();
        const id = uuidv4();

        await db.insert(entities).values({
          id,
          accountId: payload.accountId,
          kind: payload.kind,
          connectionId: payload.connectionId,
          resourceId: payload.resourceId,
          externalId: payload.externalId,
          url: payload.url,
          title: payload.title,
          body: payload.body,
          summary: payload.summary,
          metadata: serializeMetadata(payload.metadata),
          occurredAt: payload.occurredAt,
        });

        const created = await db
          .select()
          .from(entities)
          .where(eq(entities.id, id))
          .limit(1);

        return { success: true, data: created[0] };
      } catch (error) {
        console.error("Error creating entity:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Update entity
  ipcMain.handle(
    "entities:update",
    async (_, id: string, payload: UpdateEntityPayload) => {
      try {
        const db = getDb();

        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (payload.title !== undefined) updateData.title = payload.title;
        if (payload.body !== undefined) updateData.body = payload.body;
        if (payload.summary !== undefined) updateData.summary = payload.summary;
        if (payload.url !== undefined) updateData.url = payload.url;
        if (payload.isDeleted !== undefined)
          updateData.isDeleted = payload.isDeleted;
        if (payload.metadata !== undefined)
          updateData.metadata = serializeMetadata(payload.metadata);

        await db
          .update(entities)
          .set(updateData)
          .where(eq(entities.id, id));

        const updated = await db
          .select()
          .from(entities)
          .where(eq(entities.id, id))
          .limit(1);

        return { success: true, data: updated[0] };
      } catch (error) {
        console.error("Error updating entity:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Soft delete entity
  ipcMain.handle("entities:delete", async (_, id: string) => {
    try {
      const db = getDb();

      await db
        .update(entities)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(eq(entities.id, id));

      return { success: true };
    } catch (error) {
      console.error("Error deleting entity:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Search entities
  ipcMain.handle(
    "entities:search",
    async (
      _,
      query: string,
      options: { kind?: string; limit?: number } = {}
    ) => {
      try {
        const db = getDb();
        const { kind, limit = 20 } = options;
        const searchPattern = `%${query}%`;

        const conditions = [
          eq(entities.isDeleted, false),
          or(
            like(entities.title, searchPattern),
            like(entities.body, searchPattern),
            like(entities.summary, searchPattern)
          ),
        ];

        if (kind) {
          conditions.push(eq(entities.kind, kind));
        }

        const items = await db
          .select()
          .from(entities)
          .where(and(...conditions))
          .orderBy(desc(entities.updatedAt))
          .limit(limit);

        return { success: true, data: items };
      } catch (error) {
        console.error("Error searching entities:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // ==================== TASKS ====================

  // Get all tasks with optional status filter
  ipcMain.handle(
    "tasks:getAll",
    async (
      _,
      options: {
        status?: "todo" | "doing" | "done" | "canceled";
        limit?: number;
      } = {}
    ) => {
      try {
        const db = getDb();
        const { status, limit = 50 } = options;

        const conditions = [eq(entities.isDeleted, false)];
        if (status) {
          conditions.push(eq(tasks.status, status));
        }

        const items = await db
          .select({
            task: tasks,
            entity: entities,
          })
          .from(tasks)
          .innerJoin(entities, eq(tasks.entityId, entities.id))
          .where(and(...conditions))
          .orderBy(desc(tasks.priority), tasks.dueAt)
          .limit(limit);

        return { success: true, data: items };
      } catch (error) {
        console.error("Error fetching tasks:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Get task by entity ID
  ipcMain.handle("tasks:getById", async (_, entityId: string) => {
    try {
      const db = getDb();
      const items = await db
        .select({
          task: tasks,
          entity: entities,
        })
        .from(tasks)
        .innerJoin(entities, eq(tasks.entityId, entities.id))
        .where(eq(tasks.entityId, entityId))
        .limit(1);

      return { success: true, data: items[0] || null };
    } catch (error) {
      console.error("Error fetching task:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Create task (creates entity + task record)
  ipcMain.handle("tasks:create", async (_, payload: CreateTaskPayload) => {
    try {
      const db = getDb();
      const entityId = uuidv4();

      // Create entity first
      await db.insert(entities).values({
        id: entityId,
        accountId: payload.entity.accountId,
        kind: "task",
        connectionId: payload.entity.connectionId,
        resourceId: payload.entity.resourceId,
        externalId: payload.entity.externalId,
        url: payload.entity.url,
        title: payload.entity.title,
        body: payload.entity.body,
        summary: payload.entity.summary,
        metadata: serializeMetadata(payload.entity.metadata),
        occurredAt: payload.entity.occurredAt,
      });

      // Create task record
      await db.insert(tasks).values({
        entityId,
        status: payload.status || "todo",
        dueAt: payload.dueAt,
        priority: payload.priority || 0,
        labels: serializeLabels(payload.labels),
      });

      // Return the created task with entity
      const created = await db
        .select({
          task: tasks,
          entity: entities,
        })
        .from(tasks)
        .innerJoin(entities, eq(tasks.entityId, entities.id))
        .where(eq(tasks.entityId, entityId))
        .limit(1);

      return { success: true, data: created[0] };
    } catch (error) {
      console.error("Error creating task:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Update task
  ipcMain.handle(
    "tasks:update",
    async (_, entityId: string, payload: UpdateTaskPayload) => {
      try {
        const db = getDb();

        const updateData: Record<string, unknown> = {};

        if (payload.status !== undefined) updateData.status = payload.status;
        if (payload.dueAt !== undefined) updateData.dueAt = payload.dueAt;
        if (payload.priority !== undefined) updateData.priority = payload.priority;
        if (payload.labels !== undefined)
          updateData.labels = serializeLabels(payload.labels);

        if (Object.keys(updateData).length > 0) {
          await db
            .update(tasks)
            .set(updateData)
            .where(eq(tasks.entityId, entityId));

          // Update entity timestamp
          await db
            .update(entities)
            .set({ updatedAt: new Date() })
            .where(eq(entities.id, entityId));
        }

        const updated = await db
          .select({
            task: tasks,
            entity: entities,
          })
          .from(tasks)
          .innerJoin(entities, eq(tasks.entityId, entities.id))
          .where(eq(tasks.entityId, entityId))
          .limit(1);

        return { success: true, data: updated[0] };
      } catch (error) {
        console.error("Error updating task:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Delete task (soft delete)
  ipcMain.handle("tasks:delete", async (_, entityId: string) => {
    try {
      const db = getDb();

      await db
        .update(entities)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(eq(entities.id, entityId));

      return { success: true };
    } catch (error) {
      console.error("Error deleting task:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // ==================== ISSUES ====================

  // Get all issues with optional filtering
  ipcMain.handle(
    "issues:getAll",
    async (
      _,
      options: { provider?: string; state?: string; limit?: number } = {}
    ) => {
      try {
        const db = getDb();
        const { provider, state, limit = 50 } = options;

        const conditions = [eq(entities.isDeleted, false)];
        if (provider) conditions.push(eq(issues.provider, provider));
        if (state) conditions.push(eq(issues.state, state));

        const items = await db
          .select({
            issue: issues,
            entity: entities,
          })
          .from(issues)
          .innerJoin(entities, eq(issues.entityId, entities.id))
          .where(and(...conditions))
          .orderBy(desc(issues.priority))
          .limit(limit);

        return { success: true, data: items };
      } catch (error) {
        console.error("Error fetching issues:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Get issue by entity ID
  ipcMain.handle("issues:getById", async (_, entityId: string) => {
    try {
      const db = getDb();
      const items = await db
        .select({
          issue: issues,
          entity: entities,
        })
        .from(issues)
        .innerJoin(entities, eq(issues.entityId, entities.id))
        .where(eq(issues.entityId, entityId))
        .limit(1);

      return { success: true, data: items[0] || null };
    } catch (error) {
      console.error("Error fetching issue:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Create issue (creates entity + issue record)
  ipcMain.handle("issues:create", async (_, payload: CreateIssuePayload) => {
    try {
      const db = getDb();
      const entityId = uuidv4();

      // Create entity first
      await db.insert(entities).values({
        id: entityId,
        accountId: payload.entity.accountId,
        kind: "issue",
        connectionId: payload.entity.connectionId,
        resourceId: payload.entity.resourceId,
        externalId: payload.entity.externalId,
        url: payload.entity.url,
        title: payload.entity.title,
        body: payload.entity.body,
        summary: payload.entity.summary,
        metadata: serializeMetadata(payload.entity.metadata),
        occurredAt: payload.entity.occurredAt,
      });

      // Create issue record
      await db.insert(issues).values({
        entityId,
        provider: payload.provider,
        state: payload.state,
        number: payload.number,
        repo: payload.repo,
        assignee: payload.assignee,
        labels: serializeLabels(payload.labels),
        priority: payload.priority || 0,
      });

      // Return the created issue with entity
      const created = await db
        .select({
          issue: issues,
          entity: entities,
        })
        .from(issues)
        .innerJoin(entities, eq(issues.entityId, entities.id))
        .where(eq(issues.entityId, entityId))
        .limit(1);

      return { success: true, data: created[0] };
    } catch (error) {
      console.error("Error creating issue:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Update issue
  ipcMain.handle(
    "issues:update",
    async (_, entityId: string, payload: UpdateIssuePayload) => {
      try {
        const db = getDb();

        const updateData: Record<string, unknown> = {};

        if (payload.state !== undefined) updateData.state = payload.state;
        if (payload.assignee !== undefined) updateData.assignee = payload.assignee;
        if (payload.priority !== undefined) updateData.priority = payload.priority;
        if (payload.closedAt !== undefined) updateData.closedAt = payload.closedAt;
        if (payload.labels !== undefined)
          updateData.labels = serializeLabels(payload.labels);

        if (Object.keys(updateData).length > 0) {
          await db
            .update(issues)
            .set(updateData)
            .where(eq(issues.entityId, entityId));

          // Update entity timestamp
          await db
            .update(entities)
            .set({ updatedAt: new Date() })
            .where(eq(entities.id, entityId));
        }

        const updated = await db
          .select({
            issue: issues,
            entity: entities,
          })
          .from(issues)
          .innerJoin(entities, eq(issues.entityId, entities.id))
          .where(eq(issues.entityId, entityId))
          .limit(1);

        return { success: true, data: updated[0] };
      } catch (error) {
        console.error("Error updating issue:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Delete issue (soft delete)
  ipcMain.handle("issues:delete", async (_, entityId: string) => {
    try {
      const db = getDb();

      await db
        .update(entities)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(eq(entities.id, entityId));

      return { success: true };
    } catch (error) {
      console.error("Error deleting issue:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // ==================== PLAYLIST ITEMS ====================

  // Get playlist items for a specific playlist
  ipcMain.handle("playlists:getItems", async (_, playlistEntityId: string) => {
    try {
      const db = getDb();
      const items = await db
        .select({
          playlistItem: playlistItems,
          entity: entities,
        })
        .from(playlistItems)
        .innerJoin(entities, eq(playlistItems.itemEntityId, entities.id))
        .where(
          and(
            eq(playlistItems.playlistEntityId, playlistEntityId),
            eq(entities.isDeleted, false)
          )
        )
        .orderBy(playlistItems.position);

      return { success: true, data: items };
    } catch (error) {
      console.error("Error fetching playlist items:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Add item to playlist
  ipcMain.handle(
    "playlists:addItem",
    async (
      _,
      playlistEntityId: string,
      itemEntityId: string,
      position?: number
    ) => {
      try {
        const db = getDb();

        // Get max position if not provided
        let targetPosition = position;
        if (targetPosition === undefined) {
          const maxPos = await db
            .select({ maxPosition: sql<number>`MAX(${playlistItems.position})` })
            .from(playlistItems)
            .where(eq(playlistItems.playlistEntityId, playlistEntityId));

          targetPosition = (maxPos[0]?.maxPosition ?? -1) + 1;
        }

        await db.insert(playlistItems).values({
          playlistEntityId,
          itemEntityId,
          position: targetPosition,
        });

        return { success: true };
      } catch (error) {
        console.error("Error adding playlist item:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Remove item from playlist
  ipcMain.handle(
    "playlists:removeItem",
    async (_, playlistEntityId: string, itemEntityId: string) => {
      try {
        const db = getDb();

        await db
          .delete(playlistItems)
          .where(
            and(
              eq(playlistItems.playlistEntityId, playlistEntityId),
              eq(playlistItems.itemEntityId, itemEntityId)
            )
          );

        return { success: true };
      } catch (error) {
        console.error("Error removing playlist item:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  // Reorder playlist item
  ipcMain.handle(
    "playlists:reorderItem",
    async (
      _,
      playlistEntityId: string,
      itemEntityId: string,
      newPosition: number
    ) => {
      try {
        const db = getDb();

        await db
          .update(playlistItems)
          .set({ position: newPosition })
          .where(
            and(
              eq(playlistItems.playlistEntityId, playlistEntityId),
              eq(playlistItems.itemEntityId, itemEntityId)
            )
          );

        return { success: true };
      } catch (error) {
        console.error("Error reordering playlist item:", error);
        return { success: false, error: (error as Error).message };
      }
    }
  );

  console.log("Entities IPC handlers registered");
}

/**
 * Unregister all entities handlers
 */
export function unregisterEntitiesHandlers() {
  // Entities
  ipcMain.removeHandler("entities:getAll");
  ipcMain.removeHandler("entities:getById");
  ipcMain.removeHandler("entities:create");
  ipcMain.removeHandler("entities:update");
  ipcMain.removeHandler("entities:delete");
  ipcMain.removeHandler("entities:search");

  // Tasks
  ipcMain.removeHandler("tasks:getAll");
  ipcMain.removeHandler("tasks:getById");
  ipcMain.removeHandler("tasks:create");
  ipcMain.removeHandler("tasks:update");
  ipcMain.removeHandler("tasks:delete");

  // Issues
  ipcMain.removeHandler("issues:getAll");
  ipcMain.removeHandler("issues:getById");
  ipcMain.removeHandler("issues:create");
  ipcMain.removeHandler("issues:update");
  ipcMain.removeHandler("issues:delete");

  // Playlists
  ipcMain.removeHandler("playlists:getItems");
  ipcMain.removeHandler("playlists:addItem");
  ipcMain.removeHandler("playlists:removeItem");
  ipcMain.removeHandler("playlists:reorderItem");

  console.log("Entities IPC handlers unregistered");
}
