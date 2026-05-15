import { assertOk, assertFail } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount, createProject, createWorkspace, createRun } from "../../../test/factories";
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

  describe("getAll", () => {
    it("returns empty list when no projects exist", async () => {
      const result = await projectsService.getAll();
      assertOk(result);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it("returns all non-archived projects", async () => {
      createProject(db, { id: "p1", name: "Project A" });
      createProject(db, { id: "p2", name: "Project B" });

      const result = await projectsService.getAll();
      assertOk(result);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });
  });

  describe("getById", () => {
    it("returns the project when found", async () => {
      createProject(db, { id: "p1", name: "Found" });

      const result = await projectsService.getById("p1");
      assertOk(result);
      expect(result.data!.name).toBe("Found");
    });

    it("returns error when not found", async () => {
      const result = await projectsService.getById("nonexistent");
      assertFail(result);
      if (!result.success) {
        expect(result.error).toBe("Project not found");
      }
    });
  });

  describe("getByAccountId", () => {
    it("returns projects for the account", async () => {
      createProject(db, { id: "p1", accountId: "default" });

      const result = await projectsService.getByAccountId("default");
      assertOk(result);
      if (result.success) {
        expect(result.data).toHaveLength(1);
      }
    });
  });

  describe("findByRemoteOrigin", () => {
    it("finds project by normalized origin", async () => {
      createProject(db, {
        id: "p1",
        accountId: "default",
        remoteOrigin: "github.com/user/repo",
      });

      // Service calls normalizeRemoteOrigin internally
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
      if (!result.success) {
        expect(result.error).toBe("Project with this remote origin already exists");
      }
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

      const check = await projectsService.getById("d1");
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

  // ─────────────────────────────────────────────────────────────
  // remove (full cleanup)
  // ─────────────────────────────────────────────────────────────
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

      // Project should be gone
      const check = await projectsService.getById("p1");
      assertFail(check);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // update - not found
  // ─────────────────────────────────────────────────────────────
  describe("update - edge cases", () => {
    it("returns error when project not found", async () => {
      const result = await projectsService.update("nonexistent", { name: "X" });
      assertFail(result);
      expect(result.error).toBe("Project not found");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error paths
  // ─────────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("getAll returns error on failure", async () => {
      vi.spyOn(projectsRepo, "findAll").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.getAll();
      assertFail(result);
      expect(result.error).toBe("Failed to get projects");
    });

    it("getById returns error on failure", async () => {
      vi.spyOn(projectsRepo, "findById").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.getById("p1");
      assertFail(result);
      expect(result.error).toBe("Failed to get project");
    });

    it("getByAccountId returns error on failure", async () => {
      vi.spyOn(projectsRepo, "findByAccountId").mockRejectedValueOnce(new Error("db"));
      const result = await projectsService.getByAccountId("default");
      assertFail(result);
      expect(result.error).toBe("Failed to get projects");
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
  });
});
