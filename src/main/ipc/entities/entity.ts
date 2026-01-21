import { ipcMain } from "electron";
import { desc, eq, and, like, or, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db/client";
import { entities } from "../../db/schema";
import { serializeMetadata } from "./utils";
import type {
  CreateEntityPayload,
  UpdateEntityPayload,
  EntityQueryOptions,
  SearchOptions,
} from "./types";

export function registerEntityHandlers() {
  // Get all entities with optional filtering
  ipcMain.handle(
    "entities:getAll",
    async (_, options: EntityQueryOptions = {}) => {
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
    async (_, query: string, options: SearchOptions = {}) => {
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
}

export function unregisterEntityHandlers() {
  ipcMain.removeHandler("entities:getAll");
  ipcMain.removeHandler("entities:getById");
  ipcMain.removeHandler("entities:create");
  ipcMain.removeHandler("entities:update");
  ipcMain.removeHandler("entities:delete");
  ipcMain.removeHandler("entities:search");
}
