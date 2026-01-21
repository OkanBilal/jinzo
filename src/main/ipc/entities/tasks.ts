import { ipcMain } from "electron";
import { desc, eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db/client";
import { entities, tasks } from "../../db/schema";
import { serializeLabels, serializeMetadata } from "./utils";
import type { CreateTaskPayload, UpdateTaskPayload, TaskQueryOptions } from "./types";

export function registerTaskHandlers() {
  // Get all tasks with optional status filter
  ipcMain.handle(
    "tasks:getAll",
    async (_, options: TaskQueryOptions = {}) => {
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
}

export function unregisterTaskHandlers() {
  ipcMain.removeHandler("tasks:getAll");
  ipcMain.removeHandler("tasks:getById");
  ipcMain.removeHandler("tasks:create");
  ipcMain.removeHandler("tasks:update");
  ipcMain.removeHandler("tasks:delete");
}
