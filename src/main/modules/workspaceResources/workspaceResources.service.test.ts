import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createProject,
  createConnection,
  createConnectionResource,
  createProjectResource,
  createAccount,
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

// Mock crypto.randomUUID for deterministic IDs
vi.stubGlobal("crypto", {
  ...crypto,
  randomUUID: () => "mock-uuid-1234",
});

import { workspaceResourcesService } from "./workspaceResources.service";
import { workspaceResourcesRepo } from "./workspaceResources.repo";

describe("workspaceResourcesService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("getByProject", () => {
    it("returns resources for project", async () => {
      const project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      const resource = createConnectionResource(db, {
        id: "res-1",
        connectionId: conn.id,
        name: "my-repo",
      });
      createProjectResource(db, {
        projectId: project.id,
        resourceId: resource.id,
      });

      const result = await workspaceResourcesService.getByProject("proj-1");
      assertOk(result);
      expect(result.data!.resources).toHaveLength(1);
    });

    it("returns error when projectId is empty", async () => {
      const result = await workspaceResourcesService.getByProject("");
      assertFail(result);
      expect(result.error).toBe("projectId is required");
    });
  });

  describe("getAvailableResources", () => {
    it("returns available resources", async () => {
      const _project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      createConnectionResource(db, {
        id: "res-1",
        connectionId: conn.id,
        kind: "github_repo",
        selected: true,
      });

      const result =
        await workspaceResourcesService.getAvailableResources("proj-1");
      assertOk(result);
      expect(result.data!.resources).toHaveLength(1);
    });

    it("returns error when projectId is empty", async () => {
      const result = await workspaceResourcesService.getAvailableResources("");
      assertFail(result);
    });
  });

  describe("addResource", () => {
    it("adds resource to project", async () => {
      const _project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      createConnectionResource(db, { id: "res-1", connectionId: conn.id });

      const result = await workspaceResourcesService.addResource(
        "proj-1",
        "res-1",
      );
      assertOk(result);
      expect(result.data!.resource.projectId).toBe("proj-1");
    });

    it("rejects duplicate link", async () => {
      const project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      createConnectionResource(db, { id: "res-1", connectionId: conn.id });
      createProjectResource(db, {
        projectId: project.id,
        resourceId: "res-1",
      });

      const result = await workspaceResourcesService.addResource(
        "proj-1",
        "res-1",
      );
      assertFail(result);
      expect(result.error).toBe("Resource is already linked to this project");
    });

    it("returns error when projectId is empty", async () => {
      const result = await workspaceResourcesService.addResource("", "res-1");
      assertFail(result);
    });

    it("returns error when resourceId is empty", async () => {
      const result = await workspaceResourcesService.addResource("proj-1", "");
      assertFail(result);
    });
  });

  describe("removeResource", () => {
    it("removes resource from project", async () => {
      const project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      createConnectionResource(db, { id: "res-1", connectionId: conn.id });
      createProjectResource(db, {
        projectId: project.id,
        resourceId: "res-1",
      });

      const result = await workspaceResourcesService.removeResource(
        "proj-1",
        "res-1",
      );
      assertOk(result);
    });

    it("returns error when params are empty", async () => {
      const result = await workspaceResourcesService.removeResource("", "");
      assertFail(result);
    });
  });

  describe("getIssuesByProject", () => {
    it("returns error when projectId is empty", async () => {
      const result = await workspaceResourcesService.getIssuesByProject("");
      assertFail(result);
    });

    it("returns empty issues when no linked resources", async () => {
      createProject(db, { id: "proj-1" });

      const result =
        await workspaceResourcesService.getIssuesByProject("proj-1");
      assertOk(result);
      expect(result.data!.issues).toEqual([]);
    });

    it("returns issues linked via project resources", async () => {
      createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      const resource = createConnectionResource(db, {
        id: "res-1",
        connectionId: conn.id,
        kind: "github_repo",
      });
      createProjectResource(db, { projectId: "proj-1", resourceId: resource.id });

      // Create an issue with resourceId matching the linked resource
      createIssue(db, {
        entity: { accountId: "default", resourceId: resource.id, kind: "issue", title: "Bug" },
        issue: { provider: "github", state: "open" },
      });

      const result = await workspaceResourcesService.getIssuesByProject("proj-1");
      assertOk(result);
      expect(result.data!.issues).toHaveLength(1);
      expect(result.data!.issues[0].entity.title).toBe("Bug");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error handling (coverage for catch blocks)
  // ─────────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("getByProject returns error on failure", async () => {
      vi.spyOn(workspaceResourcesRepo, "findByProject").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceResourcesService.getByProject("proj-1");
      assertFail(result);
      expect(result.error).toBe("Failed to get project resources");
    });

    it("getAvailableResources returns error on failure", async () => {
      vi.spyOn(workspaceResourcesRepo, "findAvailableResources").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceResourcesService.getAvailableResources("proj-1");
      assertFail(result);
      expect(result.error).toBe("Failed to get available resources");
    });

    it("addResource returns error on failure", async () => {
      vi.spyOn(workspaceResourcesRepo, "isLinked").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceResourcesService.addResource("proj-1", "res-1");
      assertFail(result);
      expect(result.error).toBe("Failed to add resource to project");
    });

    it("removeResource returns error on failure", async () => {
      vi.spyOn(workspaceResourcesRepo, "removeResource").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceResourcesService.removeResource("proj-1", "res-1");
      assertFail(result);
      expect(result.error).toBe("Failed to remove resource from project");
    });

    it("getIssuesByProject returns error on failure", async () => {
      vi.spyOn(workspaceResourcesRepo, "findIssuesByProject").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceResourcesService.getIssuesByProject("proj-1");
      assertFail(result);
      expect(result.error).toBe("Failed to get issues");
    });
  });
});
