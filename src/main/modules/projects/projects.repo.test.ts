import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount, createProject } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { projectsRepo } from "./projects.repo";

describe("projectsRepo", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("findAll", () => {
    it("returns empty array when no projects exist", async () => {
      const result = await projectsRepo.findAll();
      expect(result).toEqual([]);
    });

    it("returns only non-archived projects by default", async () => {
      createProject(db, { id: "p1", name: "Active", isArchived: false });
      createProject(db, { id: "p2", name: "Archived", isArchived: true });

      const result = await projectsRepo.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Active");
    });

    it("includes archived when flag is true", async () => {
      createProject(db, { id: "p1", isArchived: false });
      createProject(db, { id: "p2", isArchived: true });

      const result = await projectsRepo.findAll(true);
      expect(result).toHaveLength(2);
    });
  });

  describe("findById", () => {
    it("returns null for non-existent id", async () => {
      const result = await projectsRepo.findById("nope");
      expect(result).toBeNull();
    });

    it("returns the project with parsed branches JSON", async () => {
      createProject(db, {
        id: "p1",
        name: "My Project",
        branches: JSON.stringify(["main", "dev"]),
      });

      const result = await projectsRepo.findById("p1");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("My Project");
      expect(result!.branches).toEqual(["main", "dev"]);
    });
  });

  describe("findByAccountId", () => {
    it("returns projects for the given account", async () => {
      createProject(db, { id: "p1", accountId: "default" });

      const result = await projectsRepo.findByAccountId("default");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("p1");
    });

    it("excludes archived by default", async () => {
      createProject(db, { id: "p1", accountId: "default", isArchived: false });
      createProject(db, { id: "p2", accountId: "default", isArchived: true });

      const result = await projectsRepo.findByAccountId("default");
      expect(result).toHaveLength(1);
    });
  });

  describe("findByRemoteOrigin", () => {
    it("finds project by accountId + remoteOrigin", async () => {
      createProject(db, {
        id: "p1",
        accountId: "default",
        remoteOrigin: "github.com/user/repo",
      });

      const result = await projectsRepo.findByRemoteOrigin("default", "github.com/user/repo");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("p1");
    });

    it("returns null when origin does not match", async () => {
      createProject(db, {
        id: "p1",
        accountId: "default",
        remoteOrigin: "github.com/user/repo",
      });

      const result = await projectsRepo.findByRemoteOrigin("default", "github.com/other/repo");
      expect(result).toBeNull();
    });
  });

  describe("insert", () => {
    it("inserts a project and returns the id", async () => {
      const id = await projectsRepo.insert({
        id: "new-1",
        accountId: "default",
        name: "New Project",
        rootPath: "/tmp/new",
        remoteOrigin: "github.com/test/new",
      });

      expect(id).toBe("new-1");
      const found = await projectsRepo.findById("new-1");
      expect(found).not.toBeNull();
      expect(found!.name).toBe("New Project");
    });

    it("stores branches as JSON string", async () => {
      await projectsRepo.insert({
        id: "branch-1",
        accountId: "default",
        name: "Branch Test",
        rootPath: "/tmp/branch",
        remoteOrigin: "github.com/test/branch",
        branches: ["main", "feature"],
      });

      const found = await projectsRepo.findById("branch-1");
      expect(found!.branches).toEqual(["main", "feature"]);
    });
  });

  describe("update", () => {
    it("updates specified fields", async () => {
      createProject(db, { id: "u1", name: "Old" });

      const result = await projectsRepo.update("u1", { name: "New" });
      expect(result).not.toBeNull();
      expect(result!.name).toBe("New");
    });

    it("returns null when project does not exist", async () => {
      const result = await projectsRepo.update("nonexistent", { name: "X" });
      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("removes the project", async () => {
      createProject(db, { id: "d1" });

      await projectsRepo.delete("d1");
      const result = await projectsRepo.findById("d1");
      expect(result).toBeNull();
    });
  });

  describe("archive", () => {
    it("sets isArchived to true", async () => {
      createProject(db, { id: "a1", isArchived: false });

      const result = await projectsRepo.archive("a1");
      expect(result).not.toBeNull();
      expect(result!.isArchived).toBe(true);
    });
  });
});
