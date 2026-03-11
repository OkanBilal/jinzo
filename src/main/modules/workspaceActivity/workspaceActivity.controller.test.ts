import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestDb } from "../../../test/setup-db";
import {
  createAccount,
  createWorkspace,
  createWorkspaceActivity,
} from "../../../test/factories";
import type { DatabaseInstance } from "../../db/types";
import type Database from "better-sqlite3";

let db: DatabaseInstance;
let _sqlite: Database.Database;
let cleanup: () => void;

vi.mock("../../db/client", () => ({
  getDb: () => db,
}));

import { workspaceActivityController } from "./workspaceActivity.controller";

describe("workspaceActivityController", () => {
  const wsId = "ws-1";

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createWorkspace(db, { id: wsId, accountId: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  // ─── getByWorkspace ──────────────────────────────────────
  describe("getByWorkspace", () => {
    it("returns empty array when no activity exists", async () => {
      const result = await workspaceActivityController.getByWorkspace(wsId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns activities for a workspace", async () => {
      createWorkspaceActivity(db, { workspaceId: wsId, title: "Commit A", type: "commit" });
      createWorkspaceActivity(db, { workspaceId: wsId, title: "Diff B", type: "diff" });

      const result = await workspaceActivityController.getByWorkspace(wsId);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      createWorkspaceActivity(db, { workspaceId: wsId, title: "A" });
      createWorkspaceActivity(db, { workspaceId: wsId, title: "B" });
      createWorkspaceActivity(db, { workspaceId: wsId, title: "C" });

      const result = await workspaceActivityController.getByWorkspace(wsId, 2);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  // ─── create ──────────────────────────────────────────────
  describe("create", () => {
    it("creates an activity and returns its id", async () => {
      const result = await workspaceActivityController.create({
        workspaceId: wsId,
        type: "commit",
        title: "Initial commit",
        summary: "First commit",
      });
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe("string");

      // Verify it was persisted
      const list = await workspaceActivityController.getByWorkspace(wsId);
      expect(list.data).toHaveLength(1);
      expect(list.data![0].title).toBe("Initial commit");
    });
  });

  // ─── createMany ──────────────────────────────────────────
  describe("createMany", () => {
    it("creates multiple activities at once", async () => {
      const result = await workspaceActivityController.createMany([
        { workspaceId: wsId, type: "commit", title: "Commit 1" },
        { workspaceId: wsId, type: "pr", title: "PR 1" },
      ]);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);

      const list = await workspaceActivityController.getByWorkspace(wsId);
      expect(list.data).toHaveLength(2);
    });
  });

  // ─── delete ──────────────────────────────────────────────
  describe("delete", () => {
    it("deletes an activity", async () => {
      const activity = createWorkspaceActivity(db, {
        workspaceId: wsId,
        title: "To Delete",
      });

      const result = await workspaceActivityController.delete(activity.id);
      expect(result.success).toBe(true);

      const list = await workspaceActivityController.getByWorkspace(wsId);
      expect(list.data).toHaveLength(0);
    });
  });
});
