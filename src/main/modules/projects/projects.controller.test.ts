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

import { projectsController } from "./projects.controller";

describe("projectsController", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  // ─── getAll ──────────────────────────────────────────────
  describe("getAll", () => {
    it("returns empty array when no projects exist", async () => {
      const result = await projectsController.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns all projects", async () => {
      createProject(db, { id: "p1", name: "Alpha" });
      createProject(db, { id: "p2", name: "Beta" });

      const result = await projectsController.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  // ─── getById ─────────────────────────────────────────────
  describe("getById", () => {
    it("returns a project by id", async () => {
      createProject(db, { id: "p1", name: "My Project" });

      const result = await projectsController.getById("p1");
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe("My Project");
    });

    it("returns error for non-existent project", async () => {
      const result = await projectsController.getById("missing");
      expect(result.success).toBe(false);
    });
  });

  // ─── getByAccountId ──────────────────────────────────────
  describe("getByAccountId", () => {
    it("returns projects for a given account", async () => {
      createProject(db, { id: "p1", accountId: "default" });

      const result = await projectsController.getByAccountId("default");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("returns empty array for account with no projects", async () => {
      const result = await projectsController.getByAccountId("default");
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  // ─── findByRemoteOrigin ──────────────────────────────────
  describe("findByRemoteOrigin", () => {
    it("finds project by normalized remote origin", async () => {
      createProject(db, {
        id: "p1",
        accountId: "default",
        remoteOrigin: "github.com/test/repo",
      });

      const result = await projectsController.findByRemoteOrigin(
        "default",
        "https://github.com/test/repo.git",
      );
      expect(result.success).toBe(true);
      expect(result.data!.id).toBe("p1");
    });

    it("returns error when not found", async () => {
      const result = await projectsController.findByRemoteOrigin(
        "default",
        "github.com/nope/nope",
      );
      expect(result.success).toBe(false);
    });
  });

  // ─── findOrCreate ────────────────────────────────────────
  describe("findOrCreate", () => {
    it("returns existing project when remote origin matches", async () => {
      createProject(db, {
        id: "p1",
        accountId: "default",
        remoteOrigin: "github.com/test/repo",
      });

      const result = await projectsController.findOrCreate({
        accountId: "default",
        name: "Ignored",
        rootPath: "/tmp/ignored",
        remoteOrigin: "https://github.com/test/repo.git",
      });
      expect(result.success).toBe(true);
      expect(result.data!.id).toBe("p1");
    });

    it("creates a new project when no match found", async () => {
      const result = await projectsController.findOrCreate({
        accountId: "default",
        name: "New Project",
        rootPath: "/tmp/new",
        remoteOrigin: "github.com/new/repo",
      });
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe("New Project");
    });
  });

  // ─── create ──────────────────────────────────────────────
  describe("create", () => {
    it("creates a project and returns it", async () => {
      const result = await projectsController.create({
        accountId: "default",
        name: "Created",
        rootPath: "/tmp/created",
        remoteOrigin: "github.com/owner/created",
      });
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe("Created");
    });

    it("fails when duplicate remote origin exists", async () => {
      createProject(db, {
        accountId: "default",
        remoteOrigin: "github.com/dup/repo",
      });

      const result = await projectsController.create({
        accountId: "default",
        name: "Dup",
        rootPath: "/tmp/dup",
        remoteOrigin: "github.com/dup/repo",
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── update ──────────────────────────────────────────────
  describe("update", () => {
    it("updates and returns the project", async () => {
      createProject(db, { id: "p1", name: "Old Name" });

      const result = await projectsController.update("p1", { name: "New Name" });
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe("New Name");
    });

    it("returns error for non-existent project", async () => {
      const result = await projectsController.update("missing", { name: "X" });
      expect(result.success).toBe(false);
    });
  });

  // ─── delete ──────────────────────────────────────────────
  describe("delete", () => {
    it("deletes a project", async () => {
      createProject(db, { id: "p1" });

      const result = await projectsController.delete("p1");
      expect(result.success).toBe(true);

      const check = await projectsController.getById("p1");
      expect(check.success).toBe(false);
    });
  });

  // ─── archive ─────────────────────────────────────────────
  describe("archive", () => {
    it("archives a project", async () => {
      createProject(db, { id: "p1" });

      const result = await projectsController.archive("p1");
      expect(result.success).toBe(true);
      expect(result.data!.isArchived).toBe(true);
    });

    it("returns error for non-existent project", async () => {
      const result = await projectsController.archive("missing");
      expect(result.success).toBe(false);
    });
  });
});
