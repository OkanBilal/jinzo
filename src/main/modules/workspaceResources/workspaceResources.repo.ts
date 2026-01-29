import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db/client";
import { workspaceResources, connectionResources, entities, issues } from "../../db/schema";
import type { WorkspaceResource, WorkspaceResourceWithDetails, AvailableResource } from "./workspaceResources.dto";

// ─────────────────────────────────────────────────────────────
// Workspace Resources Repository
// ─────────────────────────────────────────────────────────────

export const workspaceResourcesRepo = {
  /**
   * Get all resources linked to a workspace
   */
  async findByWorkspace(workspaceId: string): Promise<WorkspaceResourceWithDetails[]> {
    const db = getDb();
    const results = await db
      .select({
        id: workspaceResources.id,
        workspaceId: workspaceResources.workspaceId,
        resourceId: workspaceResources.resourceId,
        createdAt: workspaceResources.createdAt,
        resource: {
          id: connectionResources.id,
          connectionId: connectionResources.connectionId,
          externalId: connectionResources.externalId,
          kind: connectionResources.kind,
          name: connectionResources.name,
          url: connectionResources.url,
          metadata: connectionResources.metadata,
        },
      })
      .from(workspaceResources)
      .innerJoin(connectionResources, eq(workspaceResources.resourceId, connectionResources.id))
      .where(eq(workspaceResources.workspaceId, workspaceId));

    return results;
  },

  /**
   * Get all available resources (with isLinked flag for a workspace)
   */
  async findAvailableResources(workspaceId: string, kinds: string[]): Promise<AvailableResource[]> {
    const db = getDb();
    // Get all resources of the specified kinds
    const allResources = await db
      .select()
      .from(connectionResources)
      .where(
        and(
          inArray(connectionResources.kind, kinds),
          eq(connectionResources.selected, true)
        )
      );

    // Get linked resource IDs for this workspace
    const linkedResources = await db
      .select({ resourceId: workspaceResources.resourceId })
      .from(workspaceResources)
      .where(eq(workspaceResources.workspaceId, workspaceId));

    const linkedIds = new Set(linkedResources.map((r) => r.resourceId));

    return allResources.map((resource) => ({
      id: resource.id,
      connectionId: resource.connectionId,
      externalId: resource.externalId,
      kind: resource.kind,
      name: resource.name,
      url: resource.url,
      metadata: resource.metadata,
      isLinked: linkedIds.has(resource.id),
    }));
  },

  /**
   * Add a resource to a workspace
   */
  async addResource(id: string, workspaceId: string, resourceId: string): Promise<WorkspaceResource> {
    const db = getDb();
    const [result] = await db
      .insert(workspaceResources)
      .values({
        id,
        workspaceId,
        resourceId,
      })
      .returning();

    return result;
  },

  /**
   * Remove a resource from a workspace
   */
  async removeResource(workspaceId: string, resourceId: string): Promise<void> {
    const db = getDb();
    await db
      .delete(workspaceResources)
      .where(
        and(
          eq(workspaceResources.workspaceId, workspaceId),
          eq(workspaceResources.resourceId, resourceId)
        )
      );
  },

  /**
   * Check if a resource is linked to a workspace
   */
  async isLinked(workspaceId: string, resourceId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .select({ id: workspaceResources.id })
      .from(workspaceResources)
      .where(
        and(
          eq(workspaceResources.workspaceId, workspaceId),
          eq(workspaceResources.resourceId, resourceId)
        )
      )
      .limit(1);

    return result.length > 0;
  },

  /**
   * Get issues for a workspace via linked resources
   */
  async findIssuesByWorkspace(workspaceId: string) {
    const db = getDb();
    // Get all linked resource IDs for this workspace
    const linkedResources = await db
      .select({ resourceId: workspaceResources.resourceId })
      .from(workspaceResources)
      .where(eq(workspaceResources.workspaceId, workspaceId));

    if (linkedResources.length === 0) {
      return [];
    }

    const resourceIds = linkedResources.map((r) => r.resourceId);

    // Get issues where entity.resourceId matches any linked resource
    const results = await db
      .select({
        issue: issues,
        entity: entities,
      })
      .from(issues)
      .innerJoin(entities, eq(issues.entityId, entities.id))
      .where(
        and(
          eq(entities.isDeleted, false),
          inArray(entities.resourceId, resourceIds)
        )
      )
      .orderBy(issues.number);

    return results;
  },
};
