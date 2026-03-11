import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
  createEntity,
  createTask,
  createIssue,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({ getDb: () => db }));

import { entitiesController } from "./entities.controller";

describe("entitiesController", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  // ─────────────────────────────────────────────────────────────
  // Entity Operations
  // ─────────────────────────────────────────────────────────────
  describe("getAll", () => {
    it("returns empty array when no entities", async () => {
      const result = await entitiesController.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns entities", async () => {
      createEntity(db, { accountId: "default", kind: "task" });
      createEntity(db, { accountId: "default", kind: "issue" });

      const result = await entitiesController.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it("filters by kind", async () => {
      createEntity(db, { accountId: "default", kind: "task" });
      createEntity(db, { accountId: "default", kind: "issue" });

      const result = await entitiesController.getAll({ kind: "task" });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getById", () => {
    it("returns entity when found", async () => {
      const entity = createEntity(db, { id: "e1", accountId: "default", kind: "task", title: "Test" });

      const result = await entitiesController.getById("e1");
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("returns null data when not found", async () => {
      const result = await entitiesController.getById("nonexistent");
      expect(result.success).toBe(true);
      expect(result.data == null).toBe(true);
    });
  });

  describe("create", () => {
    it("creates an entity", async () => {
      const result = await entitiesController.create({
        accountId: "default",
        kind: "task",
        title: "New Entity",
      });
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("update", () => {
    it("updates an entity", async () => {
      createEntity(db, { id: "e1", accountId: "default", kind: "task", title: "Old" });

      const result = await entitiesController.update("e1", { title: "New" });
      expect(result.success).toBe(true);
    });
  });

  describe("delete", () => {
    it("soft deletes an entity", async () => {
      createEntity(db, { id: "e1", accountId: "default", kind: "task" });

      const result = await entitiesController.delete("e1");
      expect(result.success).toBe(true);
    });
  });

  describe("search", () => {
    it("returns matching entities", async () => {
      createEntity(db, { accountId: "default", kind: "task", title: "Fix login bug" });
      createEntity(db, { accountId: "default", kind: "task", title: "Add tests" });

      const result = await entitiesController.search("login");
      expect(result.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Task Operations
  // ─────────────────────────────────────────────────────────────
  describe("getAllTasks", () => {
    it("returns empty array when no tasks", async () => {
      const result = await entitiesController.getAllTasks();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns tasks", async () => {
      createTask(db, { accountId: "default" });

      const result = await entitiesController.getAllTasks();
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getTaskById", () => {
    it("returns task when found", async () => {
      const task = createTask(db, { accountId: "default" });

      const result = await entitiesController.getTaskById(task.entityId);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("createTask", () => {
    it("creates a task", async () => {
      const result = await entitiesController.createTask({
        entity: { accountId: "default", kind: "task", title: "New Task" },
        status: "todo",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateTask", () => {
    it("updates a task", async () => {
      const task = createTask(db, { accountId: "default", status: "todo" });

      const result = await entitiesController.updateTask(task.entityId, { status: "done" });
      expect(result.success).toBe(true);
    });
  });

  describe("deleteTask", () => {
    it("deletes a task", async () => {
      const task = createTask(db, { accountId: "default" });

      const result = await entitiesController.deleteTask(task.entityId);
      expect(result.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Issue Operations
  // ─────────────────────────────────────────────────────────────
  describe("getAllIssues", () => {
    it("returns empty array when no issues", async () => {
      const result = await entitiesController.getAllIssues();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns issues", async () => {
      createIssue(db, { accountId: "default" });

      const result = await entitiesController.getAllIssues();
      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getIssueById", () => {
    it("returns issue when found", async () => {
      const issue = createIssue(db, { accountId: "default" });

      const result = await entitiesController.getIssueById(issue.entityId);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("createIssue", () => {
    it("creates an issue", async () => {
      const result = await entitiesController.createIssue({
        entity: { accountId: "default", kind: "issue", title: "Bug Report" },
        provider: "github",
        state: "open",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateIssue", () => {
    it("updates an issue", async () => {
      const issue = createIssue(db, { accountId: "default", state: "open" });

      const result = await entitiesController.updateIssue(issue.entityId, { state: "closed" });
      expect(result.success).toBe(true);
    });
  });

  describe("deleteIssue", () => {
    it("deletes an issue", async () => {
      const issue = createIssue(db, { accountId: "default" });

      const result = await entitiesController.deleteIssue(issue.entityId);
      expect(result.success).toBe(true);
    });
  });
});
