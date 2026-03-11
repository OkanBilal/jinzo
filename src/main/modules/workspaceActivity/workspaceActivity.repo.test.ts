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

import { workspaceActivityRepo } from "./workspaceActivity.repo";

describe("workspaceActivityRepo", () => {
  const wsId = "ws-1";

  beforeEach(() => {
    ({ db, sqlite: _sqlite, cleanup } = createTestDb());
    createAccount(db, { id: "default" });
    createWorkspace(db, { id: wsId, accountId: "default" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("findByWorkspace", () => {
    it("returns empty array when no activity", async () => {
      const result = await workspaceActivityRepo.findByWorkspace(wsId);
      expect(result).toEqual([]);
    });

    it("returns activities ordered by createdAt desc", async () => {
      createWorkspaceActivity(db, {
        id: "a1",
        workspaceId: wsId,
        title: "First",
        type: "commit",
      });
      createWorkspaceActivity(db, {
        id: "a2",
        workspaceId: wsId,
        title: "Second",
        type: "diff",
      });

      const result = await workspaceActivityRepo.findByWorkspace(wsId);
      expect(result).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        createWorkspaceActivity(db, {
          workspaceId: wsId,
          title: `Activity ${i}`,
        });
      }

      const result = await workspaceActivityRepo.findByWorkspace(wsId, 2);
      expect(result).toHaveLength(2);
    });

    it("parses metadata JSON", async () => {
      createWorkspaceActivity(db, {
        workspaceId: wsId,
        title: "With metadata",
        metadata: JSON.stringify({ branch: "main" }),
      });

      const result = await workspaceActivityRepo.findByWorkspace(wsId);
      expect(result[0].metadata).toEqual({ branch: "main" });
    });
  });

  describe("insert", () => {
    it("inserts a new activity and returns its id", async () => {
      const id = await workspaceActivityRepo.insert({
        workspaceId: wsId,
        type: "commit",
        title: "New commit",
      });

      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);

      const rows = await workspaceActivityRepo.findByWorkspace(wsId);
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe("New commit");
    });

    it("uses provided id when given", async () => {
      const id = await workspaceActivityRepo.insert({
        id: "custom-id",
        workspaceId: wsId,
        type: "pr",
        title: "PR Activity",
      });

      expect(id).toBe("custom-id");
    });

    it("stores summary and refId", async () => {
      await workspaceActivityRepo.insert({
        workspaceId: wsId,
        type: "review",
        title: "Code review",
        summary: "Looks good",
        refId: "review-123",
      });

      const rows = await workspaceActivityRepo.findByWorkspace(wsId);
      expect(rows[0].summary).toBe("Looks good");
      expect(rows[0].refId).toBe("review-123");
    });

    it("serializes metadata to JSON", async () => {
      await workspaceActivityRepo.insert({
        workspaceId: wsId,
        type: "diff",
        title: "Diff captured",
        metadata: { files: 3, additions: 42 },
      });

      const rows = await workspaceActivityRepo.findByWorkspace(wsId);
      expect(rows[0].metadata).toEqual({ files: 3, additions: 42 });
    });
  });

  describe("insertMany", () => {
    it("inserts multiple activities and returns ids", async () => {
      const ids = await workspaceActivityRepo.insertMany([
        { workspaceId: wsId, type: "commit", title: "Commit 1" },
        { workspaceId: wsId, type: "commit", title: "Commit 2" },
        { workspaceId: wsId, type: "pr", title: "PR opened" },
      ]);

      expect(ids).toHaveLength(3);

      const rows = await workspaceActivityRepo.findByWorkspace(wsId);
      expect(rows).toHaveLength(3);
    });
  });

  describe("remove", () => {
    it("deletes an activity by id", async () => {
      createWorkspaceActivity(db, { id: "del-me", workspaceId: wsId });

      await workspaceActivityRepo.remove("del-me");

      const rows = await workspaceActivityRepo.findByWorkspace(wsId);
      expect(rows).toHaveLength(0);
    });

    it("does not fail when deleting nonexistent id", async () => {
      await expect(
        workspaceActivityRepo.remove("nonexistent"),
      ).resolves.not.toThrow();
    });
  });
});
