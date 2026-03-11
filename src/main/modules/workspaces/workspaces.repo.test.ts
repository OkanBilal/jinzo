import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount, createProject, createWorkspace } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { workspacesRepo } from "./workspaces.repo";

describe("workspacesRepo", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("findAll", () => {
    it("returns empty array when no workspaces exist", async () => {
      const result = await workspacesRepo.findAll();
      expect(result).toEqual([]);
    });

    it("excludes archived workspaces by default", async () => {
      createWorkspace(db, { id: "w1", isArchived: false });
      createWorkspace(db, { id: "w2", isArchived: true });

      const result = await workspacesRepo.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("w1");
    });

    it("includes archived when flag is true", async () => {
      createWorkspace(db, { id: "w1", isArchived: false });
      createWorkspace(db, { id: "w2", isArchived: true });

      const result = await workspacesRepo.findAll(true);
      expect(result).toHaveLength(2);
    });
  });

  describe("findById", () => {
    it("returns null for non-existent id", async () => {
      const result = await workspacesRepo.findById("nope");
      expect(result).toBeNull();
    });

    it("returns the workspace with parsed metadata", async () => {
      createWorkspace(db, {
        id: "w1",
        name: "My WS",
        metadata: JSON.stringify({ key: "value" }),
      });

      const result = await workspacesRepo.findById("w1");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("My WS");
      expect(result!.metadata).toEqual({ key: "value" });
    });
  });

  describe("findByAccountId", () => {
    it("returns workspaces for the given account", async () => {
      createWorkspace(db, { id: "w1", accountId: "default" });

      const result = await workspacesRepo.findByAccountId("default");
      expect(result).toHaveLength(1);
    });

    it("excludes archived by default", async () => {
      createWorkspace(db, { id: "w1", accountId: "default", isArchived: false });
      createWorkspace(db, { id: "w2", accountId: "default", isArchived: true });

      const result = await workspacesRepo.findByAccountId("default");
      expect(result).toHaveLength(1);
    });
  });

  describe("findByRootPath", () => {
    it("finds workspace by accountId + rootPath", async () => {
      createWorkspace(db, { id: "w1", rootPath: "/home/user/project" });

      const result = await workspacesRepo.findByRootPath("default", "/home/user/project");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("w1");
    });

    it("returns null when not found", async () => {
      const result = await workspacesRepo.findByRootPath("default", "/nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("insert", () => {
    it("inserts a workspace and returns the id", async () => {
      const id = await workspacesRepo.insert({
        id: "new-1",
        accountId: "default",
        name: "New Workspace",
        rootPath: "/tmp/ws/new",
      });

      expect(id).toBe("new-1");
      const found = await workspacesRepo.findById("new-1");
      expect(found).not.toBeNull();
      expect(found!.name).toBe("New Workspace");
      expect(found!.status).toBe("todo"); // default
    });

    it("stores metadata as JSON", async () => {
      await workspacesRepo.insert({
        id: "meta-1",
        accountId: "default",
        name: "Meta WS",
        rootPath: "/tmp/ws/meta",
        metadata: { branch: "feature-x" },
      });

      const found = await workspacesRepo.findById("meta-1");
      expect(found!.metadata).toEqual({ branch: "feature-x" });
    });
  });

  describe("update", () => {
    it("updates specified fields", async () => {
      createWorkspace(db, { id: "u1", name: "Old", status: "todo" });

      const result = await workspacesRepo.update("u1", {
        name: "New",
        status: "in_progress",
      });
      expect(result).not.toBeNull();
      expect(result!.name).toBe("New");
      expect(result!.status).toBe("in_progress");
    });
  });

  describe("findByProjectId", () => {
    it("returns workspaces linked to a project", async () => {
      createProject(db, { id: "proj-1" });
      createWorkspace(db, { id: "w1", projectId: "proj-1" });
      createWorkspace(db, { id: "w2", projectId: "proj-1" });
      createWorkspace(db, { id: "w3" }); // no project

      const result = await workspacesRepo.findByProjectId("proj-1");
      expect(result).toHaveLength(2);
    });
  });

  describe("deleteByProjectId", () => {
    it("deletes all workspaces for a project", async () => {
      createProject(db, { id: "proj-1" });
      createWorkspace(db, { id: "w1", projectId: "proj-1" });
      createWorkspace(db, { id: "w2", projectId: "proj-1" });

      await workspacesRepo.deleteByProjectId("proj-1");

      const result = await workspacesRepo.findByProjectId("proj-1");
      expect(result).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it("removes the workspace", async () => {
      createWorkspace(db, { id: "d1" });

      await workspacesRepo.delete("d1");
      const result = await workspacesRepo.findById("d1");
      expect(result).toBeNull();
    });
  });

  describe("archive", () => {
    it("sets isArchived to true", async () => {
      createWorkspace(db, { id: "a1", isArchived: false });

      const result = await workspacesRepo.archive("a1");
      expect(result).not.toBeNull();
      expect(result!.isArchived).toBe(true);
    });
  });
});
