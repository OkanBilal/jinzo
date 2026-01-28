import { desc, eq, and, like, or, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { entities, tasks, issues, playlistItems } from "../../db/schema";
import { serializeLabels, serializeMetadata } from "./entities.utils";
import type {
  CreateEntityPayload,
  UpdateEntityPayload,
  CreateTaskPayload,
  UpdateTaskPayload,
  CreateIssuePayload,
  UpdateIssuePayload,
  EntityQueryOptions,
  TaskQueryOptions,
  IssueQueryOptions,
  SearchOptions,
} from "./entities.dto";

// ─────────────────────────────────────────────────────────────
// Entities Repository
// ─────────────────────────────────────────────────────────────
export const entitiesRepo = {
  // ─────────────────────────────────────────────────────────────
  // Entity Operations
  // ─────────────────────────────────────────────────────────────
  async findAll(options: EntityQueryOptions = {}) {
    const db = getDb();
    const { kinds, kind, connectionIds, connectionId, limit = 50 } = options;

    const conditions = [];
    if (kinds && kinds.length > 0) {
      conditions.push(inArray(entities.kind, kinds));
    } else if (kind) {
      conditions.push(eq(entities.kind, kind));
    }
    if (connectionIds && connectionIds.length > 0) {
      conditions.push(inArray(entities.connectionId, connectionIds));
    } else if (connectionId) {
      conditions.push(eq(entities.connectionId, connectionId));
    }
    conditions.push(eq(entities.isDeleted, false));

    const whereClause =
      conditions.length > 1 ? and(...conditions) : conditions[0];

    return db
      .select()
      .from(entities)
      .where(whereClause)
      .orderBy(desc(entities.updatedAt))
      .limit(limit);
  },

  async findById(id: string) {
    const db = getDb();
    const items = await db
      .select()
      .from(entities)
      .where(eq(entities.id, id))
      .limit(1);
    return items[0] || null;
  },

  async insert(id: string, payload: CreateEntityPayload) {
    const db = getDb();
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
    return this.findById(id);
  },

  async update(id: string, payload: UpdateEntityPayload) {
    const db = getDb();
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (payload.title !== undefined) updateData.title = payload.title;
    if (payload.body !== undefined) updateData.body = payload.body;
    if (payload.summary !== undefined) updateData.summary = payload.summary;
    if (payload.url !== undefined) updateData.url = payload.url;
    if (payload.isDeleted !== undefined) updateData.isDeleted = payload.isDeleted;
    if (payload.metadata !== undefined)
      updateData.metadata = serializeMetadata(payload.metadata);

    await db.update(entities).set(updateData).where(eq(entities.id, id));
    return this.findById(id);
  },

  async softDelete(id: string) {
    const db = getDb();
    await db
      .update(entities)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(entities.id, id));
  },

  async search(query: string, options: SearchOptions = {}) {
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

    return db
      .select()
      .from(entities)
      .where(and(...conditions))
      .orderBy(desc(entities.updatedAt))
      .limit(limit);
  },

  // ─────────────────────────────────────────────────────────────
  // Task Operations
  // ─────────────────────────────────────────────────────────────
  async findAllTasks(options: TaskQueryOptions = {}) {
    const db = getDb();
    const { status, limit = 50 } = options;

    const conditions = [eq(entities.isDeleted, false)];
    if (status) {
      conditions.push(eq(tasks.status, status));
    }

    return db
      .select({
        task: tasks,
        entity: entities,
      })
      .from(tasks)
      .innerJoin(entities, eq(tasks.entityId, entities.id))
      .where(and(...conditions))
      .orderBy(desc(tasks.priority), tasks.dueAt)
      .limit(limit);
  },

  async findTaskById(entityId: string) {
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
    return items[0] || null;
  },

  async insertTask(entityId: string, payload: CreateTaskPayload) {
    const db = getDb();

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

    return this.findTaskById(entityId);
  },

  async updateTask(entityId: string, payload: UpdateTaskPayload) {
    const db = getDb();
    const updateData: Record<string, unknown> = {};

    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.dueAt !== undefined) updateData.dueAt = payload.dueAt;
    if (payload.priority !== undefined) updateData.priority = payload.priority;
    if (payload.labels !== undefined)
      updateData.labels = serializeLabels(payload.labels);

    if (Object.keys(updateData).length > 0) {
      await db.update(tasks).set(updateData).where(eq(tasks.entityId, entityId));
      await db
        .update(entities)
        .set({ updatedAt: new Date() })
        .where(eq(entities.id, entityId));
    }

    return this.findTaskById(entityId);
  },

  // ─────────────────────────────────────────────────────────────
  // Issue Operations
  // ─────────────────────────────────────────────────────────────
  async findAllIssues(options: IssueQueryOptions = {}) {
    const db = getDb();
    const { provider, state, repo, limit = 50 } = options;

    const conditions = [eq(entities.isDeleted, false)];
    if (provider) conditions.push(eq(issues.provider, provider));
    if (state) conditions.push(eq(issues.state, state));
    if (repo) conditions.push(eq(issues.repo, repo));

    return db
      .select({
        issue: issues,
        entity: entities,
      })
      .from(issues)
      .innerJoin(entities, eq(issues.entityId, entities.id))
      .where(and(...conditions))
      .orderBy(
        sql`CASE WHEN ${issues.state} = 'open' THEN 0 ELSE 1 END`,
        desc(issues.number),
      )
      .limit(limit);
  },

  async findIssueById(entityId: string) {
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
    return items[0] || null;
  },

  async insertIssue(entityId: string, payload: CreateIssuePayload) {
    const db = getDb();

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

    return this.findIssueById(entityId);
  },

  async updateIssue(entityId: string, payload: UpdateIssuePayload) {
    const db = getDb();
    const updateData: Record<string, unknown> = {};

    if (payload.state !== undefined) updateData.state = payload.state;
    if (payload.assignee !== undefined) updateData.assignee = payload.assignee;
    if (payload.priority !== undefined) updateData.priority = payload.priority;
    if (payload.closedAt !== undefined) updateData.closedAt = payload.closedAt;
    if (payload.labels !== undefined)
      updateData.labels = serializeLabels(payload.labels);

    if (Object.keys(updateData).length > 0) {
      await db.update(issues).set(updateData).where(eq(issues.entityId, entityId));
      await db
        .update(entities)
        .set({ updatedAt: new Date() })
        .where(eq(entities.id, entityId));
    }

    return this.findIssueById(entityId);
  },

  // ─────────────────────────────────────────────────────────────
  // Playlist Operations
  // ─────────────────────────────────────────────────────────────
  async findPlaylistItems(playlistEntityId: string) {
    const db = getDb();
    return db
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
  },

  async addPlaylistItem(
    playlistEntityId: string,
    itemEntityId: string,
    position?: number
  ) {
    const db = getDb();

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
  },

  async removePlaylistItem(playlistEntityId: string, itemEntityId: string) {
    const db = getDb();
    await db
      .delete(playlistItems)
      .where(
        and(
          eq(playlistItems.playlistEntityId, playlistEntityId),
          eq(playlistItems.itemEntityId, itemEntityId)
        )
      );
  },

  async reorderPlaylistItem(
    playlistEntityId: string,
    itemEntityId: string,
    newPosition: number
  ) {
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
  },
};
