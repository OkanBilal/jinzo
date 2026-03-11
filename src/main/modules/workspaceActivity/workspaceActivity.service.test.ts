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

import { workspaceActivityService } from "./workspaceActivity.service";
import { workspaceActivityRepo } from "./workspaceActivity.repo";

describe("workspaceActivityService", () => {
  const wsId = "ws-1";

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createWorkspace(db, { id: wsId, accountId: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("getByWorkspace", () => {
    it("returns empty list", async () => {
      const result = await workspaceActivityService.getByWorkspace(wsId);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns activities", async () => {
      createWorkspaceActivity(db, { workspaceId: wsId, title: "A1" });
      createWorkspaceActivity(db, { workspaceId: wsId, title: "A2" });

      const result = await workspaceActivityService.getByWorkspace(wsId);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("create", () => {
    it("creates an activity and returns its id", async () => {
      const result = await workspaceActivityService.create({
        workspaceId: wsId,
        type: "commit",
        title: "Initial commit",
      });

      expect(result.success).toBe(true);
      expect(typeof result.data).toBe("string");
    });
  });

  describe("createMany", () => {
    it("creates multiple activities", async () => {
      const result = await workspaceActivityService.createMany([
        { workspaceId: wsId, type: "commit", title: "C1" },
        { workspaceId: wsId, type: "commit", title: "C2" },
      ]);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("delete", () => {
    it("deletes an activity", async () => {
      createWorkspaceActivity(db, { id: "del-1", workspaceId: wsId });

      const result = await workspaceActivityService.delete("del-1");
      expect(result.success).toBe(true);

      const check = await workspaceActivityService.getByWorkspace(wsId);
      expect(check.data).toHaveLength(0);
    });
  });

  describe("log", () => {
    it("inserts activity without blocking (fire-and-forget)", async () => {
      workspaceActivityService.log({
        workspaceId: wsId,
        type: "diff",
        title: "Auto-logged diff",
      });

      // Give the fire-and-forget a tick to complete
      await new Promise((r) => setTimeout(r, 50));

      const result = await workspaceActivityService.getByWorkspace(wsId);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].title).toBe("Auto-logged diff");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error handling (coverage for catch blocks)
  // ─────────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("getByWorkspace returns error on failure", async () => {
      vi.spyOn(workspaceActivityRepo, "findByWorkspace").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceActivityService.getByWorkspace("ws-1");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to get workspace activity");
    });

    it("create returns error on failure", async () => {
      vi.spyOn(workspaceActivityRepo, "insert").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceActivityService.create({
        workspaceId: wsId,
        type: "commit",
        title: "fail",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create activity");
    });

    it("createMany returns error on failure", async () => {
      vi.spyOn(workspaceActivityRepo, "insertMany").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceActivityService.createMany([
        { workspaceId: wsId, type: "commit", title: "fail" },
      ]);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to create activities");
    });

    it("delete returns error on failure", async () => {
      vi.spyOn(workspaceActivityRepo, "remove").mockRejectedValueOnce(new Error("db"));
      const result = await workspaceActivityService.delete("some-id");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to delete activity");
    });
  });
});
