import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import { createAccount, createWorkspace } from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: () => [],
  },
  app: {
    getPath: () => "/tmp",
    getName: () => "mains",
    getVersion: () => "0.0.0",
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
}));

vi.mock("child_process", () => ({
  exec: vi.fn((_cmd: string, _opts: any, cb: (err: null, stdout: string, stderr: string) => void) => cb(null, "", "")),
}));

import { workspacesController } from "./workspaces.controller";

describe("workspacesController", () => {
  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  // ─── getAll ──────────────────────────────────────────────
  describe("getAll", () => {
    it("returns empty array when no workspaces exist", async () => {
      const result = await workspacesController.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns all workspaces", async () => {
      createWorkspace(db, { id: "w1", name: "WS One" });
      createWorkspace(db, { id: "w2", name: "WS Two" });

      const result = await workspacesController.getAll();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  // ─── getById ─────────────────────────────────────────────
  describe("getById", () => {
    it("returns a workspace by id", async () => {
      createWorkspace(db, { id: "w1", name: "My WS" });

      const result = await workspacesController.getById("w1");
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe("My WS");
    });

    it("returns error for non-existent workspace", async () => {
      const result = await workspacesController.getById("missing");
      expect(result.success).toBe(false);
    });
  });

  // ─── getByAccountId ──────────────────────────────────────
  describe("getByAccountId", () => {
    it("returns workspaces for account", async () => {
      createWorkspace(db, { id: "w1", accountId: "default" });

      const result = await workspacesController.getByAccountId("default");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("returns empty array when account has no workspaces", async () => {
      const result = await workspacesController.getByAccountId("default");
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  // ─── getByRootPath ───────────────────────────────────────
  describe("getByRootPath", () => {
    it("finds workspace by account and root path", async () => {
      createWorkspace(db, { id: "w1", accountId: "default", rootPath: "/tmp/ws/test" });

      const result = await workspacesController.getByRootPath("default", "/tmp/ws/test");
      expect(result.success).toBe(true);
      expect(result.data!.id).toBe("w1");
    });

    it("returns error when not found", async () => {
      const result = await workspacesController.getByRootPath("default", "/nope");
      expect(result.success).toBe(false);
    });
  });

  // ─── create ──────────────────────────────────────────────
  describe("create", () => {
    it("creates a workspace and returns it", async () => {
      const result = await workspacesController.create({
        accountId: "default",
        name: "New WS",
        rootPath: "/tmp/ws/new",
      });
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe("New WS");
    });

    it("fails when duplicate rootPath exists for same account", async () => {
      createWorkspace(db, { accountId: "default", rootPath: "/tmp/ws/dup" });

      const result = await workspacesController.create({
        accountId: "default",
        name: "Dup",
        rootPath: "/tmp/ws/dup",
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── update ──────────────────────────────────────────────
  describe("update", () => {
    it("updates and returns the workspace", async () => {
      createWorkspace(db, { id: "w1", name: "Old" });

      const result = await workspacesController.update("w1", { name: "Updated" });
      expect(result.success).toBe(true);
      expect(result.data!.name).toBe("Updated");
    });

    it("returns error for non-existent workspace", async () => {
      const result = await workspacesController.update("missing", { name: "X" });
      expect(result.success).toBe(false);
    });
  });

  // ─── delete ──────────────────────────────────────────────
  describe("delete", () => {
    it("deletes a workspace", async () => {
      createWorkspace(db, { id: "w1" });

      const result = await workspacesController.delete("w1");
      expect(result.success).toBe(true);

      const check = await workspacesController.getById("w1");
      expect(check.success).toBe(false);
    });
  });

  // ─── archive ─────────────────────────────────────────────
  describe("archive", () => {
    it("archives a workspace", async () => {
      createWorkspace(db, { id: "w1" });

      const result = await workspacesController.archive("w1");
      expect(result.success).toBe(true);
      expect(result.data!.isArchived).toBe(true);
    });

    it("returns error for non-existent workspace", async () => {
      const result = await workspacesController.archive("missing");
      expect(result.success).toBe(false);
    });
  });
});
