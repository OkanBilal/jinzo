import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db/client";
import { projectResources, connectionResources, entities, issues } from "../../db/schema";
import type { ProjectResource, ProjectResourceWithDetails, AvailableResource } from "./workspaceResources.dto";

// ─────────────────────────────────────────────────────────────
// Project Resources Repository
// ─────────────────────────────────────────────────────────────

export const workspaceResourcesRepo = {
  /**
   * Get all resources linked to a project
   */
  async findByProject(projectId: string): Promise<ProjectResourceWithDetails[]> {
    const db = getDb();
    const results = await db
      .select({
        id: projectResources.id,
        projectId: projectResources.projectId,
        resourceId: projectResources.resourceId,
        createdAt: projectResources.createdAt,
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
      .from(projectResources)
      .innerJoin(connectionResources, eq(projectResources.resourceId, connectionResources.id))
      .where(eq(projectResources.projectId, projectId));

    return results;
  },

  /**
   * Get all available resources (with isLinked flag for a project)
   */
  async findAvailableResources(projectId: string, kinds: string[]): Promise<AvailableResource[]> {
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

    // Get linked resource IDs for this project
    const linkedResources = await db
      .select({ resourceId: projectResources.resourceId })
      .from(projectResources)
      .where(eq(projectResources.projectId, projectId));

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
   * Add a resource to a project
   */
  async addResource(id: string, projectId: string, resourceId: string): Promise<ProjectResource> {
    const db = getDb();
    const [result] = await db
      .insert(projectResources)
      .values({
        id,
        projectId,
        resourceId,
      })
      .returning();

    return result;
  },

  /**
   * Remove a resource from a project
   */
  async removeResource(projectId: string, resourceId: string): Promise<void> {
    const db = getDb();
    await db
      .delete(projectResources)
      .where(
        and(
          eq(projectResources.projectId, projectId),
          eq(projectResources.resourceId, resourceId)
        )
      );
  },

  /**
   * Check if a resource is linked to a project
   */
  async isLinked(projectId: string, resourceId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .select({ id: projectResources.id })
      .from(projectResources)
      .where(
        and(
          eq(projectResources.projectId, projectId),
          eq(projectResources.resourceId, resourceId)
        )
      )
      .limit(1);

    return result.length > 0;
  },

  /**
   * Get issues for a project via linked resources
   */
  async findIssuesByProject(projectId: string) {
    const db = getDb();
    // Get all linked resource IDs for this project
    const linkedResources = await db
      .select({ resourceId: projectResources.resourceId })
      .from(projectResources)
      .where(eq(projectResources.projectId, projectId));

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
