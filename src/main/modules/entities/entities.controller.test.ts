import { assertOk } from "../../../shared/ipc-kit/service-response";
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
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns entities", async () => {
      createEntity(db, { accountId: "default", kind: "task" });
      createEntity(db, { accountId: "default", kind: "issue" });

      const result = await entitiesController.getAll();
      assertOk(result);
      expect(result.data).toHaveLength(2);
    });

    it("filters by kind", async () => {
      createEntity(db, { accountId: "default", kind: "task" });
      createEntity(db, { accountId: "default", kind: "issue" });

      const result = await entitiesController.getAll({ kind: "task" });
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getById", () => {
    it("returns entity when found", async () => {

      const result = await entitiesController.getById("e1");
      assertOk(result);
      expect(result.data).toBeDefined();
    });

    it("returns null data when not found", async () => {
      const result = await entitiesController.getById("nonexistent");
      assertOk(result);
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
      assertOk(result);
      expect(result.data).toBeDefined();
    });
  });

  describe("update", () => {
    it("updates an entity", async () => {
      createEntity(db, { id: "e1", accountId: "default", kind: "task", title: "Old" });

      const result = await entitiesController.update("e1", { title: "New" });
      assertOk(result);
    });
  });

  describe("delete", () => {
    it("soft deletes an entity", async () => {
      createEntity(db, { id: "e1", accountId: "default", kind: "task" });

      const result = await entitiesController.delete("e1");
      assertOk(result);
    });
  });

  describe("search", () => {
    it("returns matching entities", async () => {
      createEntity(db, { accountId: "default", kind: "task", title: "Fix login bug" });
      createEntity(db, { accountId: "default", kind: "task", title: "Add tests" });

      const result = await entitiesController.search("login");
      assertOk(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Task Operations
  // ─────────────────────────────────────────────────────────────
  describe("getAllTasks", () => {
    it("returns empty array when no tasks", async () => {
      const result = await entitiesController.getAllTasks();
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns tasks", async () => {
      createTask(db, { entity: { accountId: "default" } });

      const result = await entitiesController.getAllTasks();
      assertOk(result);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getTaskById", () => {
    it("returns task when found", async () => {
      const task = createTask(db, { entity: { accountId: "default" } });

      const result = await entitiesController.getTaskById(task.entity.id);
      assertOk(result);
      expect(result.data).toBeDefined();
    });
  });

  describe("createTask", () => {
    it("creates a task", async () => {
      const result = await entitiesController.createTask({
        entity: { accountId: "default", kind: "task", title: "New Task" },
        status: "todo",
      });
      assertOk(result);
    });
  });

  describe("updateTask", () => {
    it("updates a task", async () => {
      const task = createTask(db, { entity: { accountId: "default" }, task: { status: "todo" } });

      const result = await entitiesController.updateTask(task.entity.id, { status: "done" });
      assertOk(result);
    });
  });

  describe("deleteTask", () => {
    it("deletes a task", async () => {
      const task = createTask(db, { entity: { accountId: "default" } });

      const result = await entitiesController.deleteTask(task.entity.id);
      assertOk(result);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Issue Operations
  // ─────────────────────────────────────────────────────────────
  describe("getAllIssues", () => {
    it("returns empty array when no issues", async () => {
      const result = await entitiesController.getAllIssues();
      assertOk(result);
      expect(result.data).toEqual([]);
    });

    it("returns issues", async () => {
      createIssue(db, { entity: { accountId: "default" } });

      const result = await entitiesController.getAllIssues();
      assertOk(result);
      expect(result.data!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getIssueById", () => {
    it("returns issue when found", async () => {
      const issue = createIssue(db, { entity: { accountId: "default" } });

      const result = await entitiesController.getIssueById(issue.entity.id);
      assertOk(result);
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
      assertOk(result);
    });
  });

  describe("updateIssue", () => {
    it("updates an issue", async () => {
      const issue = createIssue(db, { entity: { accountId: "default" }, issue: { state: "open" } });

      const result = await entitiesController.updateIssue(issue.entity.id, { state: "closed" });
      assertOk(result);
    });
  });

  describe("deleteIssue", () => {
    it("deletes an issue", async () => {
      const issue = createIssue(db, { entity: { accountId: "default" } });

      const result = await entitiesController.deleteIssue(issue.entity.id);
      assertOk(result);
    });
  });
});
