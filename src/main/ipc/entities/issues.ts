import { ipcMain } from "electron";
import { desc, eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db/client";
import { entities, issues } from "../../db/schema";
import { serializeLabels, serializeMetadata } from "./utils";
import type { CreateIssuePayload, UpdateIssuePayload, IssueQueryOptions } from "./types";

export function registerIssueHandlers() {
  // Get all issues with optional filtering
  ipcMain.handle(
    "issues:getAll",
    async (_, options: IssueQueryOptions = {}) => {
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
}

export function unregisterIssueHandlers() {
  ipcMain.removeHandler("issues:getAll");
  ipcMain.removeHandler("issues:getById");
  ipcMain.removeHandler("issues:create");
  ipcMain.removeHandler("issues:update");
  ipcMain.removeHandler("issues:delete");
}
