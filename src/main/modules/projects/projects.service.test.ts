import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
  createConnection,
  createConnectionResource,
  createIssue,
  createProject,
  createProjectResource,
  createRun,
  createWorkspace,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

vi.mock("../git/git.service", () => ({
  gitService: {
    removeWorktree: vi.fn(),
  },
}));

vi.stubGlobal("crypto", {
  ...crypto,
  randomUUID: () => "mock-uuid-1234",
});

import { projectsService } from "./projects.service";
import { projectsRepo } from "./projects.repo";

describe("projectsService", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("list", () => {
    it("returns empty list when no projects exist", async () => {
      const result = await projectsService.list();
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns all non-archived projects", async () => {
      createProject(db, { id: "p1", name: "Project A" });
      createProject(db, { id: "p2", name: "Project B" });

      const result = await projectsService.list();
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("get", () => {
    it("returns the project when found", async () => {
      createProject(db, { id: "p1", name: "Found" });

      const result = await projectsService.get("p1");
      assertOk(result);
      expect(result.data!.name).toBe("Found");
    });

    it("returns error when not found", async () => {
      const result = await projectsService.get("nonexistent");
      assertFail(result);
      expect(result.error).toBe("Project not found");
    });
  });

  describe("listByAccount", () => {
    it("returns projects for the account", async () => {
      createProject(db, { id: "p1", accountId: "default" });

      const result = await projectsService.listByAccount("default");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("findByRemoteOrigin", () => {
    it("finds project by normalized origin", async () => {
      createProject(db, {
        id: "p1",
        accountId: "default",
        remoteOrigin: "github.com/user/repo",
      });

      const result = await projectsService.findByRemoteOrigin(
        "default",
        "https://github.com/user/repo.git",
      );
      assertOk(result);
      expect(result.data!.id).toBe("p1");
    });

    it("returns error when not found", async () => {
      const result = await projectsService.findByRemoteOrigin("default", "github.com/nope/nope");
      assertFail(result);
    });
  });

  describe("findOrCreate", () => {
    it("creates a new project if none exists", async () => {
      const result = await projectsService.findOrCreate({
        accountId: "default",
        name: "New",
        rootPath: "/tmp/new",
        remoteOrigin: "https://github.com/test/new.git",
      });

      assertOk(result);
      expect(result.data!.name).toBe("New");
      expect(result.data!.remoteOrigin).toBe("github.com/test/new");
    });

    it("returns existing project if same origin exists", async () => {
      createProject(db, {
        id: "existing",
        accountId: "default",
        name: "Existing",
        remoteOrigin: "github.com/test/dup",
      });

      const result = await projectsService.findOrCreate({
        accountId: "default",
        name: "Duplicate",
        rootPath: "/tmp/dup",
        remoteOrigin: "https://github.com/test/dup.git",
      });

      assertOk(result);
      expect(result.data!.id).toBe("existing");
      expect(result.data!.name).toBe("Existing");
    });
  });

  describe("create", () => {
    it("creates a project successfully", async () => {
      const result = await projectsService.create({
        accountId: "default",
        name: "Created",
        rootPath: "/tmp/created",
        remoteOrigin: "https://github.com/test/created.git",
      });

      assertOk(result);
      expect(result.data!.name).toBe("Created");
    });

    it("rejects duplicate remote origin", async () => {
      createProject(db, {
        accountId: "default",
        remoteOrigin: "github.com/test/unique",
      });

      const result = await projectsService.create({
        accountId: "default",
        name: "Dup",
        rootPath: "/tmp/dup",
        remoteOrigin: "https://github.com/test/unique.git",
      });

      assertFail(result);
      expect(result.error).toBe("Project with this remote origin already exists");
    });
  });

  describe("update", () => {
    it("updates project fields", async () => {
      createProject(db, { id: "u1", name: "Old" });

      const result = await projectsService.update("u1", { name: "New" });
      assertOk(result);
      expect(result.data!.name).toBe("New");
    });
  });

  describe("delete", () => {
    it("deletes a project", async () => {
      createProject(db, { id: "d1" });

      const result = await projectsService.delete("d1");
      assertOk(result);

      const check = await projectsService.get("d1");
      assertFail(check);
    });
  });

  describe("archive", () => {
    it("archives a project", async () => {
      createProject(db, { id: "a1" });

      const result = await projectsService.archive("a1");
      assertOk(result);
      expect(result.data!.isArchived).toBe(true);
    });

    it("returns error when project not found", async () => {
      const result = await projectsService.archive("nonexistent");
      assertFail(result);
    });
  });

  describe("remove", () => {
    it("returns error when project not found", async () => {
      const result = await projectsService.remove("nonexistent");
      assertFail(result);
      expect(result.error).toBe("Project not found");
    });

    it("removes project and associated workspaces/runs", async () => {
      createProject(db, { id: "p1", rootPath: "/tmp/project1" });
      createWorkspace(db, { id: "ws1", projectId: "p1", rootPath: "/tmp/ws1" });
      createRun(db, { id: "r1", workspaceId: "ws1" });

      const result = await projectsService.remove("p1");
      assertOk(result);

      const check = await projectsService.get("p1");
      assertFail(check);
    });
  });

  describe("update - edge cases", () => {
    it("returns error when project not found", async () => {
      const result = await projectsService.update("nonexistent", { name: "X" });
      assertFail(result);
      expect(result.error).toBe("Project not found");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Project resources (formerly workspaceResources/)
  // ─────────────────────────────────────────────────────────────
  describe("listResources", () => {
    it("returns resources linked to the project", async () => {
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

      const result = await projectsService.listResources("proj-1");
      assertOk(result);
      expect(result.data!.resources).toHaveLength(1);
    });

    it("returns error when projectId is empty", async () => {
      const result = await projectsService.listResources("");
      assertFail(result);
      expect(result.error).toBe("projectId is required");
    });
  });

  describe("listAvailableResources", () => {
    it("returns linkable resources", async () => {
      createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      createConnectionResource(db, {
        id: "res-1",
        connectionId: conn.id,
        kind: "github_repo",
        selected: true,
      });

      const result = await projectsService.listAvailableResources("proj-1");
      assertOk(result);
      expect(result.data!.resources).toHaveLength(1);
    });

    it("returns error when projectId is empty", async () => {
      const result = await projectsService.listAvailableResources("");
      assertFail(result);
    });
  });

  describe("addResource", () => {
    it("adds resource to project", async () => {
      createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      createConnectionResource(db, { id: "res-1", connectionId: conn.id });

      const result = await projectsService.addResource("proj-1", "res-1");
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

      const result = await projectsService.addResource("proj-1", "res-1");
      assertFail(result);
      expect(result.error).toBe("Resource is already linked to this project");
    });

    it("returns error when projectId is empty", async () => {
      const result = await projectsService.addResource("", "res-1");
      assertFail(result);
    });

    it("returns error when resourceId is empty", async () => {
      const result = await projectsService.addResource("proj-1", "");
      assertFail(result);
    });
  });

  describe("removeResource", () => {
    it("removes resource from project", async () => {
      const project = createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      createConnectionResource(db, { id: "res-1", connectionId: conn.id });
      createProjectResource(db, { projectId: project.id, resourceId: "res-1" });

      const result = await projectsService.removeResource("proj-1", "res-1");
      assertOk(result);
    });

    it("returns error when params are empty", async () => {
      const result = await projectsService.removeResource("", "");
      assertFail(result);
    });
  });

  describe("listIssues", () => {
    it("returns error when projectId is empty", async () => {
      const result = await projectsService.listIssues("");
      assertFail(result);
    });

    it("returns empty issues when no linked resources", async () => {
      createProject(db, { id: "proj-1" });
      const result = await projectsService.listIssues("proj-1");
      assertOk(result);
      expect(result.data!.issues).toEqual([]);
    });

    it("orchestrates: linked resourceIds → entities barrel → serialized rows", async () => {
      createProject(db, { id: "proj-1" });
      const conn = createConnection(db, { id: "conn-1" });
      const resource = createConnectionResource(db, {
        id: "res-1",
        connectionId: conn.id,
        kind: "github_repo",
      });
      createProjectResource(db, { projectId: "proj-1", resourceId: resource.id });

      createIssue(db, {
        entity: {
          accountId: "default",
          resourceId: resource.id,
          kind: "issue",
          title: "Bug",
        },
        issue: { provider: "github", state: "open" },
      });

      const result = await projectsService.listIssues("proj-1");
      assertOk(result);
      expect(result.data!.issues).toHaveLength(1);
      const first = result.data!.issues[0] as { entity: { title: string } };
      expect(first.entity.title).toBe("Bug");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error paths
  // ─────────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("list returns error on failure", async () => {
      vi.spyOn(projectsRepo, "findAll").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.list();
      assertFail(result);
      expect(result.error).toBe("Failed to list projects");
    });

    it("get returns error on failure", async () => {
      vi.spyOn(projectsRepo, "findById").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.get("p1");
      assertFail(result);
      expect(result.error).toBe("Failed to get project");
    });

    it("listByAccount returns error on failure", async () => {
      vi.spyOn(projectsRepo, "findByAccountId").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.listByAccount("default");
      assertFail(result);
      expect(result.error).toBe("Failed to list projects");
    });

    it("findByRemoteOrigin returns error on failure", async () => {
      vi.spyOn(projectsRepo, "findByRemoteOrigin").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.findByRemoteOrigin("default", "github.com/x/y");
      assertFail(result);
      expect(result.error).toBe("Failed to find project");
    });

    it("create returns error on failure", async () => {
      vi.spyOn(projectsRepo, "findByRemoteOrigin").mockResolvedValueOnce(null);
      vi.spyOn(projectsRepo, "insert").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.create({
        accountId: "default",
        name: "Fail",
        rootPath: "/fail",
        remoteOrigin: "github.com/fail/fail",
      });
      assertFail(result);
      expect(result.error).toBe("Failed to create project");
    });

    it("delete returns error on failure", async () => {
      vi.spyOn(projectsRepo, "delete").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.delete("p1");
      assertFail(result);
      expect(result.error).toBe("Failed to delete project");
    });

    it("archive returns error on failure", async () => {
      vi.spyOn(projectsRepo, "archive").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.archive("p1");
      assertFail(result);
      expect(result.error).toBe("Failed to archive project");
    });

    it("listResources returns error on failure", async () => {
      vi.spyOn(projectsRepo, "listResourcesByProject").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.listResources("p1");
      assertFail(result);
      expect(result.error).toBe("Failed to list project resources");
    });

    it("listAvailableResources returns error on failure", async () => {
      vi.spyOn(projectsRepo, "listAvailableResources").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.listAvailableResources("p1");
      assertFail(result);
      expect(result.error).toBe("Failed to list available resources");
    });

    it("addResource returns error on failure", async () => {
      vi.spyOn(projectsRepo, "isResourceLinked").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.addResource("p1", "r1");
      assertFail(result);
      expect(result.error).toBe("Failed to add resource to project");
    });

    it("removeResource returns error on failure", async () => {
      vi.spyOn(projectsRepo, "removeResource").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.removeResource("p1", "r1");
      assertFail(result);
      expect(result.error).toBe("Failed to remove resource from project");
    });

    it("listIssues returns error on failure", async () => {
      vi.spyOn(projectsRepo, "listLinkedResourceIds").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.listIssues("p1");
      assertFail(result);
      expect(result.error).toBe("Failed to list issues");
    });
  });
});
