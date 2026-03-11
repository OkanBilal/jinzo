import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
  createProject,
  createConnection,
  createConnectionResource,
  createProjectResource,
  createEntity,
  createIssue,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { workspaceResourcesController } from "./workspaceResources.controller";

describe("workspaceResourcesController", () => {
  let projectId: string;
  let connectionId: string;
  let resourceId: string;

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });

    const project = createProject(db, { accountId: "default" });
    projectId = project.id;

    const conn = createConnection(db, { provider: "github", type: "oauth" });
    connectionId = conn.id;

    const resource = createConnectionResource(db, {
      connectionId,
      externalId: "owner/repo",
      kind: "github_repo",
      name: "Test Repo",
    });
    resourceId = resource.id;
  });

  afterEach(() => {
    cleanup();
  });

  // ─── getByProject ────────────────────────────────────────
  describe("getByProject", () => {
    it("returns empty resources when none linked", async () => {
      const result = await workspaceResourcesController.getByProject(projectId);
      expect(result.success).toBe(true);
      expect(result.data!.resources).toEqual([]);
    });

    it("returns linked resources with details", async () => {
      createProjectResource(db, { projectId, resourceId });

      const result = await workspaceResourcesController.getByProject(projectId);
      expect(result.success).toBe(true);
      expect(result.data!.resources).toHaveLength(1);
      expect(result.data!.resources[0].resourceId).toBe(resourceId);
    });
  });

  // ─── getAvailableResources ───────────────────────────────
  describe("getAvailableResources", () => {
    it("returns available resources with isLinked flag", async () => {
      const result = await workspaceResourcesController.getAvailableResources(projectId);
      expect(result.success).toBe(true);
      expect(result.data!.resources.length).toBeGreaterThanOrEqual(1);

      const found = result.data!.resources.find((r) => r.id === resourceId);
      expect(found).toBeDefined();
      expect(found!.isLinked).toBe(false);
    });

    it("marks already-linked resources as isLinked", async () => {
      createProjectResource(db, { projectId, resourceId });

      const result = await workspaceResourcesController.getAvailableResources(projectId);
      expect(result.success).toBe(true);

      const found = result.data!.resources.find((r) => r.id === resourceId);
      expect(found).toBeDefined();
      expect(found!.isLinked).toBe(true);
    });
  });

  // ─── addResource ─────────────────────────────────────────
  describe("addResource", () => {
    it("links a resource to a project", async () => {
      const result = await workspaceResourcesController.addResource({
        projectId,
        resourceId,
      });
      expect(result.success).toBe(true);
      expect(result.data!.resource.projectId).toBe(projectId);
      expect(result.data!.resource.resourceId).toBe(resourceId);
    });

    it("fails when resource is already linked", async () => {
      createProjectResource(db, { projectId, resourceId });

      const result = await workspaceResourcesController.addResource({
        projectId,
        resourceId,
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── removeResource ──────────────────────────────────────
  describe("removeResource", () => {
    it("removes a linked resource from a project", async () => {
      createProjectResource(db, { projectId, resourceId });

      const result = await workspaceResourcesController.removeResource({
        projectId,
        resourceId,
      });
      expect(result.success).toBe(true);

      const check = await workspaceResourcesController.getByProject(projectId);
      expect(check.data!.resources).toHaveLength(0);
    });
  });

  // ─── getIssuesByProject ──────────────────────────────────
  describe("getIssuesByProject", () => {
    it("returns empty when no issues linked", async () => {
      createProjectResource(db, { projectId, resourceId });

      const result = await workspaceResourcesController.getIssuesByProject(projectId);
      expect(result.success).toBe(true);
      expect(result.data!.issues).toEqual([]);
    });

    it("returns issues linked via project resources", async () => {
      createProjectResource(db, { projectId, resourceId });

      // Create an entity + issue linked to the same resourceId
      const entity = createEntity(db, {
        accountId: "default",
        kind: "issue",
        title: "Bug report",
        connectionId,
        resourceId,
      });
      createIssue(db, {
        entity: { id: entity.id },
        issue: { provider: "github", state: "open", repo: "owner/repo" },
      });

      const result = await workspaceResourcesController.getIssuesByProject(projectId);
      expect(result.success).toBe(true);
      expect(result.data!.issues.length).toBeGreaterThanOrEqual(1);
    });
  });
});
