import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createProject,
  createConnection,
  createConnectionResource,
  createProjectResource,
  createAccount,
} from "../../../test/factories";
import { entities, issues } from "../../db/schema";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { workspaceResourcesRepo } from "./workspaceResources.repo";

describe("workspaceResourcesRepo", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("findByProject", () => {
    it("returns empty array when no resources linked", async () => {
      const project = createProject(db, { id: "proj-1" });
      const result = await workspaceResourcesRepo.findByProject(project.id);
      expect(result).toEqual([]);
    });

    it("returns linked resources with details", async () => {
      const project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      const resource = createConnectionResource(db, {
        id: "res-1",
        connectionId: conn.id,
        externalId: "ext-1",
        kind: "github_repo",
        name: "my-repo",
      });
      createProjectResource(db, {
        projectId: project.id,
        resourceId: resource.id,
      });

      const result = await workspaceResourcesRepo.findByProject("proj-1");
      expect(result).toHaveLength(1);
      expect(result[0].resource.name).toBe("my-repo");
      expect(result[0].resource.kind).toBe("github_repo");
    });
  });

  describe("findAvailableResources", () => {
    it("returns resources with isLinked flag", async () => {
      const project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });

      // Create two resources, link one
      const res1 = createConnectionResource(db, {
        id: "res-1",
        connectionId: conn.id,
        kind: "github_repo",
        selected: true,
      });
      createConnectionResource(db, {
        id: "res-2",
        connectionId: conn.id,
        kind: "github_repo",
        selected: true,
      });

      createProjectResource(db, {
        projectId: project.id,
        resourceId: res1.id,
      });

      const result = await workspaceResourcesRepo.findAvailableResources(
        "proj-1",
        ["github_repo"],
      );
      expect(result).toHaveLength(2);

      const linked = result.find((r) => r.id === "res-1");
      const unlinked = result.find((r) => r.id === "res-2");
      expect(linked!.isLinked).toBe(true);
      expect(unlinked!.isLinked).toBe(false);
    });

    it("filters by kind", async () => {
      const conn = createConnection(db, { id: "conn-1" });
      createConnectionResource(db, {
        id: "res-gh",
        connectionId: conn.id,
        kind: "github_repo",
        selected: true,
      });
      createConnectionResource(db, {
        id: "res-lr",
        connectionId: conn.id,
        kind: "linear_team",
        selected: true,
      });

      const result = await workspaceResourcesRepo.findAvailableResources(
        "proj-1",
        ["github_repo"],
      );
      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe("github_repo");
    });

    it("excludes non-selected resources", async () => {
      const conn = createConnection(db, { id: "conn-1" });
      createConnectionResource(db, {
        id: "res-sel",
        connectionId: conn.id,
        kind: "github_repo",
        selected: true,
      });
      createConnectionResource(db, {
        id: "res-not",
        connectionId: conn.id,
        kind: "github_repo",
        selected: false,
      });

      const result = await workspaceResourcesRepo.findAvailableResources(
        "proj-1",
        ["github_repo"],
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("res-sel");
    });
  });

  describe("addResource", () => {
    it("adds a resource to project", async () => {
      const project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      const resource = createConnectionResource(db, {
        id: "res-1",
        connectionId: conn.id,
      });

      const result = await workspaceResourcesRepo.addResource(
        "pr-1",
        project.id,
        resource.id,
      );
      expect(result.projectId).toBe("proj-1");
      expect(result.resourceId).toBe("res-1");
    });
  });

  describe("removeResource", () => {
    it("removes a linked resource", async () => {
      const project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      const resource = createConnectionResource(db, {
        id: "res-1",
        connectionId: conn.id,
      });
      createProjectResource(db, {
        projectId: project.id,
        resourceId: resource.id,
      });

      await workspaceResourcesRepo.removeResource("proj-1", "res-1");

      const linked = await workspaceResourcesRepo.isLinked("proj-1", "res-1");
      expect(linked).toBe(false);
    });
  });

  describe("isLinked", () => {
    it("returns true when linked", async () => {
      const project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      const resource = createConnectionResource(db, {
        id: "res-1",
        connectionId: conn.id,
      });
      createProjectResource(db, {
        projectId: project.id,
        resourceId: resource.id,
      });

      const result = await workspaceResourcesRepo.isLinked("proj-1", "res-1");
      expect(result).toBe(true);
    });

    it("returns false when not linked", async () => {
      const result = await workspaceResourcesRepo.isLinked("proj-1", "res-1");
      expect(result).toBe(false);
    });
  });

  describe("findIssuesByProject", () => {
    it("returns empty array when no linked resources", async () => {
      const result = await workspaceResourcesRepo.findIssuesByProject("proj-1");
      expect(result).toEqual([]);
    });

    it("returns issues via linked resources", async () => {
      const project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      const resource = createConnectionResource(db, {
        id: "res-1",
        connectionId: conn.id,
        kind: "github_repo",
      });
      createProjectResource(db, {
        projectId: project.id,
        resourceId: resource.id,
      });

      // Create entity linked to the resource
      db.insert(entities)
        .values({
          id: "ent-1",
          accountId: "default",
          kind: "issue",
          resourceId: "res-1",
          title: "Fix bug",
          isDeleted: false,
        })
        .run();

      // Create issue linked to entity
      db.insert(issues)
        .values({
          entityId: "ent-1",
          provider: "github",
          state: "open",
          number: 42,
          repo: "owner/repo",
        })
        .run();

      const result =
        await workspaceResourcesRepo.findIssuesByProject("proj-1");
      expect(result).toHaveLength(1);
      expect(result[0].issue.number).toBe(42);
      expect(result[0].entity.title).toBe("Fix bug");
    });

    it("excludes deleted entities", async () => {
      const project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      const resource = createConnectionResource(db, {
        id: "res-1",
        connectionId: conn.id,
      });
      createProjectResource(db, {
        projectId: project.id,
        resourceId: resource.id,
      });

      // Deleted entity
      db.insert(entities)
        .values({
          id: "ent-del",
          accountId: "default",
          kind: "issue",
          resourceId: "res-1",
          isDeleted: true,
        })
        .run();

      db.insert(issues)
        .values({
          entityId: "ent-del",
          provider: "github",
          state: "open",
        })
        .run();

      const result =
        await workspaceResourcesRepo.findIssuesByProject("proj-1");
      expect(result).toHaveLength(0);
    });
  });
});
