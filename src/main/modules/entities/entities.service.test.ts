import { assertOk } from "../../../shared/ipc-kit/service-response";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount, createEntity, createTask, createIssue } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { entitiesService } from "./entities.service";

describe("entitiesService", () => {
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
    it("returns success with entities", async () => {
      createEntity(db, { id: "e1" });
      const result = await entitiesService.getAll();
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });

    it("passes options through", async () => {
      createEntity(db, { id: "e1", kind: "task" });
      createEntity(db, { id: "e2", kind: "issue" });

      const result = await entitiesService.getAll({ kind: "task" });
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getById", () => {
    it("returns entity by id", async () => {
      createEntity(db, { id: "e1", title: "Test" });
      const result = await entitiesService.getById("e1");
      assertOk(result);
      expect((result.data as any)?.title).toBe("Test");
    });

    it("returns null data for non-existent", async () => {
      const result = await entitiesService.getById("missing");
      assertOk(result);
      expect(result.data).toBeNull();
    });
  });

  describe("create", () => {
    it("creates entity with generated id", async () => {
      const result = await entitiesService.create({
        accountId: "default",
        kind: "task",
        title: "Created Entity",
      });
      assertOk(result);
      expect((result.data as any)?.title).toBe("Created Entity");
      expect((result.data as any)?.id).toBeTruthy();
    });
  });

  describe("update", () => {
    it("updates entity", async () => {
      createEntity(db, { id: "e1", title: "Old" });
      const result = await entitiesService.update("e1", { title: "New" });
      assertOk(result);
      expect((result.data as any)?.title).toBe("New");
    });
  });

  describe("delete", () => {
    it("soft-deletes entity", async () => {
      createEntity(db, { id: "e1" });
      const result = await entitiesService.delete("e1");
      assertOk(result);

      const check = await entitiesService.getAll();
      assertOk(check);
      expect(check.data).toHaveLength(0);
    });
  });

  describe("search", () => {
    it("returns matching entities", async () => {
      createEntity(db, { id: "e1", title: "Fix login bug" });
      createEntity(db, { id: "e2", title: "Add feature" });

      const result = await entitiesService.search("login");
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Task Operations
  // ─────────────────────────────────────────────────────────────
  describe("getAllTasks", () => {
    it("returns tasks", async () => {
      createTask(db, { entity: { id: "t1", title: "Task" } });
      const result = await entitiesService.getAllTasks();
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getTaskById", () => {
    it("returns task by entity id", async () => {
      createTask(db, { entity: { id: "t1", title: "My Task" } });
      const result = await entitiesService.getTaskById("t1");
      assertOk(result);
      expect((result.data as any)?.entity.title).toBe("My Task");
    });
  });

  describe("createTask", () => {
    it("creates task with entity", async () => {
      const result = await entitiesService.createTask({
        entity: { accountId: "default", kind: "task", title: "New Task" },
        status: "doing",
        priority: 2,
      });
      assertOk(result);
      expect((result.data as any)?.task.status).toBe("doing");
    });
  });

  describe("updateTask", () => {
    it("updates task", async () => {
      createTask(db, { entity: { id: "t1" }, task: { status: "todo" } });
      const result = await entitiesService.updateTask("t1", { status: "done" });
      assertOk(result);
      expect((result.data as any)?.task.status).toBe("done");
    });
  });

  describe("deleteTask", () => {
    it("soft-deletes task entity", async () => {
      createTask(db, { entity: { id: "t1" } });
      const result = await entitiesService.deleteTask("t1");
      assertOk(result);

      const check = await entitiesService.getAllTasks();
      assertOk(check);
      expect(check.data).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Issue Operations
  // ─────────────────────────────────────────────────────────────
  describe("getAllIssues", () => {
    it("returns issues", async () => {
      createIssue(db, { entity: { id: "i1" }, issue: { provider: "github", state: "open" } });
      const result = await entitiesService.getAllIssues();
      assertOk(result);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getIssueById", () => {
    it("returns issue by entity id", async () => {
      createIssue(db, {
        entity: { id: "i1", title: "Bug" },
        issue: { provider: "github", state: "open" },
      });
      const result = await entitiesService.getIssueById("i1");
      assertOk(result);
      expect((result.data as any)?.entity.title).toBe("Bug");
    });
  });

  describe("createIssue", () => {
    it("creates issue with entity", async () => {
      const result = await entitiesService.createIssue({
        entity: { accountId: "default", kind: "issue", title: "New Issue" },
        provider: "github",
        state: "open",
        number: 42,
      });
      assertOk(result);
      expect((result.data as any)?.issue.number).toBe(42);
    });
  });

  describe("updateIssue", () => {
    it("updates issue", async () => {
      createIssue(db, {
        entity: { id: "i1" },
        issue: { provider: "github", state: "open" },
      });
      const result = await entitiesService.updateIssue("i1", { state: "closed" });
      assertOk(result);
      expect((result.data as any)?.issue.state).toBe("closed");
    });
  });

  describe("deleteIssue", () => {
    it("soft-deletes issue entity", async () => {
      createIssue(db, {
        entity: { id: "i1" },
        issue: { provider: "github", state: "open" },
      });
      const result = await entitiesService.deleteIssue("i1");
      assertOk(result);

      const check = await entitiesService.getAllIssues();
      assertOk(check);
      expect(check.data).toHaveLength(0);
    });
  });
});
